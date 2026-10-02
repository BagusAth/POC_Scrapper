# 13 — Local Setup & Installation Guide

Dokumen ini adalah panduan langkah demi langkah bagi pengembang baru untuk memasang, mengonfigurasi, dan menjalankan project ini di komputer lokal dalam waktu kurang dari 10 menit.

---

## 1. Persyaratan Sistem & Lingkungan

### 1.1 Persyaratan Perangkat Lunak
* **Python:** Versi **3.11 atau lebih baru** (wajib).
* **Git:** Versi 2.30+ untuk clone repository.
* **Node.js (Opsional):** Diperlukan hanya jika ingin menjalankan validasi sintaks JavaScript statis (`node --check static/app.js`).
* **Sistem Operasi:** Windows, macOS, atau Linux (Ubuntu/Debian).

### 1.2 Kebutuhan Layanan & API Keys (Eksternal)

| Layanan | Status Kebutuhan | Peran | Dampak Jika Dikosongkan |
|---|---|---|---|
| **YouTube Data API v3** | Opsional | Kuota resmi discovery video & snapshot views | Aplikasi otomatis beralih ke mode scraping publik (*best-effort*) |
| **Apify Token (`APIFY_TOKEN`)** | Opsional (Wajib untuk data riil Maps/Medsos) | Menjalankan Actor Maps, TikTok, Instagram, Facebook, Shopee | Tidak ada data fiktif yang dibuat; `/api/health` jujur menampilkan sumber belum dikonfigurasi |
| **Gemini API Key (`GEMINI_API_KEY`)** | Opsional | Penganalisis sentimen AI cerdas & sintesis inovasi | Otomatis fallback ke penganalisis leksikon lokal (`LexiconAnalyzer`) |
| **Supabase Postgres** | Opsional | Database persisten di cloud | Sistem otomatis menggunakan SQLite lokal (`data/app.db`) |

---

## 2. Langkah Pemasangan Langkah demi Langkah

### Langkah 1: Clone Repository & Pindah ke Branch `test`

```bash
git clone https://github.com/BagusAth/POC_Scrapper.git
cd POC_Scrapper
git checkout test
```

### Langkah 2: Buat & Aktifkan Virtual Environment Python

* **Di Linux / macOS:**
  ```bash
  python3.11 -m venv .venv
  source .venv/bin/activate
  ```

* **Di Windows (PowerShell):**
  ```powershell
  py -3.11 -m venv .venv
  .\.venv\Scripts\Activate.ps1
  ```

### Langkah 3: Install Dependensi Python

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

---

## 3. Konfigurasi Variabel Lingkungan (`.env`)

Salin file template `.env.example` menjadi `.env`:

```bash
cp .env.example .env
```

Buka file `.env` di teks editor. Tabel berikut menjelaskan seluruh variabel yang tersedia:

