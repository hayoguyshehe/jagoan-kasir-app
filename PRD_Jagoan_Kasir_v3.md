# Jagoan Kasir — Product Requirements Document

**Versi:** 3.0 (Sinkronisasi Codebase + Roadmap Fitur Baru)  
**Tanggal:** 25 Juni 2026  
**Status:** Draft — Menunggu Approval

---

## 1. Overview & Arsitektur Bisnis

Jagoan Kasir adalah aplikasi Point of Sale (POS) berarsitektur **White-Label SaaS** untuk kedai minuman, warung, dan kafe. Platform ini dirancang menggunakan **1 Repositori (Single Codebase)** yang dikonfigurasi via `.env` untuk dideploy secara independen bagi setiap brand. Mendukung perangkat Android (Capacitor.js APK) dan Web Dashboard. Aplikasi bersifat **Dual-Mode** — bisa digunakan **full online** maupun **full offline** dengan sinkronisasi otomatis.

### Implementasi Inisial (Isolasi Data Penuh)

- **Brand A (Teh Maestro):** 1 Database InsForge Terisolasi, 1 Web Dashboard (Vercel), 1 APK Android.
- **Brand B (2 Trees Coffee):** 1 Database InsForge Terisolasi, 1 Web Dashboard (Vercel), 1 APK Android.

---

## 2. Tech Stack & Infrastruktur

| Komponen | Teknologi | Deployment |
|---|---|---|
| **Kasir (Staff)** | React 18, Vite, Capacitor.js, Tailwind CSS, Zustand, **Dexie.js** (IndexedDB) | APK Android (Capacitor) + PWA di Vercel |
| **Dashboard (Admin/Owner)** | Next.js 14, shadcn/ui, Tailwind CSS, Recharts | Vercel |
| **Backend** | InsForge (BaaS) — PostgreSQL, Auth, Edge Functions, Storage, RLS | InsForge Cloud |
| **Shared Packages** | `@jagoan-kasir/shared` — Types, Constants, Enums | Monorepo (`packages/shared`) |
| **Edge Functions** | `process-transaction`, `void-transaction`, `manage-business-cycle`, `stock-opname` | InsForge Edge Functions |

### Konfigurasi `.env` per Brand

**Kasir App** (`kasir-app/.env.local`):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_BRAND_SLUG`, `VITE_BRAND_NAME`, `VITE_PRIMARY_COLOR`
- `VITE_LOGO_URL`, `VITE_LOGIN_BG_IMAGE`
- `VITE_OUTLET_QRIS_IMAGE` *(baru — gambar QR Code QRIS statis)*

**Dashboard** (`dashboard/.env.local`):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_BRAND_SLUG`, `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_PRIMARY_COLOR`
- `NEXT_PUBLIC_LOGO_URL`, `NEXT_PUBLIC_LOGIN_BG_IMAGE`

---

## 3. Role & Permission Matrix

| Fitur/Modul | Kasir (Staff) | Admin (Outlet) | Owner (Brand) |
|---|---|---|---|
| Transaksi POS & Void (< 5 Menit) | ✅ (PIN Sendiri) | ✅ | ✅ |
| Void Transaksi (> 5 Menit) | ⚠️ PIN Admin | ✅ | ✅ |
| Ubah PIN Kasir / Staff | ❌ | ✅ | ✅ |
| Ubah Password Admin | ❌ | ❌ | ✅ |
| Stok Opname & BOM | ❌ | ✅ (pilih outlet) | ✅ (pilih outlet) |
| CRUD Produk (Dashboard) | ❌ | ✅ (pilih outlet) | ✅ (pilih outlet) |
| Jadwal Kerja Staff | ❌ | ✅ (pilih outlet) | ✅ (semua outlet) |
| Manajemen Outlet (Settings) | ❌ | ❌ | ✅ |
| Activate/Deactivate Staff | ❌ | ❌ | ✅ |
| Lihat Laporan Keuangan | ❌ | ✅ (outlet sendiri) | ✅ (semua outlet) |
| Export Laporan CSV/PDF | ❌ | ✅ | ✅ |

---

## 4. Data Model

Setiap database brand terisolasi penuh. Relasi antar outlet menggunakan `outlet_id`.

### Enums

