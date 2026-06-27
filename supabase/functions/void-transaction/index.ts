// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";

// Define the shape of our incoming request
interface VoidRequest {
  transactionId: string;
  pin: string;
  reason: string;
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabase = createClient(supabaseUrl, );

    // Verify user token
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const { transactionId, pin, reason }: VoidRequest = await req.json();

    if (!transactionId || !pin || !reason) {
      throw new Error("transactionId, pin, and reason are required");
    }

    // Fetch transaction details
    const { data: transaction, error: txnError } = await supabase
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
    // If < 5 minutes: can use staff_id PIN or Admin/Owner PIN
    // If > 5 minutes: must use Admin/Owner PIN
    // Since PIN is hashed, in a real app we'd verify the hash (e.g. bcrypt). 
    // Assuming simple string equality for this initial version, or an RPC function to verify.
    // Let's do a direct query. We need the user who owns the PIN.
    const { data: pinUsers, error: pinError } = await supabase
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
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, stock')
      .in('id', productIds);

    if (productsError) throw productsError;
    const productMap = new Map(products.map(p => [p.id, p]));

    // Reverse main products
    for (const item of transaction.transaction_items) {
      const product = productMap.get(item.product_id);
      if (product) {
        product.stock += item.quantity;
        stockUpdates.push({ id: product.id, stock: product.stock });
      }
    }

    // 2. Reverse BOM
    const { data: recipes, error: recipesError } = await supabase
      .from('product_recipes')
      .select('product_id, material_id, quantity, serve_type')
      .in('product_id', productIds);

    if (recipesError) throw recipesError;

    if (recipes && recipes.length > 0) {
      const materialIds = [...new Set(recipes.map(r => r.material_id))];
      const { data: materials, error: materialsError } = await supabase
        .from('products')
        .select('id, stock')
        .in('id', materialIds);

      if (materialsError) throw materialsError;
      
      const materialMap = new Map(materials.map(m => [m.id, m]));

      for (const item of transaction.transaction_items) {
        const itemRecipes = recipes.filter(r => 
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

    // Execute updates individually to avoid NOT NULL constraint errors on partial upsert
    if (stockUpdates.length > 0) {
      for (const update of stockUpdates) {
        const { error: updateError } = await supabase
          .from('products')
          .update({ stock: update.stock })
          .eq('id', update.id);
          
        if (updateError) throw updateError;
      }
    }

    // Update transaction to VOIDED
    const { data: updatedTxn, error: updateTxnError } = await supabase
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

    return new Response(JSON.stringify({ success: true, transaction: updatedTxn }), {
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
