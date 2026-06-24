# Jagoan Kasir — Product Requirements Document

**Versi:** 2.3 (Logic Update: Outlet Selector, PIN Staff, Jadwal Staff)  
**Tanggal:** 25 Juni 2026  
**Status:** Approved & Ready for Dev

---

## 1. Overview & Arsitektur Bisnis

Jagoan Kasir adalah aplikasi Point of Sale (POS) berarsitektur **White-Label SaaS** untuk kedai minuman, warung, dan kafe. Platform ini dirancang menggunakan **1 Repositori (Single Codebase)** yang dikonfigurasi via `.env` untuk dideploy secara independen bagi setiap brand. Mendukung perangkat Android jadul (PWA+APK) dan Web Dashboard dengan sistem *offline-resilient*.

### Implementasi Inisial (Isolasi Data Penuh)

- **Brand A (Teh Maestro):** 1 Database Terisolasi, 1 Web Dashboard, 1 APK Android, 10+ Outlet.
- **Brand B (2 Trees Coffee):** 1 Database Terisolasi, 1 Web Dashboard, 1 APK Android, 10+ Outlet.

---

## 2. Tech Stack & Infrastruktur (Vercel + VPS)

| Komponen | Teknologi Utama | Strategi Deployment |
|---|---|---|
| **Kasir (Staff)** | React, Vite, Capacitor.js, Tailwind, Zustand, Dexie.js | Build ke APK Android (App ID berbeda per brand) & deploy PWA di Vercel. |
| **Dashboard Admin/Owner** | Next.js 14, shadcn/ui, Tailwind CSS, Recharts | Di-deploy ke Vercel. UI diatur via Tailwind config dari `.env` brand. |
| **Backend API** | Node.js, Express.js, Socket.io, Prisma ORM | VPS + Coolify: Menjalankan 2 container API terpisah (Port 3001 & 3002). |
| **Database Utama** | PostgreSQL (Isolasi Fisik) | VPS + Coolify: 2 Database fisik terpisah (`db_tehmaestro` & `db_2trees`). |

---

## 3. Role & Permission Matrix

| Fitur/Modul | Kasir (Staff) | Admin (Outlet) | Owner (Brand) |
|---|---|---|---|
| Transaksi POS & Void (< 5 Menit) | ✅ (PIN Sendiri) | ✅ | ✅ |
| Void Transaksi (> 5 Menit) | ⚠️ PIN Admin | ✅ | ✅ |
| Ubah PIN Kasir / Staff | ❌ | ✅ | ✅ |
| Ubah Password Admin | ❌ | ❌ | ✅ |
| Reset Password Owner Lupa Sandi | *Dilakukan secara manual via Database Override (Prisma Studio di VPS)* | | |
| Stok Opname & Manajemen BOM | ❌ | ✅ (pilih outlet dulu) | ✅ (pilih outlet dulu) |
| CRUD Produk (Dashboard) | ❌ | ✅ (pilih outlet dulu) | ✅ (pilih outlet dulu) |
| Jadwal Kerja Staff (Bulanan) | ❌ | ✅ (pilih outlet dulu) | ✅ (pilih outlet dulu, semua outlet) |
| Manajemen Outlet (Settings) | ❌ | ❌ | ✅ |
| Activate/Deactivate Staff | ❌ | ❌ | ✅ |

---

## 4. Data Model (Per Database Brand)

Setiap database terisolasi. Relasi antar outlet menggunakan kunci `outletId`.

### Enums

- `ServeType`: `HOT` | `COLD` | `BOTH`
- `ProductType`: `MENU` | `ACCESSORY` | `MATERIAL`
- `AttendanceStatus`: `HADIR` | `ALPA` | `AUTO_CLOCKED_OUT` | `IZIN` | `SAKIT`
- `CycleStatus`: `ACTIVE` | `CLOSED`
- `PaymentMethod`: `CASH` | `QRIS_STATIC`
- `AdjustmentType`: `RESTOCK` | `DAMAGE` | `LOSS` | `CORRECTION`

### Tabel Kunci (Ringkasan)

- **Product:** `id`, `name`, `price`, `product_type` (MENU/ACCESSORY/MATERIAL), `serve_type`, `outletId`, `stock`. *(Bisa negatif)*
- **ProductRecipe (BOM):** `id`, `productId` (MENU), `materialId` (MATERIAL/ACCESSORY), `quantity`, `serve_type` (HOT/COLD/null).
- **Transaction:** `id`, `cycleId`, `staffId`, `outletId`, `totalAmount`, `paymentMethod`, `status`.
- **BusinessCycle:** Siklus operasional harian kedai. `status`: ACTIVE/CLOSED.
- **StockAdjustmentLog:** Log audit koreksi stok admin. `id`, `productId`, `oldStock`, `newStock`, `adjustmentType`, `date`.
- **StaffSchedule:** Jadwal kerja staff bulanan. `id`, `userId`, `outletId`, `scheduleDate`, `shiftStart`, `shiftEnd`, `isOff`, `notes`, `createdBy`. 1 staff bisa dijadwalkan di outlet berbeda pada hari yang sama (fleksibel untuk backup tenaga saat outlet padat).

