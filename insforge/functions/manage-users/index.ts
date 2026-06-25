// @ts-nocheck
import { createAdminClient } from "npm:@insforge/sdk";

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
    const insforgeUrl = Deno.env.get("INSFORGE_URL") ?? "";
    const insforgeServiceKey = Deno.env.get("INSFORGE_SERVICE_ROLE_KEY") ?? "";

    // We use the service_role key to bypass RLS and be able to create auth users
    const insforge = createAdminClient({
      baseUrl: insforgeUrl,
      apiKey: insforgeServiceKey
    });

    // Verify caller is an Admin/Owner
    const { data: { user }, error: authError } = await insforge.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: callerUser } = await insforge.from("users").select("role, outlet_id").eq("id", user.id).single();
    if (!callerUser || !['OWNER', 'ADMIN'].includes(callerUser.role)) {
      throw new Error("Forbidden: Only Admin/Owner can manage users.");
    }

    const body = await req.json();
    const { action, staffId, name, pin, role, outletId } = body;

    if (action === 'create_staff') {
      // 1. Create auth user with dummy email and pin as password
      const brandSlug = "jagoankasir.internal"; // Or fetch from somewhere
      const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const uniqueSuffix = Math.floor(Math.random() * 10000);
      const email = `${normalizedName}${uniqueSuffix}@${brandSlug}`;

      const { data: authData, error: createAuthError } = await insforge.auth.admin.createUser({
        email,
        password: pin, // Must be at least 6 chars
        email_confirm: true
      });

      if (createAuthError) throw createAuthError;

      const targetOutletId = role === 'OWNER' ? null : (outletId || callerUser.outlet_id);

      // 2. Insert into users table
      const { data: dbUser, error: dbError } = await insforge.from("users").insert({
        id: authData.user.id,
        name: name,
        email: email,
        role: role || 'STAFF',
        pin: pin,
        outlet_id: targetOutletId,
        is_active: true
      }).select().single();

      if (dbError) throw dbError;

      return new Response(JSON.stringify({ success: true, user: dbUser }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === 'reset_pin') {
      if (!staffId || !pin) throw new Error("Missing staffId or pin");

      // Check if caller can modify this staff
      if (callerUser.role === 'ADMIN') {
        const { data: targetStaff } = await insforge.from("users").select("outlet_id").eq("id", staffId).single();
        if (targetStaff?.outlet_id !== callerUser.outlet_id) {
          throw new Error("Forbidden: Cannot modify staff from another outlet.");
        }
      }

      // 1. Update Auth password
      const { error: updateAuthError } = await insforge.auth.admin.updateUserById(staffId, {
        password: pin
      });

      if (updateAuthError) throw updateAuthError;

      // 2. Update DB pin
      const { error: dbError } = await insforge.from("users").update({ pin }).eq("id", staffId);
      if (dbError) throw dbError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    throw new Error("Invalid action");
  } catch (error) {
    const err = error as Error;
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
}
