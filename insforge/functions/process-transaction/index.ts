// @ts-nocheck
import { createAdminClient } from "npm:@insforge/sdk";

// Define the shape of our incoming request
interface TransactionRequest {
  id?: string; // Optional for backward compatibility, but required for Phase 3 idempotency
  cycleId: string;
  staffId: string;
  outletId: string;
  paymentMethod: 'CASH' | 'QRIS_STATIC';
  voucherCode?: string;
  globalDiscount?: number;
  items: Array<{
    productId: string;
    quantity: number;
    serveType: 'HOT' | 'COLD' | null;
    discountAmount?: number;
  }>;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export default async function (req: Request) {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const insforgeUrl = Deno.env.get("INSFORGE_URL") ?? "";
    const insforgeServiceKey = Deno.env.get("INSFORGE_SERVICE_ROLE_KEY") ?? "";

    // We use the service role key to perform DB updates bypass RLS, 
    // but we can also use the auth header to verify the user.
    // In this edge function, we will bypass RLS since it's a complex transaction that updates multiple tables.
    const insforge = createAdminClient({ baseUrl: insforgeUrl, apiKey: insforgeServiceKey });

    // Verify user token just to be secure
    const { data: { user }, error: authError } = await insforge.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const { id, cycleId, staffId, outletId, paymentMethod, items, voucherCode, globalDiscount }: TransactionRequest = await req.json();

    if (!items || items.length === 0) {
      throw new Error("Transaction items cannot be empty");
    }

    // IDEMPOTENCY CHECK
    if (id) {
      const { data: existingTxn } = await insforge
        .from('transactions')
        .select('id')
        .eq('id', id)
        .single();
        
      if (existingTxn) {
        // Transaction already processed successfully previously. Return success without deducting stock.
        return new Response(JSON.stringify({ success: true, transaction: existingTxn, message: 'Already processed (idempotent)' }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // Begin a 'pseudo' transaction
    // 1. Fetch all product details for validation and calculating total
    const productIds = items.map(i => i.productId);
    const { data: products, error: productsError } = await insforge
      .from('products')
      .select('id, name, price, stock')
      .in('id', productIds);

    if (productsError) throw productsError;

    // Create a lookup map
    const productMap = new Map(products.map(p => [p.id, p]));

    let itemTotal = 0;
    const transactionItemsToInsert = [];
    const stockUpdates: Array<{ id: string, stock: number }> = [];

    // Deduct main products
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) throw new Error(`Product not found: ${item.productId}`);

      const subtotal = (product.price * item.quantity) - (item.discountAmount || 0);
      itemTotal += subtotal;

      transactionItemsToInsert.push({
        product_id: item.productId,
        product_name: product.name,
        quantity: item.quantity,
        price: product.price,
        serve_type: item.serveType,
        discount_amount: item.discountAmount || 0,
        subtotal: Math.max(0, subtotal)
      });

      // Update main product stock
      product.stock -= item.quantity;
      stockUpdates.push({ id: product.id, stock: product.stock });
    }

    // 2. Auto-Deduct BOM
    const { data: recipes, error: recipesError } = await insforge
      .from('product_recipes')
      .select('product_id, material_id, quantity, serve_type')
      .in('product_id', productIds);

    if (recipesError) throw recipesError;

    if (recipes && recipes.length > 0) {
      // Fetch material stocks
      const materialIds = [...new Set(recipes.map(r => r.material_id))];
      const { data: materials, error: materialsError } = await insforge
        .from('products')
        .select('id, stock')
        .in('id', materialIds);

      if (materialsError) throw materialsError;
      
      const materialMap = new Map(materials.map(m => [m.id, m]));

      // Deduct materials based on recipes
      for (const item of items) {
        // Find matching recipes for this product and serve_type (or null serve_type)
        const itemRecipes = recipes.filter(r => 
          r.product_id === item.productId && 
          (r.serve_type === item.serveType || r.serve_type === null)
        );

        for (const recipe of itemRecipes) {
          const material = materialMap.get(recipe.material_id);
          if (material) {
            // Deduct recipe quantity * ordered quantity
            material.stock -= (recipe.quantity * item.quantity);
          }
        }
      }

      // Add updated materials to stockUpdates
      for (const [id, material] of materialMap.entries()) {
        stockUpdates.push({ id, stock: material.stock });
      }
    }

    // 3. Process Voucher / Discounts
    let finalDiscountAmount = globalDiscount || 0;
    let appliedVoucherCode = voucherCode || null;

    if (voucherCode) {
      const { data: voucher, error: voucherError } = await insforge
        .from('vouchers')
        .select('*')
        .eq('code', voucherCode)
        .eq('outlet_id', outletId)
        .eq('is_active', true)
        .single();
        
      if (voucherError || !voucher) {
        throw new Error("Invalid or expired voucher code");
      }
      if (voucher.valid_until && new Date(voucher.valid_until) < new Date()) {
        throw new Error("Voucher code has expired");
      }
      if (voucher.min_purchase > itemTotal) {
        throw new Error(`Minimum purchase of Rp ${voucher.min_purchase} required for this voucher`);
      }

      if (voucher.discount_type === 'PERCENTAGE') {
        let calcDiscount = Math.floor(itemTotal * (voucher.discount_value / 100));
        if (voucher.max_discount && calcDiscount > voucher.max_discount) {
          calcDiscount = voucher.max_discount;
        }
        finalDiscountAmount = calcDiscount;
      } else {
        finalDiscountAmount = voucher.discount_value;
      }
    }

    const totalAmount = Math.max(0, itemTotal - finalDiscountAmount);

    // 4. Insert Transaction
    const transactionPayload: any = {
      cycle_id: cycleId,
      staff_id: staffId,
      outlet_id: outletId,
      total_amount: totalAmount,
      discount_amount: finalDiscountAmount,
      voucher_code: appliedVoucherCode,
      payment_method: paymentMethod,
      status: 'COMPLETED'
    };
    if (id) {
      transactionPayload.id = id;
    }

    const { data: transaction, error: txnError } = await insforge
      .from('transactions')
      .insert(transactionPayload)
      .select()
      .single();

    if (txnError) throw txnError;

    // 5. Insert Transaction Items
    const finalItems = transactionItemsToInsert.map(i => ({
      ...i,
      transaction_id: transaction.id
    }));

    const { error: itemsError } = await insforge
      .from('transaction_items')
      .insert(finalItems);

    if (itemsError) throw itemsError;

    // 6. Update Stocks individually to avoid upsert NOT NULL constraint errors
    const updatePromises = stockUpdates.map(update => 
      insforge.from('products').update({ stock: update.stock }).eq('id', update.id)
    );
    const updateResults = await Promise.all(updatePromises);
    
    for (const res of updateResults) {
      if (res.error) throw res.error;
    }

    return new Response(JSON.stringify({ success: true, transaction }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const err = error as Error;
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
}
