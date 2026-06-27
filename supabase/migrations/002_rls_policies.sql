-- =============================================
-- Jagoan Kasir — RLS Policies
-- =============================================

-- Make public.users.id reference auth.users.id
-- First, ensure the id doesn't default to a new UUID if it's meant to match auth.users
ALTER TABLE users ALTER COLUMN id DROP DEFAULT;
-- Add foreign key constraint to auth.users
ALTER TABLE users ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable RLS on all tables
ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustment_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION get_auth_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to get current user's outlet_id
CREATE OR REPLACE FUNCTION get_auth_user_outlet_id()
RETURNS uuid AS $$
  SELECT outlet_id FROM users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- =============================================
-- POLICIES: Outlets
-- =============================================
-- OWNER: Can do anything
-- ADMIN/STAFF: Can view their own outlet
CREATE POLICY "Owner can do anything on outlets" ON outlets
  FOR ALL USING (get_auth_user_role() = 'OWNER');

CREATE POLICY "Admin and Staff can view their own outlet" ON outlets
  FOR SELECT USING (
    id = get_auth_user_outlet_id()
  );

-- =============================================
-- POLICIES: Users
-- =============================================
-- OWNER: Can manage all users
-- ADMIN: Can manage staff in their outlet
-- STAFF: Can only view themselves
CREATE POLICY "Owner can manage all users" ON users
  FOR ALL USING (get_auth_user_role() = 'OWNER');

CREATE POLICY "Admin can manage staff in their outlet" ON users
  FOR ALL USING (
    get_auth_user_role() = 'ADMIN' 
    AND outlet_id = get_auth_user_outlet_id()
    AND role = 'STAFF'
  );

CREATE POLICY "Admin can view themselves" ON users
  FOR SELECT USING (
    id = auth.uid()
  );

CREATE POLICY "Staff can view themselves" ON users
  FOR SELECT USING (
    id = auth.uid()
  );

-- =============================================
-- POLICIES: Products
-- =============================================
-- OWNER: Can manage all products
-- ADMIN: Can manage products in their outlet
-- STAFF: Can view products in their outlet
CREATE POLICY "Owner can manage all products" ON products
  FOR ALL USING (get_auth_user_role() = 'OWNER');

CREATE POLICY "Admin can manage products in their outlet" ON products
  FOR ALL USING (
    get_auth_user_role() = 'ADMIN' 
    AND outlet_id = get_auth_user_outlet_id()
  );

CREATE POLICY "Staff can view products in their outlet" ON products
  FOR SELECT USING (
    outlet_id = get_auth_user_outlet_id()
  );

-- =============================================
-- POLICIES: Product Recipes
-- =============================================
-- Similar to products, joining through products table
CREATE POLICY "Owner can manage all product_recipes" ON product_recipes
  FOR ALL USING (get_auth_user_role() = 'OWNER');

CREATE POLICY "Admin can manage product_recipes in their outlet" ON product_recipes
  FOR ALL USING (
    get_auth_user_role() = 'ADMIN'
    AND product_id IN (SELECT id FROM products WHERE outlet_id = get_auth_user_outlet_id())
  );

CREATE POLICY "Staff can view product_recipes in their outlet" ON product_recipes
  FOR SELECT USING (
    product_id IN (SELECT id FROM products WHERE outlet_id = get_auth_user_outlet_id())
  );

-- =============================================
-- POLICIES: Business Cycles
-- =============================================
-- OWNER: Manage all
-- ADMIN: Manage in their outlet
-- STAFF: Manage in their outlet (Staff can open/close cycles)
CREATE POLICY "Owner can manage all business_cycles" ON business_cycles
  FOR ALL USING (get_auth_user_role() = 'OWNER');

CREATE POLICY "Admin and Staff can manage business_cycles in their outlet" ON business_cycles
  FOR ALL USING (
    outlet_id = get_auth_user_outlet_id()
  );

-- =============================================
-- POLICIES: Attendance Logs
-- =============================================
-- OWNER: Manage all
-- ADMIN: Manage in their outlet
-- STAFF: Manage their own attendance
CREATE POLICY "Owner can manage all attendance_logs" ON attendance_logs
  FOR ALL USING (get_auth_user_role() = 'OWNER');

CREATE POLICY "Admin can manage attendance_logs in their outlet" ON attendance_logs
  FOR ALL USING (
    get_auth_user_role() = 'ADMIN'
    AND outlet_id = get_auth_user_outlet_id()
  );

CREATE POLICY "Staff can manage their own attendance_logs" ON attendance_logs
  FOR ALL USING (
    user_id = auth.uid()
  );

-- =============================================
-- POLICIES: Transactions & Transaction Items
-- =============================================
-- OWNER: Manage all
-- ADMIN: Manage in their outlet
-- STAFF: Can insert and view transactions in their cycle
CREATE POLICY "Owner can manage all transactions" ON transactions
  FOR ALL USING (get_auth_user_role() = 'OWNER');

CREATE POLICY "Admin can manage transactions in their outlet" ON transactions
  FOR ALL USING (
    get_auth_user_role() = 'ADMIN'
    AND outlet_id = get_auth_user_outlet_id()
  );

CREATE POLICY "Staff can manage transactions in their outlet" ON transactions
  FOR ALL USING (
    outlet_id = get_auth_user_outlet_id()
  );

CREATE POLICY "Owner can manage all transaction_items" ON transaction_items
  FOR ALL USING (get_auth_user_role() = 'OWNER');

CREATE POLICY "Admin can manage transaction_items in their outlet" ON transaction_items
  FOR ALL USING (
    get_auth_user_role() = 'ADMIN'
    AND transaction_id IN (SELECT id FROM transactions WHERE outlet_id = get_auth_user_outlet_id())
  );

CREATE POLICY "Staff can manage transaction_items in their outlet" ON transaction_items
  FOR ALL USING (
    transaction_id IN (SELECT id FROM transactions WHERE outlet_id = get_auth_user_outlet_id())
  );

-- =============================================
-- POLICIES: Stock Adjustment Logs
-- =============================================
-- OWNER: Manage all
-- ADMIN: Manage in their outlet
-- STAFF: Cannot access
CREATE POLICY "Owner can manage all stock_adjustment_logs" ON stock_adjustment_logs
  FOR ALL USING (get_auth_user_role() = 'OWNER');

CREATE POLICY "Admin can manage stock_adjustment_logs in their outlet" ON stock_adjustment_logs
  FOR ALL USING (
    get_auth_user_role() = 'ADMIN'
    AND outlet_id = get_auth_user_outlet_id()
  );
