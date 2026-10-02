# 14 — Developer Guide & Extension Workflows

Dokumen ini adalah panduan teknis bagi programmer yang ingin memelihara, memperluas fitur, atau menambahkan modul baru ke dalam repository `POC_Scrapper`.

---

## 1. Konvensi Kode & Standar Proyek

Untuk menjaga integritas dan keterbacaan kode:
1. **Type Hints Statis Wajib:** Seluruh signature fungsi dan method wajib menyertakan type hint lengkap (Python 3.11+ union syntax `X | Y`, generic collections).
2. **Asynchronous I/O Terpusat:** Seluruh operasi I/O (kueri database, request HTTP pihak ketiga, stream SSE) wajib berbasis `async` dan `await`. Dilarang menggunakan pemanggilan sinkron yang memblokir event loop (misal: dilarang memakai `requests`, gunakan `httpx.AsyncClient`).
3. **Pemisahan Peran Bersih (Separation of Concerns):**
   - Route handler ([`app/api/`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/api/)) hanya menangani validasi request/response HTTP.
   - Logika bisnis ditempatkan pada service domain ([`app/topics/`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/topics/), [`app/maps/`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/maps/), [`app/social/`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/social/), dll.).
   - Interaksi basis data dibatasi pada method domain di [`app/db.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/db.py).
4. **Ukuran Berkas Ramping:** Usahakan setiap file tetap terfokus dan memiliki panjang di bawah 250 baris kode jika memungkinkan.
5. **Bahasa Penamaan:** Teks antarmuka UI dalam Bahasa Indonesia; nama variabel, fungsi, method, dan file dalam Bahasa Inggris.

---

## 2. Struktur Direktori & Tanggung Jawab

```text
app/
├── analyzer/       # Worker batch analisis sentimen, klien Gemini, Leksikon, & Rate Limiter
├── api/            # Router endpoint REST API dan SSE streaming (/api/*)
├── collectors/     # Runner dan kolektor legacy (replay CSV, inbox, playstore)
├── maps/           # Klien Apify Google Maps, parser tempat & ulasan, filter relevansi, budget guard
├── marketplace/    # Klien Apify Shopee, parser produk & harga, budget guard
├── nlp/            # Preprocessing teks, perluasan slang, stopwords, dan penghitung kata kunci
├── social/         # Klien Apify TikTok/IG/FB, parser post, filter relevansi, sentimen bridge
├── topics/         # Layanan manajemen topik produk UMKM dan saran kata kunci otomatis
├── youtube/        # Klien YouTube (API v3 & publik), discovery, snapshot views, metrik tren, scheduler
├── config.py       # Pydantic Settings yang memuat konfigurasi dari .env
├── db.py           # Database helper asinkron SQLite (aiosqlite)
├── db_postgres.py  # Database backend Supabase Postgres (asyncpg)
├── events.py       # EventBroker in-memory pub/sub untuk SSE
├── main.py         # Entrypoint aplikasi FastAPI, middleware, dan lifespan management
└── models.py       # Kontrak skema data Pydantic
config/             # Berkas JSON topik awal (topics.json) dan aspek (aspects.json)
integrations/       # Review Bridge Chrome extension untuk ulasan marketplace
scripts/            # Skrip utilitas CLI: reset_db, warmup, backup_sqlite_to_supabase, probe scraper
static/             # Aset frontend: HTML, Neo-Brutalist CSS, vanilla ES module JS
supabase/           # Skrip migrasi SQL Postgres
tests/              # Test suite pytest (unit, integrasi, mock transport)
```

---

## 3. Workflow Praktis: Menambahkan Fitur Baru

### 3.1 Cara Menambahkan Data Source / Collector Baru
Misalkan Anda ingin menambahkan sumber ulasan dari platform baru (contoh: **TripAdvisor** atau **Google Play Reviews v3**):

1. **Buat Klien HTTP Scraper di `app/<source>/client.py`:**
   - Gunakan `httpx.AsyncClient`.
   - Pastikan request berbayar/berkuota dilindungi oleh tracker penggunaan (`UsageTracker`).
2. **Buat Parser & Normalizer di `app/<source>/parsing.py`:**
   - Ekstraksi field teks, rating, waktu, penulis, dan tautan.
   - Buang parameter pelacak (tracking tokens) dari URL.
3. **Terapkan Filter Relevansi Produk:**
   - Gunakan fungsi `mentions_product()` dari [`app/maps/relevance.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/maps/relevance.py) atau regex klitika bahasa Indonesia.
