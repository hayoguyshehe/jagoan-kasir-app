import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@insforge/sdk';

interface CycleRequest {
  action: 'clock_in' | 'clock_out' | 'close_store';
  outletId: string;
  userId: string;
  openingCash?: number;
  photoUrl?: string;
  notes?: string;
  cycleId?: string;
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

    const { data: { user }, error: authError } = await insforge.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const body: CycleRequest = await req.json();
    const { action, outletId, userId, openingCash, photoUrl, notes, cycleId } = body;

    if (!action || !outletId || !userId) {
      throw new Error("action, outletId, and userId are required");
    }

    if (action === 'clock_in') {
      let activeCycleId;
      const { data: existingCycle, error: checkError } = await insforge
        .from('business_cycles')
        .select('id')
        .eq('outlet_id', outletId)
        .eq('status', 'ACTIVE')
        .maybeSingle();

      if (checkError) throw checkError;

      if (!existingCycle) {
        const { data: newCycle, error: createError } = await insforge
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

      const { data: existingLog } = await insforge
        .from('attendance_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('cycle_id', activeCycleId)
        .is('clock_out_at', null)
        .maybeSingle();

      if (existingLog) {
        throw new Error("User is already clocked in for this cycle.");
      }

      const { data: attData, error: attError } = await insforge
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

      return NextResponse.json({ success: true, cycle_id: activeCycleId, attendance: attData }, { status: 200, headers: corsHeaders });

    } else if (action === 'clock_out') {
      const { data: activeLog, error: logError } = await insforge
        .from('attendance_logs')
        .select('id, cycle_id')
        .eq('user_id', userId)
        .eq('outlet_id', outletId)
        .is('clock_out_at', null)
        .maybeSingle();

      if (logError) throw logError;
      if (!activeLog) throw new Error("No active clock-in found for this user.");

      const { data: outData, error: outError } = await insforge
        .from('attendance_logs')
        .update({
          clock_out_at: new Date().toISOString()
        })
        .eq('id', activeLog.id)
        .select()
        .single();

      if (outError) throw outError;

      return NextResponse.json({ success: true, attendance: outData }, { status: 200, headers: corsHeaders });

    } else if (action === 'close_store') {
      if (!cycleId) throw new Error("cycleId is required to close store");

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

      const { error: attError } = await insforge
        .from('attendance_logs')
        .update({
          clock_out_at: new Date().toISOString(),
          status: 'AUTO_CLOCKED_OUT'
        })
        .eq('cycle_id', cycleId)
        .is('clock_out_at', null);

      if (attError) throw attError;

      const { data: activeStaff } = await insforge
        .from('users')
        .select('id')
        .eq('outlet_id', outletId)
        .eq('role', 'STAFF')
        .eq('is_active', true);

      if (activeStaff && activeStaff.length > 0) {
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

      return NextResponse.json({ success: true, cycle }, { status: 200, headers: corsHeaders });

    } else {
      throw new Error(`Invalid action: ${action}`);
    }

  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 400, headers: corsHeaders });
  }
}