---

## 5. Fungsionalitas Modul Lengkap

### MODUL A — KASIR (PWA + APK)

#### A1. Login, Absensi & Keamanan Layar

- **Sistem Auto-Lock (Idle Timeout 7 Menit):** Untuk menghindari bottleneck antrian, PIN tidak diminta setiap transaksi. Namun, jika layar tidak disentuh selama 7 menit berturut-turut, layar akan terkunci otomatis.
- **PIN Unlock = PIN Staff Bertugas:** Layar yang terkunci hanya bisa dibuka dengan menginput PIN dari staf yang **sedang bertugas** (sudah clock-in) di outlet tersebut pada saat itu. PIN staf yang belum clock-in atau dari outlet lain **tidak dapat digunakan**. State keranjang belanja tidak hilang saat lock/unlock.
- **Anti-Lag Logic:** Menggunakan teknik `setTimeout` dan `throttle` (batas 1 reset per 2 detik) agar tidak membebani CPU/RAM pada tablet Android 11.
- **Aksi Dinamis:** `[Buka Kedai]` (membuat BusinessCycle baru), `[Mulai Shift]`, `[Ganti Shift]`. Numpad PIN input + widget Live Camera Preview (auto-capture). Kompresi foto <50KB.
- **Logika Tutup Kedai (Force Clock-Out):** Saat "Tutup Kedai" ditekan, sistem memaksa staf yang sedang login/lupa clock-out menjadi `AUTO_CLOCKED_OUT` dengan jam keluar disamakan jam tutup kedai. Staf yang tidak absen sama sekali menjadi `ALPA`.

#### A2. Transaksi POS & Aturan Stok

- Katalog hanya menampilkan `MENU` dan `ACCESSORY`. `MATERIAL` disembunyikan.
- **Pemilihan Serve Type:** Jika produk tipe `BOTH`, tap produk memunculkan modal wajib pilih "Dingin / Hangat".
- **Auto-Deduct BOM:** Transaksi memotong stok produk yang dijual + stok bahan baku berdasarkan resep.
- **Izin Stok Minus (Soft Warning):** Jika stok habis (0), item mendapat warning ikon merah. Kasir tetap **BISA** melanjutkan transaksi (stok menjadi minus).

#### A3. Riwayat Transaksi & Void (Grace Period)

- **< 5 Menit:** Kasir bisa Void mandiri menggunakan PIN kasir miliknya (wajib isi alasan).
- **> 5 Menit:** Terkunci. Void wajib diotorisasi menggunakan PIN Admin Outlet.

---

### MODUL B & C — WEB DASHBOARD (ADMIN & OWNER)

#### Outlet Selector (Wajib untuk Operasi Data)

- **Owner dan Admin wajib memilih outlet terlebih dahulu** sebelum melakukan CRUD produk, mengelola resep/BOM, melakukan stok opname, atau mengatur jadwal staff.
- Owner dapat melihat dan memilih **semua outlet**. Admin hanya bisa memilih outlet yang terkait dengannya.
- Pilihan outlet ditampilkan sebagai dropdown selector di atas setiap halaman yang membutuhkan konteks outlet.

#### Manajemen Keamanan (PIN & Akun)

- Staf/Kasir tidak dapat mengubah PIN mereka sendiri. PIN diatur statis oleh Admin atau Owner.
- Admin Outlet tidak dapat mereset password sendiri. Password Admin hanya bisa diatur oleh Owner.
- **Solusi Darurat Owner Lupa Password:** Di rilis v1, tidak menggunakan integrasi email SMTP. Jika Owner lupa password, Super-Admin (Developer) akan mereset hash password secara manual via Prisma Studio di dalam VPS Coolify.

#### Manajemen Master Data, BOM & Opname

- CRUD Produk dan Resep Bersyarat (Hot/Cold auto-deduct). **Wajib pilih outlet dulu.**
- Stok Opname untuk mengeksekusi koreksi inventaris (menyelesaikan masalah stok minus di kasir, mencatat bahan rusak/tumpah, dan restock). **Wajib pilih outlet dulu.**

#### Manajemen Jadwal Kerja Staff

- Owner dan Admin dapat **membuat, mengubah, dan menghapus jadwal kerja staff** untuk periode 1 bulan.
- **Wajib memilih outlet terlebih dahulu** sebelum membuat atau mengubah jadwal.
- Owner dapat mengelola jadwal di **semua outlet**. Admin hanya bisa mengelola jadwal di outlet miliknya.
- **1 staff bisa dijadwalkan di beberapa outlet berbeda** pada hari yang sama — ini berguna saat outlet tertentu kekurangan tenaga karena padatnya pembeli.
- Jadwal mencakup: tanggal, jam mulai shift, jam akhir shift, status libur (OFF), dan catatan opsional.

---

## 6. Standar Komunikasi & Hardware

- **Hardware Fallback:** Cetak struk via Bluetooth Serial Plugin (di APK native) atau standard `window.print()` / WhatsApp (di Web PWA).
- **Offline-Resilient:** Jika internet putus, antrean transaksi ditampung di Dexie.js (IndexedDB). Flush data ke VPS otomatis saat koneksi pulih.