| Variabel | Wajib? | Default | Tujuan & Penjelasan | Contoh Nilai |
|---|---|---:|---|---|
| `SOURCES` | Ya | `youtube_trend,maps,tiktok,instagram,facebook,shopee` | Daftar sumber pengumpulan data yang diaktifkan | `youtube_trend,maps` |
| `YOUTUBE_API_KEY` | Tidak | *(kosong)* | API Key Google Cloud YouTube Data API v3 | `AIzaSyD...` |
| `YOUTUBE_DAILY_QUOTA` | Tidak | `10000` | Batas unit kuota harian YouTube | `10000` |
| `YT_SEARCH_RESERVE_UNITS` | Tidak | `6000` | Jatah unit harian untuk pencarian baru | `6000` |
| `YT_TREND_LOOKBACK_DAYS` | Tidak | `90` | Batas umur video yang dilacak (hari) | `90` |
| `YT_SEARCH_DATE_PAGES` | Tidak | `2` | Jumlah halaman pencarian discovery awal | `2` |
| `YT_SEARCH_REFRESH_HOURS` | Tidak | `6` | Interval discovery video ulang (jam) | `6` |
| `YT_MAX_VIDEOS_PER_TOPIC` | Tidak | `150` | Batas maksimal video yang disimpan per topik | `150` |
| `YT_STATS_INTERVAL_MINUTES` | Tidak | `60` | Interval snapshot views video normal (menit) | `60` |
| `YT_COMMENTS_ENABLED` | Ya | `false` | Pengambilan komentar video YouTube (wajib false) | `false` |
| `YT_EXCLUDE_TERMS` | Tidak | *Daftar istilah kartun/hiburan* | Kata negatif untuk membuang konten anak-anak | `upin ipin,kartun...` |
| `MAPS_PROVIDER` | Ya | `apify` | Provider Google Maps (`apify` atau `places`) | `apify` |
| `APIFY_TOKEN` | Kondisional | *(kosong)* | Token rahasia server Apify | `apify_api_...` |
| `APIFY_ACTOR_ID` | Tidak | `compass~crawler-google-places` | ID Actor scraper Google Maps | `compass~crawler-google-places` |
| `MAPS_DAILY_REQUEST_CAP` | Tidak | `30` | Batas harian panggilan scraper Maps | `30` |
| `MAPS_MONTHLY_REQUEST_CAP`| Tidak | `800` | Batas bulanan panggilan scraper Maps | `800` |
| `MAPS_CONTENT_TTL_DAYS` | Tidak | `7` | Masa simpan ulasan Maps sebelum di-purge (hari) | `7` |
| `DEFAULT_CITY` | Tidak | `Bandung` | Kota awal saat mendaftarkan produk baru | `Bandung` |
| `TIKTOK_ACTOR_ID` | Tidak | `clockworks~tiktok-scraper` | ID Actor scraper TikTok | `clockworks~tiktok-scraper` |
| `INSTAGRAM_ACTOR_ID` | Tidak | `apify~instagram-scraper` | ID Actor scraper Instagram | `apify~instagram-scraper` |
| `FACEBOOK_ACTOR_ID` | Tidak | `apify~facebook-search-scraper` | ID Actor scraper Facebook | `apify~facebook-search-scraper` |
| `SHOPEE_ACTOR_ID` | Tidak | `xtracto~shopee-scraper` | ID Actor scraper Shopee | `xtracto~shopee-scraper` |
| `SOCIAL_DAILY_RUN_CAP` | Tidak | `18` | Batas harian scraping medsos (dibagi bersama) | `18` |
| `SOCIAL_MONTHLY_RUN_CAP` | Tidak | `450` | Batas bulanan scraping medsos | `450` |
| `SOCIAL_SENTIMENT_ENABLED`| Tidak | `true` | Menganalisis sentimen caption medsos | `true` |
| `DEMO_MODE` | Tidak | `false` | Mode demo: snapshot views setiap 120 detik | `false` |
| `MAX_ACTIVE_TOPICS` | Tidak | `20` | Batas maksimal topik aktif di watchlist | `20` |
| `AI_MODE` | Ya | `mock` / `lexicon` / `gemini` | Penganalisis sentimen default | `lexicon` |
| `GEMINI_API_KEY` | Kondisional | *(kosong)* | API Key Google AI Studio untuk model Gemini | `AIzaSy...` |
| `GEMINI_MODEL` | Tidak | `gemini-3.8-flash` | Model Gemini yang digunakan | `gemini-3.8-flash` |
| `GEMINI_RPM` | Tidak | `8` | Batas rate limit panggilan per menit | `8` |
| `DATABASE_BACKEND` | Ya | `auto` | Backend database (`auto`, `sqlite`, `postgres`) | `auto` |
| `DATABASE_PATH` | Tidak | `data/app.db` | Lokasi berkas SQLite lokal | `data/app.db` |
| `SUPABASE_DB_URL` | Tidak | *(kosong)* | Connection string Supabase Postgres | `postgresql://...` |
| `DATABASE_AUTO_MIGRATE` | Ya | `false` | Bootstrap DDL otomatis (wajib false di Vercel) | `false` |
| `LOG_LEVEL` | Tidak | `INFO` | Level log aplikasi (`DEBUG`, `INFO`, `WARNING`)| `INFO` |

---

## 4. Inisialisasi Database & Seeding Topik

Jalankan skrip reset database lokal. Perintah ini akan membuat skema tabel v3 dan menanam 3 topik seed awal (*Cappuccino Cincau*, *Kopi Susu Gula Aren*, dan *Seblak*):

```bash
python scripts/reset_db.py
```

*Output yang Diharapkan:*
```text
Database data/app.db dibuat ulang dengan 3 topik seed.
```

---

## 5. Menjalankan Server Aplikasi

Jalankan server pengembangan FastAPI dengan Uvicorn:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

*Output Terminal:*
```text
INFO:     Will watch for changes in: ['...']
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started re-loader process [pid]
INFO:     Started server process [pid]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

---

## 6. Verifikasi & Pengujian Akses

1. **Buka Dashboard di Browser:**
   Arahkan browser ke [http://127.0.0.1:8000](http://127.0.0.1:8000). Anda akan melihat antarmuka Neo-Brutalist dengan 3 tab produk aktif.
2. **Periksa Endpoint Health:**
   Buka [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health). Pastikan nilai `status: "ok"`.
3. **Dokumentasi Interaktif OpenAPI:**
   Buka [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) untuk mencoba endpoint API secara langsung via Swagger UI.

---

## 7. Troubleshooting Startup Umum

* **Masalah: `ModuleNotFoundError: No module named 'app'`**
  - *Penyebab:* Terminal tidak dijalankan dari root direktori repository atau virtual environment belum aktif.
  - *Solusi:* Pastikan berada di folder `POC_Scrapper` dan `.venv` telah diaktifkan (`source .venv/bin/activate`).
* **Masalah: `database is locked` (SQLite)**
  - *Penyebab:* Ada proses uvicorn lain yang masih berjalan dan memegang lock file SQLite.
  - *Solusi:* Hentikan semua proses Python/Uvicorn yang sedang berjalan di background, atau hapus berkas temporary `data/app.db-wal` dan `data/app.db-shm`.
* **Masalah: `GeminiAnalyzer` gagal saat startup**
  - *Penyebab:* `AI_MODE=gemini` diset tetapi `GEMINI_API_KEY` kosong atau paket `google-genai` belum terpasang.
  - *Solusi:* Set `AI_MODE=lexicon` di file `.env` atau isi `GEMINI_API_KEY` yang valid.