4. **Buat Collector Service di `app/<source>/collector.py`:**
   - Sambungkan klien, parser, dan fungsi database (`db.insert_comments(...)`).
   - Simpan teks dengan status `pending` agar otomatis diambil oleh `AnalyzerWorker`.
   - Publikasikan event `comment_new` ke `EventBroker`.
5. **Daftarkan di `TrendScheduler` ([`app/youtube/trend_scheduler.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/youtube/trend_scheduler.py)):**
   - Tambahkan pengecekan interval stale data dan panggil refresh function collector baru.
6. **Ekspos Endpoint Read di `app/api/` dan Tampilkan di Frontend.**

---

### 3.2 Cara Menambahkan Endpoint API Baru

1. **Buka router terkait atau buat file baru di `app/api/routes_<domain>.py`:**
   ```python
   from fastapi import APIRouter, HTTPException, Query
   from app.db import Database

   def create_custom_router(database: Database) -> APIRouter:
       router = APIRouter(prefix="/api/custom", tags=["custom"])

       @router.get("/metrics")
       async def get_custom_metrics(topic_id: str) -> dict[str, object]:
           topic = await database.get_topic(topic_id)
           if topic is None:
               raise HTTPException(status_code=404, detail="Topik tidak ditemukan")
           # Logika komputasi analitik
           return {"topic_id": topic_id, "data": "hasil..."}

       return router
   ```
2. **Daftarkan router di `create_app()` pada [`app/main.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/main.py):**
   ```python
   application.include_router(create_custom_router(database))
   ```
3. **Buat pengujian otomatis di `tests/test_api_v3.py`.**

---

### 3.3 Cara Menambahkan Model atau Tabel Database Baru

1. **Definisikan DDL di `app/db.py`:**
   Tambahkan pernyataan `CREATE TABLE IF NOT EXISTS ...` di dalam string konstanta `SCHEMA`.
2. **Definisikan DDL untuk Supabase Postgres di `app/db_postgres.py`:**
   Tambahkan pernyataan pada string `POSTGRES_SCHEMA` di bawah skema `scraper.<nama_tabel>`.
3. **Buat Migration Script di `supabase/migrations/`:**
   Buat file SQL bertanggal (misal: `20261002050000_add_custom_table.sql`).
4. **Definisikan Kontrak Pydantic di `app/models.py`:**
   Turunkan dari `ApiModel` dengan `ConfigDict(extra="forbid")`.
5. **Tambahkan Helper Method di Class `Database` ([`app/db.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/db.py)):**
   Implementasikan method insert, upsert, dan query data asinkron.
6. **Tulis Unit Test di `tests/test_postgres_backend.py`.**

---

### 3.4 Cara Menambahkan Event SSE Baru

1. **Publikasikan Event di Backend:**
   Di modul mana pun yang memiliki akses ke `EventBroker`:
   ```python
   await broker.publish("promo_alert", {
       "topic_id": topic.id,
       "message": "Diskon kompetitor terdeteksi!",
       "timestamp": datetime.now(timezone.utc).isoformat()
   })
   ```
2. **Tangani Event di Frontend ([`static/app.js`](file:///d:/UNDIP/EXASTI/POC_Scrapper/static/app.js)):**
   Di dalam fungsi `connectStream()`:
   ```javascript
   stream.addEventListener("promo_alert", (event) => {
       const payload = JSON.parse(event.data);
       showToast(`Perhatian: ${payload.message}`);
   });
   ```

---

## 4. Alur Kerja Rekomendasi (End-to-End Workflow)

Saat membangun fitur analitik baru, ikuti urutan berikut:

```text
1. Rancang Skema & Pydantic Model (app/models.py)
   ↓
2. Buat Skema DB & Helper Kueri (app/db.py)
   ↓
3. Implementasikan Scraper Client / Collector (app/<domain>/)
   ↓
4. Terapkan Filter Relevansi & Normalisasi Teks
   ↓
5. Integrasikan dengan AnalyzerWorker & Scheduler
   ↓
6. Ekspos REST API Route (app/api/)
   ↓
7. Hubungkan Event SSE jika membutuhkan update live
   ↓
8. Implementasikan UI Component di static/
   ↓
9. Tulis Pengujian Otomatis Tanpa API Pihak Ketiga (tests/)
```
