


-- 3. Prevent multiple ACTIVE business cycles per outlet
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_cycle 
  ON business_cycles (outlet_id) 
  WHERE status = 'ACTIVE'::cycle_status;