| Enum | Values |
|---|---|
| `ServeType` | `HOT`, `COLD`, `BOTH` |
| `ProductType` | `MENU`, `ACCESSORY`, `MATERIAL` |
| `AttendanceStatus` | `HADIR`, `ALPA`, `AUTO_CLOCKED_OUT`, `IZIN`, `SAKIT` |
| `CycleStatus` | `ACTIVE`, `CLOSED` |
| `PaymentMethod` | `CASH`, `QRIS_STATIC` |
| `AdjustmentType` | `RESTOCK`, `DAMAGE`, `LOSS`, `CORRECTION` |
| `UserRole` | `OWNER`, `ADMIN`, `STAFF` |
| `TransactionStatus` | `COMPLETED`, `VOIDED` |

### Tabel Database

| Tabel | Kolom Kunci | Catatan |
|---|---|---|
| `outlets` | `id`, `name`, `address`, `phone`, `is_active` | Kedai / cabang |
| `users` | `id`, `outlet_id`, `name`, `email`, `role`, `pin`, `is_active` | Staff/Admin/Owner |
| `products` | `id`, `outlet_id`, `name`, `price`, `product_type`, `serve_type`, `stock`, `image_url` | Stok bisa negatif |
| `product_recipes` | `id`, `product_id`, `material_id`, `quantity`, `serve_type` | BOM (Bill of Materials) |
| `business_cycles` | `id`, `outlet_id`, `opened_by`, `closed_by`, `status` | Siklus buka/tutup kedai |
| `attendance_logs` | `id`, `cycle_id`, `user_id`, `outlet_id`, `status`, `photo_url` | Absensi + selfie |
| `transactions` | `id`, `cycle_id`, `staff_id`, `outlet_id`, `total_amount`, `payment_method`, `status`, `discount_amount`, `tax_amount` | Transaksi POS |
| `transaction_items` | `id`, `transaction_id`, `product_id`, `product_name`, `quantity`, `price`, `serve_type`, `subtotal` | Detail item |
| `stock_adjustment_logs` | `id`, `product_id`, `outlet_id`, `adjusted_by`, `old_stock`, `new_stock`, `adjustment_type` | Audit stok opname |
| `staff_schedules` | `id`, `user_id`, `outlet_id`, `schedule_date`, `shift_start`, `shift_end`, `is_off`, `notes` | Jadwal kerja bulanan |

---

## 5. Fungsionalitas Modul — Status Implementasi

> Legend: ✅ = Sudah diimplementasi | ⏳ = Belum / Sebagian | 🆕 = Fitur baru

### MODUL A — KASIR (APK + PWA)

#### A1. Login & Autentikasi
| Fitur | Status | Detail |
|---|---|---|
| Login Nama Panggilan + PIN (Alias Login) | ✅ | `Login.tsx` (Bypass email di UI, tetap menggunakan Auth Server) |
| Validasi role (Staff saja, Owner ditolak) | ✅ | Mengecek `users.role` dan `is_active` |
| UI Login split-view (gambar kanan, form kiri) | ✅ | Gambar dikonfigurasi via `VITE_LOGIN_BG_IMAGE` |
| Keamanan Perangkat (Deteksi Login Ilegal) | ✅ | Verifikasi `device_id` lokal, catat ke `security_logs` |
| Auto-lock layar setelah idle 7 menit + PIN Unlock | ✅ | Komponen `LockScreen.tsx` (Timer reset via interaksi DOM) |

#### A2. Transaksi POS
| Fitur | Status | Detail |
|---|---|---|
| Menampilkan katalog produk (MENU + ADDON) | ✅ | `POS.tsx`, filter `is_active` |
| Keranjang belanja (Zustand) | ✅ | `useCartStore.ts` |
| Proses transaksi via Edge Function | ✅ | `process-transaction/index.ts` |
| Auto-deduct stok produk + BOM | ✅ | Di Edge Function |
| Izin stok negatif (soft warning) | ⏳ | Stok bisa minus di DB, UI belum ada warning |
| Pilih Serve Type (Hot/Cold) saat produk `BOTH` | ⏳ | Hardcoded `'HOT'` — modal picker belum ada |
| Pilih Metode Pembayaran (CASH / QRIS) | ⏳ | Hardcoded `'CASH'` — UI belum ada |
| Input nominal bayar + hitung kembalian | ⏳ | Belum ada |
| Diskon per transaksi (nominal / %) | ⏳ 🆕 | `discountAmount: 0` hardcoded |
| Split-screen layout (Desktop/Tablet) | ✅ | Menu kiri, invoice kanan |
| Responsive (Mobile bottom-sheet cart) | ✅ | Floating cart button + modal |

