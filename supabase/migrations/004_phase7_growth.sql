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
