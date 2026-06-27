import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
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

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Missing Supabase URL or Service Key" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, { 
      auth: { persistSession: false },
      global: { fetch: customFetch }
    });

    // 1. Get all users from Auth
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) throw authError;

    const authUsers = authData.users;
    let fixedCount = 0;

    // 2. For each auth user, check if they exist in public.users
    for (const user of authUsers) {
      const { data: publicUser } = await supabase.from("users").select("id").eq("id", user.id).maybeSingle();
      
      if (!publicUser) {
        // Find default outlet (Teh Maestro)
        const { data: outlet } = await supabase.from("outlets").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle();
        
        // Insert into public.users
        const { error: insertError } = await supabase.from("users").insert({
          id: user.id,
          name: user.email?.split("@")[0] || "Unknown User",
          email: user.email,
          role: "OWNER", // Make them owner so they can login and manage
          is_active: true,
          outlet_id: outlet?.id || null
        });

        if (insertError) {
          console.error(`Failed to insert ${user.email}:`, insertError);
        } else {
          fixedCount++;
        }
      }
      
      // Also auto-confirm email just in case it's waiting for verification
      if (!user.email_confirmed_at) {
        await supabase.auth.admin.updateUserById(user.id, { email_confirm: true });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Berhasil memperbaiki ${fixedCount} akun! Anda sekarang bisa login.` 
    });

  } catch (error: any) {
    const errorDetails = {
      message: error.message,
      name: error.name,
      stack: error.stack,
      cause: error.cause ? String(error.cause) : undefined,
      stringified: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      raw: String(error)
    };
    return NextResponse.json({ error: errorDetails }, { status: 500 });
  }
}
