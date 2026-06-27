import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface TransactionRequest {
  id?: string;
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
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Missing Authorization header");

    const insforgeUrl = process.env.NEXT_PUBLIC_INSFORGE_URL || "";
    const insforgeServiceKey = process.env.INSFORGE_SERVICE_ROLE_KEY || process.env.VPS_SUPABASE_SERVICE_KEY || "";

    const insforge = createClient(insforgeUrl, insforgeServiceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: { user }, error: authError } = await insforge.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const body: TransactionRequest = await req.json();
    const { id, cycleId, staffId, outletId, paymentMethod, items, voucherCode, globalDiscount } = body;

    if (!items || items.length === 0) {
      throw new Error("Transaction items cannot be empty");
    }

    if (id) {
      const { data: existingTxn } = await insforge
        .from('transactions')
        .select('id')
        .eq('id', id)
        .single();
        
      if (existingTxn) {
        return NextResponse.json({ success: true, transaction: existingTxn, message: 'Already processed (idempotent)' }, { status: 200, headers: corsHeaders });
      }
    }

    const productIds = items.map(i => i.productId);
    const { data: products, error: productsError } = await insforge
      .from('products')
      .select('id, name, price, stock')
      .in('id', productIds);

    if (productsError) throw productsError;

    const productMap = new Map(products.map(p => [p.id, p]));

    let itemTotal = 0;
    const transactionItemsToInsert = [];
    const stockUpdates: Array<{ id: string, stock: number }> = [];

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

      product.stock -= item.quantity;
      stockUpdates.push({ id: product.id, stock: product.stock });
    }

    const { data: recipes, error: recipesError } = await insforge
      .from('product_recipes')
      .select('product_id, material_id, quantity, serve_type')
      .in('product_id', productIds);

    if (recipesError) throw recipesError;

    if (recipes && recipes.length > 0) {
      const materialIds = [...new Set(recipes.map(r => r.material_id))];
      const { data: materials, error: materialsError } = await insforge
        .from('products')
        .select('id, stock')
        .in('id', materialIds);

      if (materialsError) throw materialsError;
      
      const materialMap = new Map(materials.map(m => [m.id, m]));

      for (const item of items) {
        const itemRecipes = recipes.filter(r => 
          r.product_id === item.productId && 
          (r.serve_type === item.serveType || r.serve_type === null)
        );

        for (const recipe of itemRecipes) {
          const material = materialMap.get(recipe.material_id);
          if (material) {
            material.stock -= (recipe.quantity * item.quantity);
          }
        }
      }

      for (const [mid, material] of materialMap.entries()) {
        stockUpdates.push({ id: mid, stock: material.stock });
      }
    }

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

    const finalItems = transactionItemsToInsert.map(i => ({
      ...i,
      transaction_id: transaction.id
    }));

    const { error: itemsError } = await insforge
      .from('transaction_items')
      .insert(finalItems);

    if (itemsError) throw itemsError;

    const updatePromises = stockUpdates.map(update => 
      insforge.from('products').update({ stock: update.stock }).eq('id', update.id)
    );
    const updateResults = await Promise.all(updatePromises);
    
    for (const res of updateResults) {
      if (res.error) throw res.error;
    }

    return NextResponse.json({ success: true, transaction }, { status: 200, headers: corsHeaders });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 400, headers: corsHeaders });
  }
}
