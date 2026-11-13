#!/bin/bash
# Mulai Cloudflare Quick Tunnel untuk Aplikasi Bendahara PERBASI Tanah Laut.
# Jalankan APLIKASI dulu (npm start), lalu skrip ini.
# URL akan tercetak di deploy/tunnel.log dan berubah setiap restart!

cd "$(dirname "$0")"
if [ -f tunnel.pid ] && kill -0 "$(cat tunnel.pid)" 2>/dev/null; then
  echo "Tunnel sudah berjalan (PID $(cat tunnel.pid))."
  echo "URL ada di deploy/tunnel.log"
  exit 0
fi

nohup ./cloudflared tunnel --url http://localhost:8080 --no-autoupdate > tunnel.log 2>&1 &
echo $! > tunnel.pid
echo "Tunnel dimulai (PID $(cat tunnel.pid))."
echo "Tunggu ~10 detik, lalu cek URL publik di: $PWD/tunnel.log"
echo "   grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' tunnel.log"
