import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface OpnameRequest {
  outletId: string;
  userId: string;
  adjustments: Array<{
    productId: string;
    newStock: number;
    adjustmentType: 'RESTOCK' | 'DAMAGE' | 'LOSS' | 'CORRECTION';
    reason?: string;
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

    const body: OpnameRequest = await req.json();
    const { outletId, userId, adjustments } = body;

    if (!adjustments || adjustments.length === 0) {
      throw new Error("No adjustments provided");
    }

    const productIds = adjustments.map(a => a.productId);
    const { data: products, error: productsError } = await insforge
      .from('products')
      .select('id, stock')
      .in('id', productIds)
      .eq('outlet_id', outletId);

    if (productsError) throw productsError;

    const productMap = new Map(products.map(p => [p.id, p]));
    const logsToInsert = [];
    const stockUpdates = [];

    const today = new Date().toISOString().split('T')[0];

    for (const adj of adjustments) {
      const product = productMap.get(adj.productId);
      if (!product) throw new Error(`Product ${adj.productId} not found in outlet ${outletId}`);

      logsToInsert.push({
        product_id: adj.productId,
        outlet_id: outletId,
        adjusted_by: userId,
        old_stock: product.stock,
        new_stock: adj.newStock,
        adjustment_type: adj.adjustmentType,
        reason: adj.reason || null,
        date: today
      });

      stockUpdates.push({
        id: adj.productId,
        stock: adj.newStock
      });
    }

    const { error: logsError } = await insforge
      .from('stock_adjustment_logs')
      .insert(logsToInsert);

    if (logsError) throw logsError;

    const { error: updateError } = await insforge
      .from('products')
      .upsert(stockUpdates);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, count: adjustments.length }, { status: 200, headers: corsHeaders });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 400, headers: corsHeaders });
  }
}
