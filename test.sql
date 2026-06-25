CREATE UNIQUE INDEX idx_unique_active_cycle ON business_cycles (outlet_id) WHERE status = 'ACTIVE'::cycle_status;
