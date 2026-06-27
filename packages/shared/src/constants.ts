/**
 * Jagoan Kasir — Shared Constants
 * Derived from PRD v2.2
 */

// =============================================
// Business Rules (from PRD)
// =============================================

/** PRD A1: Idle timeout sebelum auto-lock (dalam milidetik) */
export const IDLE_TIMEOUT_MS = 7 * 60 * 1000; // 7 menit

/** PRD A1: Throttle limit untuk reset idle timer */
export const IDLE_THROTTLE_MS = 2000; // 2 detik

/** PRD A3: Grace period untuk void tanpa PIN admin (dalam milidetik) */
export const VOID_GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 menit

/** PRD A1: Maksimal ukuran foto attendance */
export const MAX_PHOTO_SIZE_KB = 50;

/** PRD A2: Serve type yang memerlukan pemilihan */
export const SERVE_TYPE_REQUIRES_CHOICE = 'BOTH';

// =============================================
// Brand Configuration
// =============================================

export interface BrandConfig {
  name: string;
  slug: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export const BRANDS: Record<string, BrandConfig> = {
  tehmaestro: {
    name: 'Teh Maestro',
    slug: 'tehmaestro',
    primaryColor: '#D4A574',
    secondaryColor: '#8B6914',
    logoUrl: '/brands/tehmaestro/logo.svg',
    supabaseUrl: '', // Set via .env
    supabaseAnonKey: '', // Set via .env
  },
  '2trees': {
    name: '2 Trees Coffee',
    slug: '2trees',
    primaryColor: '#2D5016',
    secondaryColor: '#4A7C23',
    logoUrl: '/brands/2trees/logo.svg',
    supabaseUrl: '', // Set via .env
    supabaseAnonKey: '', // Set via .env
  },
};

// =============================================
// Role Permissions (PRD Section 3)
// =============================================

export const PERMISSIONS = {
  // Transaksi POS & Void (< 5 Menit)
  POS_TRANSACTION: ['STAFF', 'ADMIN', 'OWNER'],
  VOID_SELF: ['STAFF', 'ADMIN', 'OWNER'],     // < 5 min, own PIN
  VOID_ADMIN: ['ADMIN', 'OWNER'],              // > 5 min, admin PIN

  // Manajemen PIN & Password
  CHANGE_STAFF_PIN: ['ADMIN', 'OWNER'],         // PRD: Staf tidak bisa ubah PIN sendiri
  CHANGE_ADMIN_PASSWORD: ['OWNER'],              // PRD: Hanya Owner

  // Stok Opname & BOM
  STOCK_OPNAME: ['ADMIN', 'OWNER'],
  MANAGE_BOM: ['ADMIN', 'OWNER'],

  // Manajemen Outlet
  MANAGE_OUTLETS: ['OWNER'],

  // Dashboard Access
  DASHBOARD_ACCESS: ['ADMIN', 'OWNER'],          // PRD: Staf tidak bisa akses dashboard
} as const;

// =============================================
// Product Type Display Rules (PRD A2)
// =============================================

/** PRD A2: Katalog kasir hanya menampilkan MENU dan ACCESSORY */
export const KASIR_VISIBLE_PRODUCT_TYPES = ['MENU', 'ACCESSORY'] as const;

/** PRD A2: MATERIAL disembunyikan dari kasir */
export const KASIR_HIDDEN_PRODUCT_TYPES = ['MATERIAL'] as const;
