#!/bin/bash

# Pastikan dijalankan sebagai root atau dengan sudo
if [ "$EUID" -ne 0 ]; then
  echo "Harap jalankan skrip ini menggunakan sudo atau sebagai root."
  exit 1
fi

echo "🚀 Memulai Deployment Kasir & Dashboard (Teh Maestro & 2 Trees)..."

# Tarik kode terbaru dari repositori
echo "📥 Menarik pembaruan dari Git..."
git pull origin main

# Build ulang container tanpa cache agar environment terbaru terbaca
echo "🏗️ Melakukan build Docker Images..."
docker compose build --no-cache

# Matikan dan hapus container lama
echo "🛑 Menghentikan container yang sedang berjalan..."
docker compose down

# Jalankan container baru di background
echo "🟢 Menjalankan sistem..."
docker compose up -d

echo "✅ Selesai! Berikut adalah port yang berjalan:"
echo " - Dasbor (Teh Maestro)    : http://<IP_VPS>:3000"
echo " - Kasir App (Teh Maestro) : http://<IP_VPS>:8000"
echo " - Dasbor (2 Trees Coffee) : http://<IP_VPS>:3001"
echo " - Kasir App (2 Trees)     : http://<IP_VPS>:8001"