#### A3. Struk / Receipt 🆕
| Fitur | Status | Detail |
|---|---|---|
| Tampilkan struk visual setelah transaksi | ⏳ | Hanya `alert()` saat ini |
| Cetak struk ke printer Bluetooth thermal | ✅ | Berbasis HTML Web Print (58mm) di `History.tsx` |
| Kirim struk via WhatsApp (share gambar) | ⏳ | Belum diimplementasi |
| Cetak ulang struk dari riwayat | ✅ | Modul `printReceipt` via iframe |
| Kustomisasi header struk (nama toko, alamat, telp) | ⏳ | Akan dari `.env` + DB outlet |

#### A4. Riwayat Transaksi & Void
| Fitur | Status | Detail |
|---|---|---|
| Daftar riwayat transaksi per staff | ✅ | `History.tsx` — 20 transaksi terakhir |
| Void transaksi (with PIN & reason) | ✅ | Via Edge Function `void-transaction` |
| Grace period < 5 min (PIN kasir) vs > 5 min (PIN admin) | ⏳ | Logika ada di constants, belum di UI |
| Tampilkan detail item per transaksi | ⏳ | History hanya tampil total |

#### A5. Shift / Absensi
| Fitur | Status | Detail |
|---|---|---|
| Clock-in dengan selfie + opening cash | ✅ | `Shift.tsx` — camera via browser API. Otomatis Buka Toko jika staf pertama. |
| Clock-out (tutup shift) | ✅ | Via Edge Function `manage-business-cycle`. |
| Upload foto ke storage | ✅ | Diupload ke bucket `foto` via SDK di `Shift.tsx`. |
| Tutup Kedai (Force clock-out) | ✅ | Via Edge Function `close_store` action. |

#### A6. Mode Offline (Dual-Mode) 🆕
| Fitur | Status | Detail |
|---|---|---|
| Deteksi status koneksi (online/offline) | ⏳ | Belum ada |
| Simpan transaksi offline ke IndexedDB (Dexie.js) | ⏳ | Belum ada |
| Auto-sync ke server saat koneksi pulih | ⏳ | Belum ada |
| Cache data produk & stok lokal | ⏳ | Belum ada |
| Indikator visual online/offline di UI | ⏳ | Belum ada |
| Antrian transaksi pending (dengan retry) | ⏳ | Belum ada |

---

### MODUL B & C — WEB DASHBOARD (ADMIN & OWNER)

#### B1. Dashboard Overview
| Fitur | Status | Detail |
|---|---|---|
| Card statistik (Revenue, Transaksi, Produk, Staff) | ✅ | `page.tsx` |
| Chart revenue harian (Recharts BarChart) | ✅ | Grouped by date |
| Outlet selector wajib | ⏳ | Belum ada dropdown outlet |

#### B2. Manajemen Produk
| Fitur | Status | Detail |
|---|---|---|
| CRUD Produk (nama, harga, tipe, serve type, stok) | ✅ | `products/page.tsx` |
| Upload foto produk | ✅ | Upload via Storage Bucket `foto/products` |
| Filter produk by outlet | ⏳ | Belum ada outlet selector |

#### B3. Manajemen Resep / BOM
| Fitur | Status | Detail |
|---|---|---|
| CRUD Resep (produk -> bahan, qty, serve_type) | ✅ | `recipes/page.tsx` |
| Auto-deduct saat transaksi | ✅ | Di Edge Function |

#### B4. Stok Opname
| Fitur | Status | Detail |
|---|---|---|
| Koreksi stok (RESTOCK, DAMAGE, LOSS, CORRECTION) | ✅ | `stock-opname/page.tsx` (Insert DB dilindungi RLS, aman dan cepat) |
| Log audit koreksi | ✅ | `stock_adjustment_logs` table |

#### B5. Manajemen Staff & Keamanan
| Fitur | Status | Detail |
|---|---|---|
| Daftar staff (nama, email, role, status) | ✅ | `staff/page.tsx` |
| Activate/Deactivate staff | ✅ | Toggle `is_active` |
| Set/Reset PIN staff & Alias Generation | ✅ | Menggunakan Edge Function `manage-users` |
| Security Alerts (Peringatan Login Perangkat) | ✅ | `security_logs` view di Dashboard |

