-- =============================================
-- Jagoan Kasir — Migration 002: Staff Schedules
-- PRD v2.3: Jadwal Kerja Staff Bulanan
-- =============================================

CREATE TABLE staff_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  schedule_date DATE NOT NULL,
  shift_start TIME,
  shift_end TIME,
  is_off BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 1 staff hanya bisa punya 1 jadwal per tanggal per outlet
  UNIQUE(user_id, outlet_id, schedule_date)
);

CREATE INDEX idx_staff_schedules_user_id ON staff_schedules(user_id);
CREATE INDEX idx_staff_schedules_outlet_id ON staff_schedules(outlet_id);
CREATE INDEX idx_staff_schedules_date ON staff_schedules(schedule_date);

CREATE TRIGGER set_updated_at_staff_schedules
  BEFORE UPDATE ON staff_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read schedules"
  ON staff_schedules FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Owner or Admin can insert schedules"
  ON staff_schedules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()
      AND role IN ('OWNER', 'ADMIN')
    )
  );

CREATE POLICY "Owner or Admin can update schedules"
  ON staff_schedules FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()
      AND role IN ('OWNER', 'ADMIN')
    )
  );

CREATE POLICY "Owner or Admin can delete schedules"
  ON staff_schedules FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()
      AND role IN ('OWNER', 'ADMIN')
    )
  );
