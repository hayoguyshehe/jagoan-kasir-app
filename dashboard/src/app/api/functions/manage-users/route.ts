import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VPS_SUPABASE_SERVICE_KEY || "";

    const customFetch = (url: RequestInfo | URL, options?: RequestInit) => {
      let fetchUrl = url.toString();
      const fetchOptions: any = options || {};
      fetchOptions.headers = new Headers(fetchOptions.headers || {});
      
      // Bypass Hairpin NAT and Traefik by hitting the Kong container directly
      if (fetchUrl.includes("apitehmaestro.jagoankasir.store")) {
        fetchUrl = fetchUrl.replace("https://apitehmaestro.jagoankasir.store", "http://supabasekong-evbv7dpfdcuglrfem0rh5pnh:8000");
      }
      
      return fetch(fetchUrl, fetchOptions);
    };

    const supabase = createClient(supabaseUrl, supabaseServiceKey, { 
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: customFetch }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { data: callerUser } = await supabase.from("users").select("role, outlet_id").eq("id", user.id).single();
    if (!callerUser || !['OWNER', 'ADMIN'].includes(callerUser.role)) {
      throw new Error("Forbidden: Only Admin/Owner can manage users.");
    }

    const body = await req.json();
    const { action, staffId, name, pin, role, outletId } = body;

    if (action === 'create_staff') {
      const brandSlug = "jagoankasir.internal";
      const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const uniqueSuffix = Math.floor(Math.random() * 10000);
      const email = `${normalizedName}${uniqueSuffix}@${brandSlug}`;

      const { data: authData, error: createAuthError } = await supabase.auth.admin.createUser({
        email,
        password: pin,
        email_confirm: true
      });

      if (createAuthError) throw createAuthError;

      const targetOutletId = role === 'OWNER' ? null : (outletId || callerUser.outlet_id);

      const { data: dbUser, error: dbError } = await supabase.from("users").insert({
        id: authData.user.id,
        name: name,
        email: email,
        role: role || 'STAFF',
        pin: pin,
        outlet_id: targetOutletId,
        is_active: true
      }).select().single();

      if (dbError) throw dbError;

      return NextResponse.json({ success: true, user: dbUser }, { headers: corsHeaders });
    }

    if (action === 'reset_pin') {
      if (!staffId || !pin) throw new Error("Missing staffId or pin");

      if (callerUser.role === 'ADMIN') {
        const { data: targetStaff } = await supabase.from("users").select("outlet_id").eq("id", staffId).single();
        if (targetStaff?.outlet_id !== callerUser.outlet_id) {
          throw new Error("Forbidden: Cannot modify staff from another outlet.");
        }
      }

      const { error: updateAuthError } = await supabase.auth.admin.updateUserById(staffId, {
        password: pin
      });

      if (updateAuthError) throw updateAuthError;

      const { error: dbError } = await supabase.from("users").update({ pin }).eq("id", staffId);
      if (dbError) throw dbError;

      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    throw new Error("Invalid action");
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 400, headers: corsHeaders });
  }
}
