
-- 001_initial_schema.sql
-- =============================================
-- Jagoan Kasir — Initial Database Schema
-- PRD v2.2 Section 4: Data Model
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ENUMS (PRD Section 4 — Enums)
-- =============================================

CREATE TYPE serve_type AS ENUM ('HOT', 'COLD', 'BOTH');
CREATE TYPE product_type AS ENUM ('MENU', 'ACCESSORY', 'MATERIAL');
CREATE TYPE attendance_status AS ENUM ('HADIR', 'ALPA', 'AUTO_CLOCKED_OUT', 'IZIN', 'SAKIT');
CREATE TYPE cycle_status AS ENUM ('ACTIVE', 'CLOSED');
CREATE TYPE payment_method AS ENUM ('CASH', 'QRIS_STATIC');
CREATE TYPE adjustment_type AS ENUM ('RESTOCK', 'DAMAGE', 'LOSS', 'CORRECTION');
CREATE TYPE user_role AS ENUM ('OWNER', 'ADMIN', 'STAFF');
CREATE TYPE transaction_status AS ENUM ('COMPLETED', 'VOIDED');

-- =============================================
-- TABLES
-- =============================================

-- Outlets (Kedai/Cabang)
CREATE TABLE outlets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users (Owner, Admin, Staff/Kasir)
-- PRD Section 3: Role & Permission Matrix
-- PRD Section B: PIN diatur statis oleh Admin/Owner, Password Admin diatur oleh Owner
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  role user_role NOT NULL DEFAULT 'STAFF',
  pin VARCHAR(255),           -- Hashed PIN for STAFF (PRD: PIN diatur oleh Admin/Owner)
  password VARCHAR(255),      -- Hashed password for ADMIN/OWNER
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products (Produk)
-- PRD Section 4: Product
-- PRD A2: stock bisa negatif (Izin Stok Minus - Soft Warning)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,           -- Harga dalam Rupiah (integer)
  product_type product_type NOT NULL DEFAULT 'MENU',
  serve_type serve_type NOT NULL DEFAULT 'BOTH',
  stock INTEGER NOT NULL DEFAULT 0,           -- PRD A2: Bisa negatif!
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Product Recipes (BOM / Bill of Materials)
-- PRD Section 4: ProductRecipe
-- PRD A2: Auto-Deduct BOM berdasarkan resep
CREATE TABLE product_recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,    -- FK → Product (type MENU)
  material_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,   -- FK → Product (type MATERIAL/ACCESSORY)
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  serve_type serve_type,      -- HOT/COLD/null; null = untuk semua serve type
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Prevent duplicate recipes for same product+material+serve_type
  UNIQUE(product_id, material_id, serve_type)
);

