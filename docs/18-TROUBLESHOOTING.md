# 18 — Troubleshooting & Diagnostic Guide

Dokumen ini mendokumentasikan panduan penyelesaian masalah (*troubleshooting*) berdasarkan struktur kode, penanganan error, dan skenario kegagalan nyata pada repository `POC_Scrapper`.

---

## 1. Masalah Otentikasi & Konfigurasi Token Pihak Ketiga

### Masalah 1.1: Sumber Data Apify Menampilkan "Belum Dikonfigurasi"
* **Gejala:** Pada dashboard, ulasan Google Maps, TikTok, Instagram, Facebook, atau Shopee tidak muncul, dan `/api/health` menampilkan pesan `* Apify belum dikonfigurasi`.
* **Penyebab:** Variabel lingkungan `APIFY_TOKEN` di file `.env` masih kosong. Sistem dirancang jujur dan tidak mengarang data palsu jika token tidak disediakan.
* **Cara Mendiagnosis:**
  Panggil endpoint health check:
  ```bash
  curl -s http://127.0.0.1:8000/api/health | jq .apify_configured
  ```
  Jika nilainya `false`, token belum terbaca.
* **Solusi:**
  1. Buat akun di [Apify Console](https://console.apify.com/) dan salin Personal API Token Anda.
  2. Tambahkan token ke file `.env`:
     ```dotenv
     APIFY_TOKEN=apify_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
     ```
  3. Restart server Uvicorn.

---

### Masalah 1.2: Panggilan Actor Apify Gagal atau Mengalami Timeout
* **Gejala:** Log server mencatat pesan `ApifyMapsClient/SocialApifyClient run gagal: ApifyRunFailedError` atau `Polling timeout reached`.
* **Penyebab:** Actor Apify kehabisan memori, terkena pembatasan platform target, atau waktu polling melebihi batas `APIFY_POLL_TIMEOUT_SECONDS` (default: 600 detik).
* **Cara Mendiagnosis:**
  Jalankan probe scraper mandiri di terminal untuk mengisolasi masalah:
  ```bash
  python scripts/maps_probe.py "cappuccino cincau" --city Bandung
  ```
* **Solusi:**
  1. Periksa riwayat eksekusi Actor langsung di dashboard web Apify untuk membaca log error scraper.
  2. Naikkan batas waktu polling di `.env`:
     ```dotenv
     APIFY_POLL_TIMEOUT_SECONDS=900
     ```
  3. Kurangi jumlah tempat pencarian agar proses lebih cepat:
     ```dotenv
     MAPS_MAX_PLACES_PER_SEARCH=2
     ```

---

## 2. Masalah Kuota & Pembatasan Biaya (Quota & Budget Caps)

### Masalah 2.1: YouTube Kuota Harian Habis (`QuotaExhaustedError`)
* **Gejala:** Log server mencatat `QuotaExhaustedError: Kuota harian YouTube sebesar 10000 unit telah habis`.
* **Penyebab:** Terlalu banyak topik aktif yang menjalankan operasi pencarian video (`search.list` berbiaya 100 unit per request).
* **Cara Mendiagnosis:**
  Periksa status kuota via API:
  ```bash
  curl -s http://127.0.0.1:8000/api/usage | jq .youtube
  ```
* **Solusi:**
  1. Tunggu hingga kuota di-reset otomatis pada tengah malam zona Pasifik (PT / sekitar pukul 14.00 WIB).
  2. Jika dalam masa demonstrasi atau testing intensif, aktifkan mode demo beranggaran khusus di `.env`:
     ```dotenv
     DEMO_MODE=true
     DEMO_BUDGET_UNITS=1500
     ```
  3. Kosongkan `YOUTUBE_API_KEY` untuk beralih sementara ke mode scraping publik tanpa kuota resmi.

---

### Masalah 2.2: Batas Request Harian Google Maps Terlampaui (`UsageCapExceededError`)
* **Gejala:** Scraping Maps berhenti dan mencatat `MapsUsageTracker: Batas harian 30 request tercapai`.
* **Penyebab:** Penjaga anggaran lokal (*budget guard*) memblokir panggilan baru untuk mencegah tagihan membengkak.
* **Cara Mendiagnosis:**
  Periksa status pemakaian Maps:
  ```bash
  curl -s http://127.0.0.1:8000/api/usage | jq .maps
  ```
* **Solusi:**
  Jika Anda memang ingin menambah kuota harian, sesuaikan di `.env`:
  ```dotenv
  MAPS_DAILY_REQUEST_CAP=50
  MAPS_MONTHLY_REQUEST_CAP=1200
  ```

---

## 3. Masalah AI & Analisis Sentimen

### Masalah 3.1: Gemini Menghasilkan Error HTTP 429 (*Resource Exhausted*)
* **Gejala:** Log mencatat `RateLimitedError: Kuota Gemini sementara habis` dan `cooldown_until` aktif.
* **Penyebab:** Panggilan AI melampaui batas *Requests Per Minute* (RPM) pada akun gratis Google AI Studio.
* **Cara Mendiagnosis:**
  Periksa state analyzer pada `/api/health`:
  ```bash
  curl -s http://127.0.0.1:8000/api/health | jq .analyzer
  ```
  Perhatikan nilai `gemini_healthy` dan `cooldown_until`.
* **Solusi:**
  1. **Sistem sudah menangani ini secara otomatis:** Worker otomatis mengalihkan analisis ke `LexiconAnalyzer` lokal tanpa menghentikan sistem.
  2. Turunkan parameter RPM di `.env`:
     ```dotenv
     GEMINI_RPM=5
     ```
  3. Perbesar batch size agar pengiriman ulasan lebih jarang namun lebih padat:
     ```dotenv
     BATCH_SIZE=25
     ```

---

### Masalah 3.2: Jumlah Ulasan Pending Menumpuk (`pending_count` Besar)
* **Gejala:** Nilai `pending_count` di status health terus bertambah dan ulasan di feed tetap berstatus `PENDING`.
* **Penyebab:** Task background `AnalyzerWorker` berhenti atau mengalami unhandled exception.
* **Cara Mendiagnosis:**
  Periksa apakah task `analyzer-worker` masih berjalan di log proses FastAPI.
* **Solusi:**
  1. Restart server aplikasi.
  2. Pastikan `AI_MODE=lexicon` jika tidak memiliki akses internet atau kuota Gemini sedang habis.
  3. Paksa analisis topik tertentu secara manual melalui skrip atau memicu discovery ulang.

---

## 4. Masalah Database & Concurrency

### Masalah 4.1: `sqlite3.OperationalError: database is locked`
* **Gejala:** Server gagal menulis data ke `data/app.db` dan mencatat database terkunci.
* **Penyebab:**
  - Ada proses uvicorn duplikat yang berjalan di latar belakang.
  - Skrip eksternal (seperti `maps_probe.py` atau `reset_db.py`) dijalankan bersamaan saat server sedang aktif menulis data.
* **Solusi:**
  1. Matikan seluruh proses python:
     - Di Windows: `taskkill /F /IM python.exe`
     - Di Linux: `pkill -f uvicorn`
  2. Pastikan file database berada di mode WAL (sudah dikonfigurasi default di `app/db.py`).
  3. Hapus file lock sementara jika server sudah mati: `data/app.db-shm` dan `data/app.db-wal`.

---

### Masalah 4.2: Kesalahan DDL Migrasi di Vercel (*Catalog Conflict*)
* **Gejala:** Serverless deployment di Vercel mengembalikan HTTP 500 saat cold start dengan pesan *duplicate key value violates unique constraint* atau *catalog lock error*.
* **Penyebab:** Variabel `DATABASE_AUTO_MIGRATE=true` di Vercel menyebabkan beberapa container paralel mencoba menjalankan perintah pembuatan tabel yang sama secara bersamaan.
* **Solusi:**
  Ubah variabel di Vercel Environment Variables:
  ```dotenv
  DATABASE_AUTO_MIGRATE=false
  ```
  Jalankan migrasi SQL hanya sekali melalui Supabase SQL Editor.

---

## 5. Masalah Live Feed & Server-Sent Events (SSE)

### Masalah 5.1: Indikator Live di Browser Berwarna Kuning / Tidak Menerima Event
* **Gejala:** Dashboard web tidak menampilkan ticker views baru dan titik status di sidebar menunjukkan status offline.
* **Penyebab:**
  - Koneksi SSE terputus oleh proxy atau browser memblokir koneksi *EventSource*.
  - Reverse proxy Nginx atau Vercel melakukan buffering response.
* **Cara Mendiagnosis:**
  Buka Developer Tools di browser (F12) > tab **Console** dan **Network**.
  Periksa request ke `/api/stream`:
  - Status harus `200 OK`.
  - Type harus `eventsource` atau `text/event-stream`.
  - Tab "EventStream" harus menerima event `ping` setiap 15 detik.
* **Solusi:**
  1. Pastikan header `X-Accel-Buffering: no` dan `Cache-Control: no-cache` terkirim (sudah diterapkan di [`app/api/routes_stream.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/api/routes_stream.py)).
  2. Muat ulang halaman browser (F5) untuk memicu `stream = new EventSource("/api/stream")` baru.

---

## 6. Masalah Kualitas Data & Relevansi

### Masalah 6.1: Video Kartun atau Hiburan Anak Muncul di Feed YouTube
* **Gejala:** Topik kuliner memuat video animasi anak-anak (misal: "Upin Ipin makan seblak").
* **Penyebab:** Kata kunci topik terlalu umum dan algoritma YouTube memprioritaskan views tinggi dari video hiburan.
* **Cara Mendiagnosis:**
  Jalankan probe di terminal:
  ```bash
  python scripts/yt_trend_probe.py "seblak"
  ```
  Periksa daftar video yang didiskualifikasi di output terminal.
* **Solusi:**
  Perkaya daftar kata negasi pada topik tersebut melalui pendaftaran atau tambahkan istilah ke `YT_EXCLUDE_TERMS` di `.env`:
  ```dotenv
  YT_EXCLUDE_TERMS=upin ipin,kartun,animasi,episode,dongeng,lagu anak,gaming,parodi
  ```
