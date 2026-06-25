const { execSync } = require('child_process');

const queries = [
  "CREATE TABLE IF NOT EXISTS security_logs (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE, staff_id UUID REFERENCES users(id) ON DELETE CASCADE, attempted_name VARCHAR(255), event_type VARCHAR(50) NOT NULL, device_info TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());",
  "ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;",
  "CREATE POLICY \"Admin/Owner can view security logs\" ON security_logs FOR SELECT TO authenticated USING (get_auth_user_role() IN ('ADMIN', 'OWNER') AND outlet_id = get_auth_user_outlet_id());",
  "CREATE POLICY \"Anyone can insert security logs\" ON security_logs FOR INSERT TO anon, authenticated WITH CHECK (true);"
];

queries.forEach(q => {
  try {
    console.log(execSync('npx @insforge/cli db query ' + JSON.stringify(q)).toString());
  } catch(e) {
    console.error(e.stderr.toString());
  }
});