-- Business Cycles (Siklus Operasional Harian)
-- PRD Section 4: BusinessCycle
-- PRD A1: Buka Kedai, Tutup Kedai, Force Clock-Out
CREATE TABLE business_cycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  opened_by UUID NOT NULL REFERENCES users(id),
  closed_by UUID REFERENCES users(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  status cycle_status NOT NULL DEFAULT 'ACTIVE',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Attendance Logs (Absensi Staf)
-- PRD A1: Clock-in/out dengan foto, auto-capture
CREATE TABLE attendance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id UUID NOT NULL REFERENCES business_cycles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  status attendance_status NOT NULL DEFAULT 'HADIR',
  clock_in_at TIMESTAMPTZ,
  clock_out_at TIMESTAMPTZ,
  photo_url TEXT,             -- Photo attendance (compressed < 50KB)
  photo_key TEXT,             -- Storage key for deletion
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transactions (Transaksi POS)
-- PRD Section 4: Transaction
-- PRD A3: Void dengan grace period
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id UUID NOT NULL REFERENCES business_cycles(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES users(id),
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  total_amount INTEGER NOT NULL DEFAULT 0,    -- Rupiah (integer)
  payment_method payment_method NOT NULL DEFAULT 'CASH',
  status transaction_status NOT NULL DEFAULT 'COMPLETED',
  void_reason TEXT,
  voided_by UUID REFERENCES users(id),       -- Who authorized the void
  voided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transaction Items (Detail Item Transaksi)
CREATE TABLE transaction_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name VARCHAR(255) NOT NULL,         -- Snapshot nama produk
  quantity INTEGER NOT NULL DEFAULT 1,
  price INTEGER NOT NULL DEFAULT 0,           -- Snapshot harga saat transaksi
  serve_type serve_type,                      -- HOT/COLD/null
  subtotal INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stock Adjustment Logs (Log Koreksi Stok / Stok Opname)
-- PRD Section 4: StockAdjustmentLog
-- PRD B: Stok Opname untuk koreksi inventaris
CREATE TABLE stock_adjustment_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  adjusted_by UUID NOT NULL REFERENCES users(id),
  old_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  adjustment_type adjustment_type NOT NULL,
  reason TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- INDEXES (Performance)
-- =============================================

CREATE INDEX idx_users_outlet_id ON users(outlet_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);

CREATE INDEX idx_products_outlet_id ON products(outlet_id);
CREATE INDEX idx_products_type ON products(product_type);
CREATE INDEX idx_products_active ON products(is_active);

CREATE INDEX idx_product_recipes_product_id ON product_recipes(product_id);
CREATE INDEX idx_product_recipes_material_id ON product_recipes(material_id);

CREATE INDEX idx_business_cycles_outlet_id ON business_cycles(outlet_id);
CREATE INDEX idx_business_cycles_status ON business_cycles(status);

CREATE INDEX idx_attendance_logs_cycle_id ON attendance_logs(cycle_id);
CREATE INDEX idx_attendance_logs_user_id ON attendance_logs(user_id);
CREATE INDEX idx_attendance_logs_outlet_id ON attendance_logs(outlet_id);

CREATE INDEX idx_transactions_cycle_id ON transactions(cycle_id);
CREATE INDEX idx_transactions_staff_id ON transactions(staff_id);
CREATE INDEX idx_transactions_outlet_id ON transactions(outlet_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

CREATE INDEX idx_transaction_items_transaction_id ON transaction_items(transaction_id);

CREATE INDEX idx_stock_adjustment_logs_product_id ON stock_adjustment_logs(product_id);
CREATE INDEX idx_stock_adjustment_logs_outlet_id ON stock_adjustment_logs(outlet_id);
CREATE INDEX idx_stock_adjustment_logs_date ON stock_adjustment_logs(date);

-- =============================================
-- TRIGGERS (Auto-update updated_at)
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_outlets
  BEFORE UPDATE ON outlets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_users
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_products
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_product_recipes
  BEFORE UPDATE ON product_recipes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_business_cycles
  BEFORE UPDATE ON business_cycles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_attendance_logs
  BEFORE UPDATE ON attendance_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_transactions
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 002_rls_policies.sql
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

-- 003_phase6_security.sql
-- Phase 6: Security Logs

CREATE TABLE IF NOT EXISTS security_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES users(id) ON DELETE CASCADE,
    attempted_name VARCHAR(255),
    event_type VARCHAR(50) NOT NULL,
    device_info TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Owner can view security logs" ON security_logs
  FOR SELECT TO authenticated
  USING (
    get_auth_user_role() IN ('ADMIN', 'OWNER') AND 
    outlet_id = get_auth_user_outlet_id()
  );

-- Anyone can insert so login attempts can log it
CREATE POLICY "Anyone can insert security logs" ON security_logs
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- 003_staff_schedules.sql
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

-- 004_phase7_growth.sql
-- Phase 7: Growth (Diskon & Stok Menipis)

-- 1. Tambahkan kolom low_stock_threshold ke tabel products
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 5;

-- 2. Tambahkan kolom diskon dan voucher ke tabel transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS discount_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS voucher_code VARCHAR(255);

-- 3. Tambahkan kolom diskon ke tabel transaction_items
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS discount_amount INTEGER NOT NULL DEFAULT 0;

-- 4. Buat tabel vouchers
CREATE TYPE voucher_discount_type AS ENUM ('NOMINAL', 'PERCENTAGE');

CREATE TABLE IF NOT EXISTS vouchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    discount_type voucher_discount_type NOT NULL DEFAULT 'NOMINAL',
    discount_value INTEGER NOT NULL, -- Nominal Rp atau Persentase (0-100)
    min_purchase INTEGER NOT NULL DEFAULT 0,
    max_discount INTEGER, -- Limit diskon maksimal untuk tipe PERCENTAGE
    valid_until TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(outlet_id, code)
);

-- RLS untuk tabel vouchers
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Owner can manage vouchers" ON vouchers
  FOR ALL TO authenticated
  USING (
    get_auth_user_role() IN ('ADMIN', 'OWNER') AND 
    outlet_id = get_auth_user_outlet_id()
  );

-- Staff (Kasir) can read active vouchers for their outlet
CREATE POLICY "Staff can view active vouchers" ON vouchers
  FOR SELECT TO authenticated
  USING (
    is_active = true AND 
    outlet_id = get_auth_user_outlet_id()
  );

-- Trigger untuk updated_at
CREATE TRIGGER set_updated_at_vouchers
  BEFORE UPDATE ON vouchers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 005_phase8_reports.sql
-- Phase 8: Reports Optimization

-- 1. Create Indexes for faster filtering on transactions table
CREATE INDEX IF NOT EXISTS idx_transactions_outlet_created 
ON transactions(outlet_id, created_at, status);

-- 2. Create RPC for Sales Report
CREATE OR REPLACE FUNCTION get_sales_report(
  p_outlet_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
) RETURNS JSON AS $$
DECLARE
  v_result JSON;
  v_chart_data JSON;
  v_best_sellers JSON;
  v_stats JSON;
  v_is_monthly BOOLEAN;
BEGIN
  -- Determine grouping (Monthly if > 31 days)
  v_is_monthly := (p_end_date - p_start_date) > interval '31 days';

  -- 1. Get Chart Data (Grouped with Asia/Jakarta timezone)
  IF v_is_monthly THEN
    SELECT COALESCE(json_agg(t), '[]'::json) INTO v_chart_data
    FROM (
      SELECT 
        to_char(timezone('Asia/Jakarta', created_at), 'Mon YYYY') as date,
        min(timezone('Asia/Jakarta', created_at)) as sort_date,
        SUM(total_amount) as revenue,
        COUNT(*) as transactions
      FROM transactions
      WHERE outlet_id = p_outlet_id 
        AND status = 'COMPLETED'
        AND created_at >= p_start_date 
        AND created_at <= p_end_date
      GROUP BY 1
      ORDER BY 2 ASC
    ) t;
  ELSE
    SELECT COALESCE(json_agg(t), '[]'::json) INTO v_chart_data
    FROM (
      SELECT 
        to_char(timezone('Asia/Jakarta', created_at), 'DD Mon') as date,
        min(timezone('Asia/Jakarta', created_at)) as sort_date,
        SUM(total_amount) as revenue,
        COUNT(*) as transactions
      FROM transactions
      WHERE outlet_id = p_outlet_id 
        AND status = 'COMPLETED'
        AND created_at >= p_start_date 
        AND created_at <= p_end_date
      GROUP BY 1
      ORDER BY 2 ASC
    ) t;
  END IF;

  -- 2. Get Best Sellers (Top 50)
  SELECT COALESCE(json_agg(bs), '[]'::json) INTO v_best_sellers
  FROM (
    SELECT 
      ti.product_name as "name",
      ti.serve_type as "serveType",
      SUM(ti.quantity) as qty,
      SUM(ti.subtotal) as revenue
    FROM transactions t
    JOIN transaction_items ti ON t.id = ti.transaction_id
    WHERE t.outlet_id = p_outlet_id
      AND t.status = 'COMPLETED'
      AND t.created_at >= p_start_date 
      AND t.created_at <= p_end_date
    GROUP BY 1, 2
    ORDER BY qty DESC
    LIMIT 50
  ) bs;

  -- 3. Get Overall Stats
  SELECT json_build_object(
    'totalRevenue', COALESCE(SUM(total_amount), 0),
    'totalTransactions', COUNT(*),
    'totalDiscounts', COALESCE(SUM(discount_amount), 0)
  ) INTO v_stats
  FROM transactions
  WHERE outlet_id = p_outlet_id 
    AND status = 'COMPLETED'
    AND created_at >= p_start_date 
    AND created_at <= p_end_date;

  -- Combine into final JSON result
  v_result := json_build_object(
    'chartData', v_chart_data,
    'bestSellers', v_best_sellers,
    'stats', v_stats
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 006_bugfixes.sql
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

