-- =============================================
-- Jagoan Kasir - Migration 006: Bug Fixes (Security & Integrity)
-- =============================================

-- 1. Fix Staff Schedules RLS (Admin should only manage their outlet)
DROP POLICY IF EXISTS "Owner or Admin can insert schedules" ON staff_schedules;
DROP POLICY IF EXISTS "Owner or Admin can update schedules" ON staff_schedules;
DROP POLICY IF EXISTS "Owner or Admin can delete schedules" ON staff_schedules;

CREATE POLICY "Owner can manage all schedules"
  ON staff_schedules FOR ALL
  TO authenticated
  USING (
    get_auth_user_role() = 'OWNER'
  );

CREATE POLICY "Admin can insert schedules in their outlet"
  ON staff_schedules FOR INSERT
  TO authenticated
  WITH CHECK (
    get_auth_user_role() = 'ADMIN' AND
    outlet_id = get_auth_user_outlet_id()
  );

CREATE POLICY "Admin can update schedules in their outlet"
  ON staff_schedules FOR UPDATE
  TO authenticated
  USING (
    get_auth_user_role() = 'ADMIN' AND
    outlet_id = get_auth_user_outlet_id()
  );

CREATE POLICY "Admin can delete schedules in their outlet"
  ON staff_schedules FOR DELETE
  TO authenticated
  USING (
    get_auth_user_role() = 'ADMIN' AND
    outlet_id = get_auth_user_outlet_id()
  );


-- 2. Fix Vouchers RLS (Owner was locked out if outlet_id check failed)
DROP POLICY IF EXISTS "Admin/Owner can manage vouchers" ON vouchers;

CREATE POLICY "Owner can manage all vouchers" 
  ON vouchers FOR ALL 
  TO authenticated
  USING (get_auth_user_role() = 'OWNER');

CREATE POLICY "Admin can manage vouchers in their outlet" 
  ON vouchers FOR ALL 
  TO authenticated
  USING (
    get_auth_user_role() = 'ADMIN' AND 
    outlet_id = get_auth_user_outlet_id()
  );


-- 3. Prevent multiple ACTIVE business cycles per outlet
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_cycle 
  ON business_cycles (outlet_id) 
  WHERE status = 'ACTIVE'::cycle_status;
