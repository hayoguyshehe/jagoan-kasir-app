/**
 * Jagoan Kasir — Shared Types
 * Derived from PRD v2.2 Section 4: Data Model
 */

// =============================================
// Enums (PRD Section 4 — Enums)
// =============================================

export type ServeType = 'HOT' | 'COLD' | 'BOTH';

export type ProductType = 'MENU' | 'ACCESSORY' | 'MATERIAL';

export type AttendanceStatus = 'HADIR' | 'ALPA' | 'AUTO_CLOCKED_OUT' | 'IZIN' | 'SAKIT';

export type CycleStatus = 'ACTIVE' | 'CLOSED';

export type PaymentMethod = 'CASH' | 'QRIS_STATIC';

export type AdjustmentType = 'RESTOCK' | 'DAMAGE' | 'LOSS' | 'CORRECTION';

export type UserRole = 'OWNER' | 'ADMIN' | 'STAFF';

export type TransactionStatus = 'COMPLETED' | 'VOIDED';

// =============================================
// Database Table Types (PRD Section 4 — Tabel Kunci)
// =============================================

export interface Outlet {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  outlet_id: string;
  name: string;
  email: string | null;
  role: UserRole;
  pin: string | null;         // Hashed, for STAFF (PRD: PIN diatur oleh Admin/Owner)
  password: string | null;    // Hashed, for ADMIN/OWNER
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Product — PRD Section 4:
 * - product_type: MENU/ACCESSORY/MATERIAL
 * - serve_type: HOT/COLD/BOTH
 * - stock: INTEGER, bisa negatif (PRD A2: Izin Stok Minus)
 * - Kasir hanya tampilkan MENU + ACCESSORY (MATERIAL disembunyikan)
 */
export interface Product {
  id: string;
  outlet_id: string;
  name: string;
  price: number;
  product_type: ProductType;
  serve_type: ServeType;
  stock: number;              // Bisa minus (PRD A2)
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * ProductRecipe (BOM) — PRD Section 4:
 * - product_id: FK to Product (MENU)
 * - material_id: FK to Product (MATERIAL/ACCESSORY)
 * - quantity: Jumlah bahan per 1 porsi
 * - serve_type: HOT/COLD/null (conditional recipe per serve type)
 */
export interface ProductRecipe {
  id: string;
  product_id: string;         // FK → Product (type MENU)
  material_id: string;        // FK → Product (type MATERIAL/ACCESSORY)
  quantity: number;
  serve_type: 'HOT' | 'COLD' | null;  // null = untuk semua serve type
  created_at: string;
  updated_at: string;
}

/**
 * BusinessCycle — PRD Section 4:
 * Siklus operasional harian kedai
 */
export interface BusinessCycle {
  id: string;
  outlet_id: string;
  opened_by: string;          // FK → User
  closed_by: string | null;   // FK → User
  opened_at: string;
  closed_at: string | null;
  status: CycleStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * AttendanceLog — PRD Section A1:
 * Absensi staf dengan foto dan PIN
 */
export interface AttendanceLog {
  id: string;
  cycle_id: string;           // FK → BusinessCycle
  user_id: string;            // FK → User (STAFF)
  outlet_id: string;
  status: AttendanceStatus;
  clock_in_at: string | null;
  clock_out_at: string | null;
  photo_url: string | null;   // Photo attendance (compressed < 50KB)
  created_at: string;
  updated_at: string;
}

/**
 * Transaction — PRD Section 4:
 * Transaksi POS
 */
export interface Transaction {
  id: string;
  cycle_id: string;           // FK → BusinessCycle
  staff_id: string;           // FK → User (STAFF)
  outlet_id: string;
  total_amount: number;
  payment_method: PaymentMethod;
  status: TransactionStatus;
  void_reason: string | null;
  voided_by: string | null;   // FK → User (who authorized void)
  voided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionItem {
  id: string;
  transaction_id: string;     // FK → Transaction
  product_id: string;         // FK → Product
  product_name: string;       // Snapshot nama produk saat transaksi
  quantity: number;
  price: number;              // Snapshot harga saat transaksi
  serve_type: 'HOT' | 'COLD' | null;
  subtotal: number;
  created_at: string;
}

/**
 * StockAdjustmentLog — PRD Section 4:
 * Log audit koreksi stok admin (Stok Opname)
 */
export interface StockAdjustmentLog {
  id: string;
  product_id: string;         // FK → Product
  outlet_id: string;
  adjusted_by: string;        // FK → User (ADMIN/OWNER)
  old_stock: number;
  new_stock: number;
  adjustment_type: AdjustmentType;
  reason: string | null;
  date: string;
  created_at: string;
}
