// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@insforge/sdk';

interface VoidRequest {
  transactionId: string;
  pin: string;
  reason: string;
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

    const insforge = createAdminClient({ baseUrl: insforgeUrl, apiKey: insforgeServiceKey });

    // Verify user token
    const { data: { user }, error: authError } = await insforge.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { transactionId, pin, reason }: VoidRequest = await req.json();

    if (!transactionId || !pin || !reason) {
      throw new Error("transactionId, pin, and reason are required");
    }

    // Fetch transaction details
    const { data: transaction, error: txnError } = await insforge
      .from('transactions')
      .select('*, transaction_items(*)')
      .eq('id', transactionId)
      .single();

    if (txnError || !transaction) throw new Error("Transaction not found");
    if (transaction.status === 'VOIDED') throw new Error("Transaction is already voided");

    // Check time difference (Grace Period = 5 minutes)
    const txnTime = new Date(transaction.created_at).getTime();
    const now = new Date().getTime();
    const diffMinutes = (now - txnTime) / 1000 / 60;
    const isPastGracePeriod = diffMinutes > 5;

    // Verify PIN against users
    const { data: pinUsers, error: pinError } = await insforge
      .from('users')
      .select('id, role, pin, outlet_id')
      .eq('pin', pin)
      .or(`outlet_id.eq.${transaction.outlet_id},outlet_id.is.null`);

    if (pinError || !pinUsers || pinUsers.length === 0) {
      throw new Error("Invalid PIN");
    }

    const authorizingUser = pinUsers[0];

    if (isPastGracePeriod && authorizingUser.role === 'STAFF') {
      throw new Error("Grace period expired. Admin PIN required to void.");
    }
    if (!isPastGracePeriod && authorizingUser.role === 'STAFF' && authorizingUser.id !== transaction.staff_id) {
      throw new Error("Only the original staff or an admin can void this transaction.");
    }

    // PIN is valid. Reverse the stock deductions
    const stockUpdates: Array<{ id: string, stock: number }> = [];

    // 1. Fetch current stocks of the products in the transaction
    const productIds = transaction.transaction_items.map((item: any) => item.product_id);
    const { data: products, error: productsError } = await insforge
      .from('products')
      .select('id, stock')
      .in('id', productIds);

    if (productsError) throw productsError;
    const productMap = new Map(products.map((p: any) => [p.id, p]));

    // Reverse main products
    for (const item of transaction.transaction_items) {
      const product = productMap.get(item.product_id);
      if (product) {
        product.stock += item.quantity;
        stockUpdates.push({ id: product.id, stock: product.stock });
      }
    }

    // 2. Reverse BOM
    const { data: recipes, error: recipesError } = await insforge
      .from('product_recipes')
      .select('product_id, material_id, quantity, serve_type')
      .in('product_id', productIds);

    if (recipesError) throw recipesError;

    if (recipes && recipes.length > 0) {
      const materialIds = [...new Set(recipes.map((r: any) => r.material_id))];
      const { data: materials, error: materialsError } = await insforge
        .from('products')
        .select('id, stock')
        .in('id', materialIds);

      if (materialsError) throw materialsError;
      
      const materialMap = new Map(materials.map((m: any) => [m.id, m]));

      for (const item of transaction.transaction_items) {
        const itemRecipes = recipes.filter((r: any) => 
          r.product_id === item.product_id && 
          (r.serve_type === item.serve_type || r.serve_type === null)
        );

        for (const recipe of itemRecipes) {
          const material = materialMap.get(recipe.material_id);
          if (material) {
            material.stock += (recipe.quantity * item.quantity);
          }
        }
      }

      for (const [id, material] of materialMap.entries()) {
        stockUpdates.push({ id, stock: material.stock });
      }
    }

    // Execute updates individually to avoid NOT NULL constraint errors
    if (stockUpdates.length > 0) {
      for (const update of stockUpdates) {
        const { error: updateError } = await insforge
          .from('products')
          .update({ stock: update.stock })
          .eq('id', update.id);
          
        if (updateError) throw updateError;
      }
    }

    // Update transaction to VOIDED
    const { data: updatedTxn, error: updateTxnError } = await insforge
      .from('transactions')
      .update({
        status: 'VOIDED',
        void_reason: reason,
        voided_by: authorizingUser.id,
        voided_at: new Date().toISOString()
      })
      .eq('id', transactionId)
      .select()
      .single();

    if (updateTxnError) throw updateTxnError;

    return NextResponse.json({ success: true, transaction: updatedTxn }, { status: 200, headers: corsHeaders });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 400, headers: corsHeaders });
  }
}