#### B6. Jadwal Kerja Staff
| Fitur | Status | Detail |
|---|---|---|
| Buat jadwal bulanan per staff per outlet | ✅ | `staff-schedules/page.tsx` |
| Shift start/end, hari libur, catatan | ✅ | Full CRUD |
| 1 staff bisa di beberapa outlet per hari | ✅ | Sesuai PRD |

#### B7. Riwayat Transaksi
| Fitur | Status | Detail |
|---|---|---|
| Tabel transaksi (tanggal, staff, total, status) | ✅ | `transactions/page.tsx` |
| Void transaksi dari dashboard | ✅ | Dialog + Edge Function `void-transaction` |
| Detail item per transaksi | ✅ | Tampilan *expand row / accordion* |

#### B8. Manajemen Outlet (Settings)
| Fitur | Status | Detail |
|---|---|---|
| CRUD Outlet (nama, alamat, telepon) | ✅ | `settings/page.tsx` |
| Hanya Owner yang bisa mengelola | ✅ | Role check di UI |

#### B9. Laporan Keuangan 🆕
| Fitur | Status | Detail |
|---|---|---|
| Laporan penjualan harian (filter tanggal, outlet, staff) | ⏳ | Belum ada halaman tersendiri |
| Laporan produk terlaris (ranking by qty sold) | ⏳ | Belum ada |
| Laporan laba rugi (revenue - HPP dari BOM) | ⏳ | Belum ada |
| Ringkasan shift (per business cycle) | ⏳ | Belum ada |
| Export ke CSV / Excel | ⏳ | Belum ada |
| Cetak ringkasan ke printer / PDF | ⏳ | Belum ada |

---

## 6. Arsitektur Dual-Mode (Online + Offline)

Aplikasi kasir WAJIB bisa digunakan dalam dua kondisi:

### Mode Online (Default)
- Semua transaksi langsung dikirim ke InsForge via Edge Function
- Data produk, stok, dan harga selalu up-to-date dari server
- Struk bisa dikirim via WhatsApp secara real-time

### Mode Offline (Fallback Otomatis)
- **Deteksi:** `navigator.onLine` + heartbeat ping ke server
- **Penyimpanan Lokal:** Dexie.js (IndexedDB) menyimpan:
  - Cache produk & harga (di-refresh setiap kali online)
  - Antrian transaksi pending
  - Data stok lokal (estimasi, di-reconcile saat sync)
- **Sync Strategy:**
  - Koneksi pulih -> flush semua transaksi pending ke server secara berurutan
  - Konflik stok diselesaikan oleh server (server = source of truth)
  - Notifikasi UI saat sync berhasil/gagal
- **Batasan Offline:**
  - Void transaksi TIDAK bisa dilakukan offline (butuh verifikasi PIN real-time)
  - Data stok lokal bersifat estimasi (bisa berbeda dengan server)
  - Login pertama kali HARUS online (untuk autentikasi)

### Flow Offline Transaction
```
[Kasir tap "Order"]
  -> Cek koneksi?
    -> ONLINE: Kirim ke Edge Function (seperti biasa)
    -> OFFLINE:
      1. Simpan ke Dexie.js dengan status "PENDING_SYNC"
      2. Kurangi stok lokal (estimasi)
      3. Tampilkan struk dengan watermark "OFFLINE"
      4. Tambahkan ke antrian sync
  -> Koneksi pulih?
    -> Auto-flush antrian -> Update status "SYNCED"
    -> Reconcile stok dengan server
```

---

## 7. Cetak Struk / Receipt

### Strategi Multi-Channel
| Channel | Teknologi | Kapan Digunakan |
|---|---|---|
| **Tampil di layar** | React component (struk visual) | Selalu — setelah setiap transaksi |
| **Printer Bluetooth** | Capacitor Bluetooth Serial Plugin (ESC/POS) | APK Android + printer thermal 58mm/80mm |
| **WhatsApp** | `html2canvas` -> gambar -> `navigator.share()` / `wa.me` deep link | Pelanggan minta struk digital |
| **Browser Print** | `window.print()` + CSS `@media print` | PWA di browser desktop/tablet |
| **PDF Download** | `html2canvas` + `jsPDF` | Dashboard — cetak ulang dari riwayat |

