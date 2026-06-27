// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";

interface CycleRequest {
  action: 'clock_in' | 'clock_out' | 'close_store';
  outletId: string;
  userId: string;
  openingCash?: number;
  photoUrl?: string;
  notes?: string;
  cycleId?: string; // required if action === 'close_store'
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

    const supabase = createClient(supabaseUrl, );

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const { action, outletId, userId, openingCash, photoUrl, notes, cycleId }: CycleRequest = await req.json();

    if (!action || !outletId || !userId) {
      throw new Error("action, outletId, and userId are required");
    }

    if (action === 'clock_in') {
      // 1. Check if there's an ACTIVE cycle for this outlet
      let activeCycleId;
      const { data: existingCycle, error: checkError } = await supabase
        .from('business_cycles')
        .select('id')
        .eq('outlet_id', outletId)
        .eq('status', 'ACTIVE')
        .maybeSingle();

      if (checkError) throw checkError;

      if (!existingCycle) {
        // Create new cycle (Open Store)
        const { data: newCycle, error: createError } = await supabase
          .from('business_cycles')
          .insert({
            outlet_id: outletId,
            opened_by: userId,
            status: 'ACTIVE',
            notes: `Opened with cash: ${openingCash || 0}`
          })
          .select('id')
          .single();

        if (createError) throw createError;
        activeCycleId = newCycle.id;
      } else {
        activeCycleId = existingCycle.id;
      }

      // 2. Clock in the user
      // Check if already clocked in
      const { data: existingLog } = await supabase
        .from('attendance_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('cycle_id', activeCycleId)
        .is('clock_out_at', null)
        .maybeSingle();

      if (existingLog) {
        throw new Error("User is already clocked in for this cycle.");
      }

      const { data: attData, error: attError } = await supabase
        .from('attendance_logs')
        .insert({
          cycle_id: activeCycleId,
          user_id: userId,
          outlet_id: outletId,
          status: 'HADIR',
          clock_in_at: new Date().toISOString(),
          photo_url: photoUrl || null,
        })
        .select()
        .single();

      if (attError) throw attError;

      return new Response(JSON.stringify({ success: true, cycle_id: activeCycleId, attendance: attData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });

    } else if (action === 'clock_out') {
      // Find active attendance log
      const { data: activeLog, error: logError } = await supabase
        .from('attendance_logs')
        .select('id, cycle_id')
        .eq('user_id', userId)
        .eq('outlet_id', outletId)
        .is('clock_out_at', null)
        .maybeSingle();

      if (logError) throw logError;
      if (!activeLog) throw new Error("No active clock-in found for this user.");

      // Update clock out
      const { data: outData, error: outError } = await supabase
        .from('attendance_logs')
        .update({
          clock_out_at: new Date().toISOString()
        })
        .eq('id', activeLog.id)
        .select()
        .single();

      if (outError) throw outError;

      return new Response(JSON.stringify({ success: true, attendance: outData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });

    } else if (action === 'close_store') {
      if (!cycleId) throw new Error("cycleId is required to close store");

      // 1. Close cycle
      const { data: cycle, error: cycleError } = await supabase
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
      const { error: attError } = await supabase
        .from('attendance_logs')
        .update({
          clock_out_at: new Date().toISOString(),
          status: 'AUTO_CLOCKED_OUT'
        })
        .eq('cycle_id', cycleId)
        .is('clock_out_at', null);

      if (attError) throw attError;

      // 3. Mark ALPA for staff who didn't clock in at all
      const { data: activeStaff } = await supabase
        .from('users')
        .select('id')
        .eq('outlet_id', outletId)
        .eq('role', 'STAFF')
        .eq('is_active', true);

      if (activeStaff && activeStaff.length > 0) {
        const { data: clockedInStaff } = await supabase
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

          const { error: alpaError } = await supabase
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
