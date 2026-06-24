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