### Template Struk
```
================================
      [NAMA TOKO dari .env]
     [Alamat dari DB outlet]
      [Telp dari DB outlet]
================================
Tanggal : 25/06/2026 14:30
Kasir   : Budi
No      : TXN-001
================================
Espresso HOT    x2    Rp 30.000
Matcha COLD     x1    Rp 25.000
Croissant       x3    Rp 45.000
--------------------------------
Subtotal            Rp 100.000
Diskon (10%)        Rp -10.000
--------------------------------
TOTAL               Rp  90.000
Bayar (CASH)        Rp 100.000
Kembalian           Rp  10.000
================================
    Terima Kasih!
  [Pesan custom dari .env]
================================
```

---

## 8. Standar Hardware & Komunikasi

- **Printer Thermal:** Bluetooth 58mm/80mm (ESC/POS protocol)
- **Orientasi Layar:** Landscape (dikunci via Capacitor `ScreenOrientation.lock('landscape')`)
- **Offline-Resilient:** Dexie.js (IndexedDB) sebagai queue transaksi offline
- **Target Device:** Tablet Android 10+ (RAM >= 2GB), kompatibel desktop browser

---

## 9. Roadmap Implementasi

### Phase 1 — Fondasi Transaksi ✅ SELESAI
- [x] Halaman sukses transaksi + struk visual di layar
- [x] Kirim struk via WhatsApp (share gambar)
- [x] Pilihan metode pembayaran (CASH + QRIS_STATIC)
- [x] Input nominal bayar + perhitungan kembalian
- [x] Modal pilih Serve Type (Hot/Cold) saat produk `BOTH`
- [x] Diskon per transaksi (nominal / persentase)

### Phase 2 — Laporan & Analitik ✅ SELESAI
- [x] Halaman Laporan Penjualan (filter tanggal/outlet/staff)
- [x] Laporan Produk Terlaris
- [x] Laporan Laba Rugi (Revenue - HPP via BOM)
- [x] Ringkasan per Shift (Business Cycle)
- [x] Export CSV/Excel dari setiap tabel laporan

### Phase 3 — Mode Offline (Dual-Mode) ✅ SELESAI
- [x] Setup Dexie.js + skema IndexedDB lokal
- [x] Cache data produk saat online
- [x] Simpan transaksi offline ke IndexedDB dengan Idempotency UUID
- [x] Silent Auto-sync saat koneksi pulih (flush queue) via `SyncManager`
- [x] Indikator UI online/offline
- [x] PWA Setup (vite-plugin-pwa)

### Phase 4 — Manajemen Staf & Shift ✅ SELESAI
- [x] Logika absensi: Staf pertama yang *Clock In* otomatis membuka toko (Business Cycle).
- [x] Update UI Dashboard untuk Staff Schedules.
- [x] Edge function `manage-business-cycle` menangani `clock_in`, `clock_out`, dan `close_store`.

### Phase 5 — Stok Opname & Void Transaksi ✅ SELESAI
- [x] Stok Opname untuk koreksi inventaris dari Dashboard (Direct DB with RLS)
- [x] Log audit koreksi stok
- [x] Detail item per transaksi di riwayat transaksi (Dashboard & Kasir App)
- [x] Sistem otorisasi Void transaksi (with PIN & reason)

### Phase 6 — Polish & Keamanan ✅ SELESAI
- [x] Auto-lock layar setelah idle 7 menit + PIN unlock
- [x] UI Set/Reset PIN staff dari dashboard (Alias Login)
- [x] Pencatatan Security Log untuk Login dari perangkat asing
- [x] Cetak struk ke printer Bluetooth thermal (berbasis HTML/Web Print)
- [x] Upload foto produk (InsForge Storage)

### Phase 7 — Growth (CURRENT)
- [ ] Database pelanggan (CRM dasar)
- [ ] Loyalty points / membership
- [x] Notifikasi stok menipis
- [ ] QR Order (pelanggan scan QR di meja -> pesan mandiri)
- [x] Diskon per item / voucher / kupon

---

## 10. Catatan Keamanan

- **Kredensial:** Semua kunci InsForge disimpan di `.env.local` (tidak di-commit ke Git).
- **RLS (Row Level Security):** Diaktifkan di semua tabel. Staff hanya bisa akses data outlet miliknya.
- **Edge Functions:** Menggunakan Service Role Key untuk bypass RLS pada operasi kompleks (transaksi multi-tabel). Tetap memverifikasi token user.
- **PIN Staff:** Disimpan dalam bentuk hash. Tidak bisa dilihat oleh Admin/Owner, hanya bisa di-reset.
- **Void:** Membutuhkan alasan wajib + PIN. Grace period 5 menit untuk keamanan.
