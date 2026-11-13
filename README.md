# 🏀 PERBASI Tanah Laut — Aplikasi Bendahara

Aplikasi manajemen keuangan resmi **Perbasasi Tanah Laut** (Perserikatan Baseball Softball Seluruh Indonesia — Pengurus Kabupaten Tanah Laut). Dibangun untuk bendahara organisasi: mencatat kas, transaksi pemasukan/pengeluaran, iuran anggota, dan menerbitkan laporan keuangan yang bisa dicetak.

- **Backend**: Node.js **vanilla** — tanpa framework, tanpa dependency npm (router, JWT, scrypt, SQLite semuanya dibangun sendiri)
- **Database**: SQLite via `node:sqlite` (built-in Node.js ≥ 22.5)
- **Keamanan**: JWT (HS256) + password hashing `scrypt` + rate limiting login + security headers (CSP) + audit log
- **Frontend**: Vanilla JS SPA, desain dinamis (light/dark mode, grafik canvas custom), **PWA** — siap di-wrap menjadi aplikasi Android

---

## 🚀 Menjalankan

```bash
# butuh Node.js >= 22.5 (diuji di Node v24)
cd perbasasi-bendahara
npm start
```

Buka **http://localhost:8080**

Akun bawaan (segar setiap kali database dibuat ulang):

| Username     | Password       | Role      |
|--------------|----------------|-----------|
| `admin`      | `admin123`     | admin     |
| `bendahara`  | `bendahara123` | bendahara |

> ⚠️ **Segera ganti password** setelah login pertama (menu Pengaturan → Keamanan).

Saat pertama kali dijalankan, aplikasi otomatis membuat `data/perbasasi.db` berisi skema, akun bawaan, kategori & kas contoh, serta data contoh 6 bulan terakhir (agar dashboard langsung hidup). Nonaktifkan data contoh dengan `SEED_DEMO=false npm start`.

## ✨ Fitur

| Modul | Deskripsi |
|-------|-----------|
| **Dashboard** | Saldo total, pemasukan/pengeluaran bulan berjalan, grafik arus kas 6 bulan (canvas), donut kategori, saldo per kas, transaksi terbaru |
| **Transaksi** | CRUD pemasukan/pengeluaran, filter (tipe, kas, kategori, periode, kata kunci), pagination, ringkasan total sesuai filter, export CSV |
| **Kas & Kategori** | Multi-akun kas (tunai/bank/e-wallet) dengan saldo terhitung otomatis; kategori pemasukan/pengeluaran |
| **Anggota** | Data atlet/pelatih/pengurus (nomor, posisi, tim, kontak, status aktif) |
| **Iuran Anggota** | Status lunas/belum per periode bulan, catat & batalkan pembayaran, progress bar, export CSV |
| **Persuratan** | Arsip surat keluar dengan **nomor otomatis** format `400.4.1/001/PERBASASI-TALA/2026` (urut 3 digit, reset tiap tahun), generator nomor + salin, klasifikasi bidang (Olahraga, Kepelatihan, Wasit & Pertandingan, Pembinaan & Usia Dini, Administrasi & Kesekretariatan), cetak kop surat resmi, export CSV |
| **Laporan** | Laporan Arus Kas per periode — tampilan cetak rapi (A4) + unduh CSV |
| **Pengaturan** | Profil organisasi, ganti password, kelola pengguna (admin), audit log (admin), backup database (admin) |

## 🔐 Keamanan

- **JWT** HS256 (implementasi sendiri via `node:crypto`), payload minimal (`sub`, `username`, `role`), kedaluwarsa 12 jam (`JWT_EXPIRES_IN_SEC`)
- **Password** di-hash dengan **scrypt** (N=16384) + salt acak, perbandingan timing-safe
- **Rate limiting** login: 10 percobaan / 10 menit per (IP + username) → HTTP 429
- **Proteksi path traversal** + SPA fallback pada static file server
- **Security headers**: Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy
- **Role-based access**: `admin` (penuh) & `bendahara` (operasional); `/api/users`, `/api/audit`, `/api/backup`, hapus kas/kategori/anggota khusus admin
- **Audit log**: login, CRUD data, perubahan pengaturan, backup — tersimpan di tabel `audit_log`
- **Query terparameterisasi** seluruh akses database (tidak ada string concatenation SQL)
- Backup: unduh file `.db` penuh (admin) — lakukan rutin!

### Konfigurasi (environment variables)

| Variabel | Default | Keterangan |
|----------|---------|------------|
| `PORT` | `8080` | Port server |
| `HOST` | `0.0.0.0` | Bind interface |
| `DATA_DIR` | `./data` | Folder database & secret |
| `DB_PATH` | `./data/perbasasi.db` | Path file SQLite |
| `JWT_SECRET` | *(dibuat acak otomatis)* | **Wajib di-set di produksi!** Min. 16 karakter |
| `JWT_EXPIRES_IN_SEC` | `43200` (12 jam) | Masa berlaku token |
| `SEED_DEMO` | `true` | `false` → tanpa data contoh saat instalasi baru |

Untuk produksi, set minimal: `JWT_SECRET='rahasia-anda-yang-panjang-acak' NODE_ENV=production npm start`

