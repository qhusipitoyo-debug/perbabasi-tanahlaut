# Panduan Live — Aplikasi Bendahara PERBASI Tanah Laut (mode gratis)

Status: **LIVE via Cloudflare Quick Tunnel** — tidak perlu domain, tidak perlu buka port router, HTTPS otomatis.

## 🌐 URL yang sedang aktif

```
https://goes-habitat-tile-cylinder.trycloudflare.com
```

> ⚠️ URL Quick Tunnel **acak dan berubah setiap restart tunnel**. Catat URL dari file `deploy/tunnel.log` setiap kali restart.
> Untuk URL permanen yang tidak berubah: butuh Cloudflare account + domain (lihat bagian "Upgrade" di bawah).

## Yang harus diketahui sebelum dibagikan ke pengurus

1. **PC harus menyala** & tersambung internet saat pengurus mengakses. Matikan PC = aplikasi offline.
2. URL ini **publik** — siapa pun yang tahu bisa membuka halaman login. Keamanan bergantung pada password Anda.
   → **WAJIB ganti password default sekarang**: Pengaturan → Keamanan → Ganti Password (`admin` & `bendahara`).
   → Login dibatasi 10 percobaan / 10 menit per IP — tapi tetap, password kuat itu wajib.
3. Bagikan URL **hanya ke pengurus internal**, bukan ke grup terbuka/media sosial.
4. Backup rutin: menu **Pengaturan → Backup** (unduh file `.db`) seminggu sekali.

## Cara menjalankan / menghentikan tunnel

```bash
# 1. Aplikasi harus berjalan dulu
cd /home/canary1/Downloads/perbasasi-bendahara
npm start          # biarkan berjalan

# 2. Jalankan tunnel (di terminal terpisah atau background)
./deploy/mulai-tunnel.sh

# 3. Cek URL publik
grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' deploy/tunnel.log

# 4. Menghentikan
./deploy/stop-tunnel.sh
```

Tunnel yang sekarang berjalan memakai proses di `deploy/tunnel.pid` dengan log di `deploy/tunnel.log`.

> Catatan: jaringan internet Anda (router 192.168.100.1) belum mengenal subdomain tunnel yang baru,
> sehingga dari PC ini URL mungkin "tidak bisa resolve" sesaat setelah restart. Dari jaringan/HP
> pengurus URL berfungsi normal. Untuk mengetes dari PC ini:
> `curl --resolve goes-habitat-tile-cylinder.trycloudflare.com:443:104.16.230.132 https://goes-habitat-tile-cylinder.trycloudflare.com/api/health`

## Instal sebagai aplikasi di HP pengurus (PWA)

1. Buka URL di Chrome (Android) → menu ⋮ → **Add to Home screen / Install app**
2. Muncul ikon "Perbasasi Bendahara" di layar HP → tampil layar penuh seperti aplikasi native.

## Agar tunnel otomatis nyala saat PC hidup (opsional, autostart)

Tambahkan ke *Startup Applications* / autostart DE Anda perintah:

```bash
cd /home/canary1/Downloads/perbasasi-bendahara && npm start
/home/canary1/Downloads/perbasasi-bendahara/deploy/mulai-tunnel.sh
```

## Upgrade ke solusi permanen (nanti jika ada dana)

| Jenjang | Solusi | Perkiraan biaya |
|--------|--------|-----------------|
| Sekarang (gratis) | Cloudflare Quick Tunnel dari PC | Rp 0 |
| Stabil 24/7 gratis | VPS **Oracle Cloud Always Free** + Caddy (HTTPS otomatis) + domain (mis. `.my.id`) | Rp 0 / ~Rp 15rb per tahun untuk domain |
| Profesional | VPS berbayar (RAM 1GB cukup) + domain + backup harian | ~Rp 60–150rb / bulan |

Langkah migrasi nanti:
1. Sewa VPS / Oracle Always Free
2. Install Node.js ≥ 22.5, clone/copy repo + folder `data/` (database ikut terbawa!)
3. Set env: `PORT=8080 JWT_SECRET=<acak-panjang> NODE_ENV=production node server.js`
4. Pasang **Caddy** sebagai reverse proxy + HTTPS otomatis (`bendahara.domain.id { reverse_proxy localhost:8080 }`)
5. systemd unit agar auto-start & restart kalau crash
6. Backup `data/` harian (cron + `sqlite3 data/perbasasi.db ".backup ..."` atau tombol Backup di app)

## Tentang "tidak bisa diakses pengurus" — checklist cepat

- [ ] PC menyala & internet aktif
- [ ] `npm start` berjalan (cek `curl http://localhost:8080/api/health` → `{"ok":true...}`)
- [ ] Tunnel berjalan (`./deploy/mulai-tunnel.sh`, cek `deploy/tunnel.log`)
- [ ] PC tidak tidur/suspend — matikan "auto sleep" di pengaturan daya
- [ ] Password admin sudah diganti dari default
