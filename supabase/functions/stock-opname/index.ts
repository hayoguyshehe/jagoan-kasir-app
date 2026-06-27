// @ts-nocheck
import { createAdminClient } from "npm:@supabase/sdk";

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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export default async function (req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabase = createAdminClient({ baseUrl: supabaseUrl, apiKey: supabaseServiceKey });

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const { outletId, userId, adjustments }: OpnameRequest = await req.json();

    if (!adjustments || adjustments.length === 0) {
      throw new Error("No adjustments provided");
    }

    // 1. Fetch current stock for validation and calculating old_stock
    const productIds = adjustments.map(a => a.productId);
    const { data: products, error: productsError } = await supabase
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

    // 2. Insert Logs
    const { error: logsError } = await supabase
      .from('stock_adjustment_logs')
      .insert(logsToInsert);

    if (logsError) throw logsError;

    // 3. Update Stocks
    const { error: updateError } = await supabase
      .from('products')
      .upsert(stockUpdates);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, count: adjustments.length }), {
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
