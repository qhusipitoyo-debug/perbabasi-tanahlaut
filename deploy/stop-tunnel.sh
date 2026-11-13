#!/bin/bash
# Hentikan Cloudflare Quick Tunnel untuk Aplikasi Bendahara PERBASI Tanah Laut.
cd "$(dirname "$0")"
if [ -f tunnel.pid ] && kill -0 "$(cat tunnel.pid)" 2>/dev/null; then
  kill "$(cat tunnel.pid)"
  echo "Tunnel (PID $(cat tunnel.pid)) dihentikan."
  rm -f tunnel.pid
else
  echo "Tidak ada tunnel yang berjalan."
fi
