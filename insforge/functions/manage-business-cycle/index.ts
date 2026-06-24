// @ts-nocheck
import { createClient } from "npm:@insforge/sdk";

interface CycleRequest {
  action: 'open' | 'close';
  outletId: string;
  userId: string;
  notes?: string;
  cycleId?: string; // required if action === 'close'
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
    const insforgeUrl = Deno.env.get("INSFORGE_URL") ?? "";
    const insforgeServiceKey = Deno.env.get("INSFORGE_SERVICE_ROLE_KEY") ?? "";

    const insforge = createClient(insforgeUrl, insforgeServiceKey);

    const { data: { user }, error: authError } = await insforge.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const { action, outletId, userId, notes, cycleId }: CycleRequest = await req.json();

    if (!action || !outletId || !userId) {
      throw new Error("action, outletId, and userId are required");
    }

    if (action === 'open') {
      // Create new cycle
      const { data, error } = await insforge
        .from('business_cycles')
        .insert({
          outlet_id: outletId,
          opened_by: userId,
          status: 'ACTIVE',
          notes: notes
        })
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, cycle: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });

    } else if (action === 'close') {
      if (!cycleId) throw new Error("cycleId is required to close");

      // 1. Close cycle
      const { data: cycle, error: cycleError } = await insforge
        .from('business_cycles')
        .update({
          closed_at: new Date().toISOString(),
          closed_by: userId,
          status: 'CLOSED',
          notes: notes
        })
        .eq('id', cycleId)
        .select()
        .single();

      if (cycleError) throw cycleError;

      // 2. Force clock out staff who forgot
      const { error: attError } = await insforge
        .from('attendance_logs')
        .update({
          clock_out_at: new Date().toISOString(),
          status: 'AUTO_CLOCKED_OUT'
        })
        .eq('cycle_id', cycleId)
        .is('clock_out_at', null);

      if (attError) throw attError;

      // 3. Mark ALPA for staff who didn't clock in at all
      // For simplicity, we fetch all active staff for this outlet
      const { data: activeStaff } = await insforge
        .from('users')
        .select('id')
        .eq('outlet_id', outletId)
        .eq('role', 'STAFF')
        .eq('is_active', true);

      if (activeStaff && activeStaff.length > 0) {
        // Fetch staff who did clock in
        const { data: clockedInStaff } = await insforge
          .from('attendance_logs')
          .select('user_id')
          .eq('cycle_id', cycleId);

        const clockedInIds = clockedInStaff ? clockedInStaff.map(s => s.user_id) : [];
        const missingStaff = activeStaff.filter(s => !clockedInIds.includes(s.id));

        if (missingStaff.length > 0) {
          const alpaRecords = missingStaff.map(s => ({
            cycle_id: cycleId,
            user_id: s.id,
            outlet_id: outletId,
            status: 'ALPA'
          }));

          const { error: alpaError } = await insforge
            .from('attendance_logs')
            .insert(alpaRecords);

          if (alpaError) throw alpaError;
        }
      }

      return new Response(JSON.stringify({ success: true, cycle }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });

    } else {
      throw new Error(`Invalid action: ${action}`);
    }

  } catch (error) {
    const err = error as Error;
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
}