## 📱 Menjadikan Aplikasi Android (PWA → APK)

Aplikasi ini sudah **installable** (manifest + service worker: shell aplikasi tersimpan offline, data `/api` selalu dari jaringan). Dua jalur termudah ke Android:

### Opsi A — PWABuilder (paling cepat)
1. Deploy aplikasi ini ke host dengan HTTPS (mis. VPS + Nginx + Certbot, atau layanan seperti Railway/Render)
2. Buka <https://www.pwabuilder.com> → masukkan URL → pilih **Android** → unduh paket (TWA APK/AAB)
3. Unggah ke Google Play Console, atau sideload APK langsung

### Opsi B — Capacitor (jika ingin APK dengan akses native penuh)
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Perbasasi Bendahara" "id.perbasitanlahunt.bendahara" --web-dir=public
npx cap add android
npx cap sync android
npx cap open android   # buka Android Studio → Build APK
```
Konfigurasi Capacitor di atas menganggap `public/` sebagai webDir. Karena aplikasi ini SPA statis + API terpisah, arahkan `server.url` (di `capacitor.config`) ke URL backend Anda, atau panggil API lewat origin yang sama jika frontend dan backend dideploy bersamaan (default-nya memang satu origin — tidak perlu ubah apa pun).

Fitur yang membuatnya layak PWA: `manifest.webmanifest` (ikon, warna tema, `display: standalone`), `sw.js` (cache-first untuk shell, network-only untuk API), viewport responsif, dan tampilan mobile satu-kolom.

## 🗂️ Struktur Proyek

```
perbasasi-bendahara/
├── server.js              # entry point HTTP + static + SPA fallback
├── package.json           # zero dependencies
├── src/
│   ├── config.js          # env & JWT secret handling
│   ├── db.js              # skema SQLite + seed
│   ├── auth.js            # scrypt + JWT HS256 (node:crypto)
│   ├── middleware.js      # authRequired(role...)
│   ├── router.js          # mini router (pattern :param)
│   ├── helpers.js         # JSON/CSV/security headers/static server/audit
│   └── routes/            # auth, dashboard, transactions, kas, categories,
│                          # members, dues, reports, users, settings, audit, backup, surat
├── public/
│   ├── index.html         # layar login + app shell (SPA)
│   ├── css/style.css      # design system (light/dark, responsif, print)
│   ├── js/                # api, util, charts (canvas), app.js, pages/*.js
│   ├── manifest.webmanifest
│   ├── sw.js              # service worker
│   └── icons/logo.png    # logo resmi PERBASI Tanah Laut (640×640, latar transparan)
└── data/                  # SQLite + jwt_secret (gitignored)
```

## 🔌 Ringkasan API (semua JSON, prefix `/api`)

| Method | Endpoint | Akses |
|--------|----------|-------|
| POST | `/api/auth/login` | publik (rate-limited) |
| GET/POST | `/api/auth/me`, `/api/auth/change-password` | login |
| GET | `/api/dashboard/summary` | login |
| GET/POST | `/api/transactions` · PUT/DELETE `/api/transactions/:id` | login |
| GET/POST | `/api/kas` · PUT `/api/kas/:id` | login |
| DELETE | `/api/kas/:id` | admin |
| GET/POST | `/api/categories` · PUT `/api/categories/:id` | login |
| DELETE | `/api/categories/:id` | admin |
| GET/POST | `/api/members` · PUT `/api/members/:id` | login |
| DELETE | `/api/members/:id` | admin |
| GET/POST | `/api/dues?period=YYYY-MM` | login |
| DELETE | `/api/dues/:id` | login |
| GET/POST | `/api/surat` · PUT/DELETE `/api/surat/:id` · GET `/api/surat/next` · GET `/api/surat/bidang` · POST/PUT/DELETE `/api/surat/bidang[/:id]` · GET `/api/surat/export.csv` | login (hapus bidang: admin) |
| GET | `/api/reports/cashflow` · `/api/reports/cashflow.csv` · `/api/reports/dues.csv` | login |
| GET/PUT | `/api/settings` | GET publik · PUT login |
| GET/POST | `/api/users` · PUT `/api/users/:id` · POST `/api/users/:id/reset-password` | admin |
| GET | `/api/audit?limit=100` | admin |
| GET | `/api/backup` (unduh `.db`) | admin |
| GET | `/api/health` | publik |

Header autentikasi: `Authorization: Bearer <token>`

## 🧾 Catatan Pengembangan Lanjutan

- Ganti `JWT_SECRET` & password bawaan sebelum dipakai sungguhan.
- Untuk multi-device di jaringan lokal, cukup jalankan di PC sekretariat; anggota lain akses via IP LAN (`http://192.168.x.x:8080`).
- Nominal disimpan sebagai **integer Rupiah** (tidak ada floating point) — aman untuk perhitungan.
- Migrasi skema: tambahkan blok `ALTER TABLE ... IF NOT EXISTS`/create-table di `src/db.js → migrate()` (aman dijalankan berulang).
- Upload bukti transaksi bisa ditambahkan ke tabel `transactions` (`attachment_path`) + endpoint multipart jika dibutuhkan.

Lisensi: MIT — PERBASI Tanah Laut.
