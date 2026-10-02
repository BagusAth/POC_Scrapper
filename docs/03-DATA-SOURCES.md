# 03 — Data Sources

Dokumen ini menginventarisasi seluruh sumber data yang tersedia di dalam repository `POC_Scrapper` (branch `test`), membedakan peran masing-masing sumber, mekanisme otentikasi, pembatasan kuota, hingga cara data disaring dan dinormalisasi.

---

## 1. Taksonomi Sumber Data

Berdasarkan implementasi aktual di kode sumber, sumber data dibagi menjadi tiga kelompok:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SUMBER DATA SISTEM                              │
├────────────────────────────────┬───────────────────────────────────────┤
│ 1. Primary Sources             │ - YouTube (Sinyal Tren Minat & Views) │
│    (Komponen Inti Intelijen)   │ - Google Maps via Apify (Sinyal Opini)│
│                                │ - TikTok via Apify (Sinyal Konten)    │
│                                │ - Instagram via Apify (Sinyal Konten) │
├────────────────────────────────┼───────────────────────────────────────┤
│ 2. Secondary & Supporting      │ - Facebook Search via Apify           │
│    (Variasi & Validasi Pasar)  │ - Shopee Indonesia via Apify          │
│                                │ - Review Bridge (Chrome Extension)    │
├────────────────────────────────┼───────────────────────────────────────┤
│ 3. Legacy / Fallback / Demo    │ - Replay CSV (Simulasi Offline)       │
│    (Kompatibilitas v2)         │ - Google Play Store (App Reviews)     │
│                                │ - Local Inbox Directory (JSON/CSV)    │
└────────────────────────────────┴───────────────────────────────────────┘
```

---

## 2. Rincian Sumber Data Primer (Primary Sources)

### 2.1 YouTube (Sinyal Tren, Pasokan Video, & Pertumbuhan Views)

* **Status:** `Implemented` (Aktif secara default bila ada di `SOURCES`).
* **Tujuan:** Membaca tren pasokan konten, format video populer (resep, review, ide usaha), dan laju pertumbuhan views 24 jam untuk produk yang dimonitor.
* **Data yang Diambil:**
  - Metadata Video: `video_id`, `title`, `description`, `channel_id`, `channel_title`, `published_at`.
  - Statistik Video: `views`, `likes`, `comments` (jumlah kuantitatif).
  - Klasifikasi Konten: `review`, `resep`, `ide_usaha`, `lainnya`.
  - *Catatan Kejujuran:* Teks komentar video **sengaja tidak diambil** (`YT_COMMENTS_ENABLED=false`) karena komentar YouTube didominasi interaksi penonton dengan kreator, bukan ulasan produk nyata.
* **Collector / Client:**
  - Client Resmi: [`app/youtube/client.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/youtube/client.py) (`YouTubeClient`)
  - Client Publik (Fallback): [`app/youtube/client.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/youtube/client.py) (`PublicYouTubeClient`)
  - Discovery: [`app/youtube/trend_discovery.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/youtube/trend_discovery.py) (`TrendDiscovery`)
  - Snapshot: [`app/youtube/stats_snapshot.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/youtube/stats_snapshot.py) (`StatsSnapshotService`)
* **API / Provider:**
  - YouTube Data API v3 (`search.list`, `videos.list`).
  - Fallback: Scraping halaman pencarian publik YouTube (`https://www.youtube.com/results?search_query=...`) tanpa API key.
* **Environment Variables:**
  - `YOUTUBE_API_KEY`: Key server Google Cloud (Opsional; jika kosong otomatis beralih ke mode publik).
  - `YOUTUBE_DAILY_QUOTA`: Batas kuota harian (default: `10000` unit).
  - `YT_SEARCH_RESERVE_UNITS`: Cadangan unit untuk pencarian `search.list` (default: `6000` unit).
  - `YT_TREND_LOOKBACK_DAYS`: Umur maksimal video (default: `90` hari).
  - `YT_SEARCH_DATE_PAGES`: Jumlah halaman pencarian discovery awal (default: `2`).
  - `YT_SEARCH_REFRESH_HOURS`: Interval discovery ulang (default: `6.0` jam).
  - `YT_STATS_INTERVAL_MINUTES`: Interval pengambilan snapshot views (default: `60.0` menit; `120` detik di mode demo).
  - `YT_EXCLUDE_TERMS`: Frasa negatif/noise hiburan (default: upin ipin, kartun, animasi, dll.).
  - `VIDEO_CLASSIFIER`: Mode klasifikasi judul (`auto` atau `rules`).
* **Authentication:** API Key via HTTP query parameter `?key=...`. Tidak memerlukan OAuth.
* **Quota & Rate Limit Handling:**
  - Dikelola oleh [`QuotaTracker`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/youtube/quota.py).
  - Biaya: `search.list` = 100 unit/request; `videos.list` = 1 unit per batch 50 video.
  - Snapshot views (1 unit) dipisahkan dari pencarian (100 unit) agar ticker live tetap hemat biaya.
  - Reset kuota otomatis setiap tengah malam zona waktu Pasifik (PT).
* **Error Handling:**
  - Jika kuota habis, melempar `QuotaExhaustedError` dan tidak melakukan request lagi hingga hari berikutnya.
  - Mode publik melakukan parsing HTML regex; jika gagal, mengembalikan daftar kosong tanpa menjatuhkan server.
* **Normalization & Relevance Filtering:**
  - Filter Negasi Wajib: Judul dan deskripsi dicek terhadap daftar istilah anak-anak/hiburan (`YT_EXCLUDE_TERMS`). Jika ada kata kecocokan, video dibuang.
  - Filter Sinyal Produk: Harus mengandung salah satu kata dari `topic.keywords` atau `topic.product_terms`.
  - Filter Intensi UMKM: Untuk topik dengan istilah umum (seperti "ayam goreng"), video wajib mengandung salah satu dari `UMKM_INTENT_TERMS` (misal: "resep", "review", "jualan", "usaha", "modal", "omzet", "franchise").

---

### 2.2 Google Maps (Sinyal Opini, Rating, & Pesaing Lokal)

* **Status:** `Implemented` via Apify Actor (Jalur aktif utama); `Planned/Optional` untuk direct Google Places API (New).
* **Tujuan:** Mengumpulkan ulasan pelanggan nyata dari toko, kafe, atau warung di kota tertentu yang menjual produk yang dimonitor.
* **Data yang Diambil:**
  - Tempat: `place_id`, `name`, `address`, `maps_uri`, `rating`, `user_rating_count`, `business_status`.
  - Ulasan: `review_id`, `text`, `stars`, `author_name`, `author_uri`, `created_at`, `url`.
* **Collector / Client:**
  - Client: [`app/maps/apify_client.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/maps/apify_client.py) (`ApifyMapsClient`)
  - Collector: [`app/maps/collector.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/maps/collector.py) (`MapsCollector`)
* **API / Provider:**
  - Apify Actor: `compass~crawler-google-places`
  - Polling API Apify: `POST https://api.apify.com/v2/acts/{actor_id}/runs` -> polling status `SUCCEEDED` -> `GET .../dataset/items`.
* **Environment Variables:**
  - `APIFY_TOKEN`: Token rahasia server Apify (Wajib jika ingin data Maps nyata).
  - `APIFY_ACTOR_ID`: Default `compass~crawler-google-places`.
  - `MAPS_MAX_PLACES_PER_SEARCH`: Batas tempat per pencarian kota (default: `3`).
  - `MAPS_MAX_REVIEWS_PER_PLACE`: Batas ulasan per tempat (default: `10`).
  - `MAPS_REFRESH_HOURS`: Interval refresh data Maps (default: `8.0` jam).
  - `MAPS_DAILY_REQUEST_CAP`: Batas harian request Maps (default: `30`).
  - `MAPS_MONTHLY_REQUEST_CAP`: Batas bulanan request Maps (default: `800`).
  - `MAPS_CONTENT_TTL_DAYS`: Masa retensi konten ulasan sebelum di-purge (default: `7` hari).
  - `DEFAULT_CITY`: Kota default (default: `Bandung`).
* **Authentication:** Bearer token server-side via header `Authorization: Bearer <APIFY_TOKEN>`. Token tidak pernah dikirim ke browser client.
* **Quota & Budget Guard:**
  - Dikelola oleh [`MapsUsageTracker`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/maps/usage.py).
  - Jika `daily_cap` atau `monthly_cap` terlampaui, request dibatalkan dengan `UsageCapExceededError`.
  - Jika `APIFY_TOKEN` tidak diisi, health check melaporkan `maps_configured: false` dan sistem tidak memanggil API (tidak ada mock palsu).
* **Error Handling:**
  - Timeout polling dikendalikan oleh `APIFY_POLL_TIMEOUT_SECONDS` (default: 600 detik).
  - Tangani `ApifyRunFailedError` jika status run `FAILED` atau `TIMED-OUT`.
* **Normalization & Relevance Filtering:**
  - Evaluasi di [`app/maps/relevance.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/maps/relevance.py):
    1. Klitika Bahasa Indonesia: Pencocokan kata menggunakan regex batas kata dengan klitika kepemilikan (`-nya`, `-ku`, `-mu`), contoh: kata kunci "cincau" mencakup teks "cincaunya".
    2. Relevansi Tempat: Tempat dianggap relevan jika nama tempat mengandung nama produk ATAU salah satu ulasannya menyebut nama produk, serta bisnis tidak tutup permanen.
    3. Kategorisasi Ulasan: Ulasan yang menyebut kata produk diberi label `opini_produk` dan dimasukkan ke feed produk. Ulasan yang hanya membahas parkir/suasana toko masuk kategori `opini_tempat`.

---

### 2.3 TikTok (Sinyal Konten & Sentimen Video Pendek)

* **Status:** `Implemented` via Apify Actor.
* **Tujuan:** Memantau konten video viral, reaksi pengguna, tagar tren, dan persepsi visual terhadap produk UMKM.
* **Data yang Diambil:**
  - Metadata Post: `post_id`, `text` (caption video), `author_name`, `author_url`, `url`, `published_at`.
  - Metrik Interaksi: `views`, `likes`, `comments`, `shares`.
  - Sentimen: Dihasilkan via pipeline analyzer worker (`positif`, `negatif`, `netral`).
* **Collector / Client:**
  - Client: [`app/social/apify_client.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/social/apify_client.py) (`SocialApifyClient`)
  - Collector: [`app/social/collector.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/social/collector.py) (`SocialCollector`)
* **API / Provider:**
  - Apify Actor: `clockworks~tiktok-scraper`
* **Environment Variables:**
  - `TIKTOK_ACTOR_ID`: Default `clockworks~tiktok-scraper`.
  - `SOCIAL_RESULTS_PER_QUERY`: Post per kata kunci (default: `50`).
  - `SOCIAL_LOOKBACK_DAYS`: Batas umur post yang disimpan (default: `30` hari).
  - `SOCIAL_REFRESH_HOURS`: Interval refresh (default: `12.0` jam).
  - `SOCIAL_DAILY_RUN_CAP`: Budget gabungan media sosial (default: `18` run/hari).
  - `SOCIAL_MONTHLY_RUN_CAP`: Budget bulanan (default: `450` run/bulan).
* **Konfigurasi Khusus demi Efisiensi:**
  - Download video/audio: `OFF` (tidak mengunduh media mentah).
  - Komentar TikTok: `OFF` (`SOCIAL_COMMENTS_ENABLED=false`).
* **Relevance Filtering:**
  - Teks caption diperiksa terhadap `topic.keywords` dan `topic.product_terms`. Post yang tidak menyebut produk langsung diabaikan.

---

### 2.4 Instagram (Sinyal Konten & Pembicaraan Visual)

* **Status:** `Implemented` via Apify Actor.
* **Tujuan:** Mengamati unggahan Instagram (Reels & Feed publik) untuk mendeteksi estetika kemasan, promo gerai, dan endorsement lokal.
* **Data yang Diambil:**
  - `post_id`, `caption`, `author_name`, `url`, `published_at`, `likes`, `comments`.
* **Collector / Client:**
  - [`app/social/apify_client.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/social/apify_client.py) dan [`app/social/collector.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/social/collector.py).
* **API / Provider:**
  - Apify Actor: `apify~instagram-scraper`.
* **Environment Variables:**
  - `INSTAGRAM_ACTOR_ID`: Default `apify~instagram-scraper`.
  - Menggunakan konfigurasi budget yang sama dengan `SOCIAL_*`.
* **Relevance Filtering:**
  - Caption disaring menggunakan fungsi `mentions_product()` lokal sebelum disimpan ke tabel `social_posts`.

---

## 3. Rincian Sumber Data Sekunder (Secondary & Supporting Sources)

### 3.1 Facebook (Post Diskusi Publik & Grup Lokal)

* **Status:** `Implemented` via Apify Actor.
* **Tujuan:** Mendeteksi rekomendasi kuliner/produk lokal dari postingan publik dan komunitas Facebook Indonesia.
* **Data yang Diambil:**
  - `post_id`, `text`, `url`, `published_at`, `likes`, `comments`, `shares`.
* **Collector / Client:**
  - [`app/social/apify_client.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/social/apify_client.py) dan [`app/social/collector.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/social/collector.py).
* **API / Provider:**
  - Apify Actor: `apify~facebook-search-scraper`.
* **Konfigurasi:**
  - `FACEBOOK_ACTOR_ID`: Default `apify~facebook-search-scraper`.
  - `FACEBOOK_RESULTS_PER_QUERY`: Default `25` (kuota lebih hemat dibanding TikTok/IG).

---

### 3.2 Shopee Indonesia (Katalog, Harga Pasar, & Sinyal Penjualan)

* **Status:** `Implemented` via Apify Actor.
* **Tujuan:** Mengamati harga pasaran riil, rentang harga diskon, rating produk, dan volume terjual (*historical sold count*) untuk produk UMKM sejenis.
* **Data yang Diambil:**
  - `product_id`, `title`, `description`, `price`, `original_price`, `rating`, `rating_count`, `sold_count`, `stock`, `shop_name`, `url`, `image_url`.
* **Collector / Client:**
  - Client: [`app/marketplace/apify_client.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/marketplace/apify_client.py) (`ShopeeApifyClient`)
  - Collector: [`app/marketplace/collector.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/marketplace/collector.py) (`MarketplaceCollector`)
  - Parser: [`app/marketplace/parsing.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/marketplace/parsing.py)
* **API / Provider:**
  - Apify Actor: `xtracto~shopee-scraper`.
* **Environment Variables:**
  - `SHOPEE_ACTOR_ID`: Default `xtracto~shopee-scraper`.
  - `MARKETPLACE_RESULTS_PER_QUERY`: Default `30`.
  - `MARKETPLACE_REFRESH_HOURS`: Default `12.0` jam.
  - `MARKETPLACE_DAILY_RUN_CAP`: Default `8` run/hari.
  - `MARKETPLACE_MONTHLY_RUN_CAP`: Default `200` run/bulan.
* **Normalisasi:**
  - Angka harga dikonversi dari berbagai format teks Indonesia (contoh "Rp 15.000", "15rb", "1.5jt") menjadi nilai float rupiah murni.
* **Relevance Filtering:**
  - Judul, deskripsi, dan kategori digabung; harus mengandung kata kunci produk dan tidak memuat kata negasi.

---

### 3.3 Review Bridge / Chrome Extension (Semi-Live Ingest Marketplace)

* **Status:** `Implemented` (Folder [`integrations/marketplace-extension/`](file:///d:/UNDIP/EXASTI/POC_Scrapper/integrations/marketplace-extension/)).
* **Tujuan:** Menjembatani pengambilan ulasan pembeli dari halaman toko online yang dibuka pengguna (Shopee, Tokopedia, TikTok Shop) tanpa melanggar kebijakan bot atau memicu CAPTCHA.
* **Mekanisme Kerja:**
  - Pengguna membuka halaman produk di browser.
  - Extension membaca kartu ulasan yang telah ter-render di DOM (`content.js`).
  - Mengirim payload ke backend via `POST /api/ingest/marketplace`.
* **Keamanan & Privasi:**
  - Username pembeli **sengaja tidak diambil** demi kepatuhan privasi.
  - URL disanitasi: membuang query tracking / referral dan membatasi domain ke `tokopedia.com`, `shopee.co.id`, `tiktok.com`.
  - Deduplikasi berbasis hash SHA-256 (`marketplace + product_id + product_url + review_text`).
  - Otorisasi via header `X-Ingest-Token` jika `MARKETPLACE_INGEST_TOKEN` diisi di `.env`, atau dibatasi hanya untuk host loopback (`127.0.0.1`/`localhost`).

---

## 4. Sumber Data Warisan / Fallback / Demo (Legacy Sources)

Sumber-sumber ini berasal dari arsitektur v2 dan dipertahankan untuk kebutuhan pengujian offline tanpa internet:

| Sumber | File Implementasi | Mekanisme & Keterangan | Status di v3 |
|---|---|---|---|
| **Replay CSV** | [`app/collectors/replay.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/collectors/replay.py) | Membaca baris ulasan dari [`data/seed_comments.csv`](file:///d:/UNDIP/EXASTI/POC_Scrapper/data/seed_comments.csv) secara berulang dengan interval `REPLAY_INTERVAL_SECONDS`. Cocok untuk simulasi feed saat presentasi offline. | `Optional / Demo Fallback` |
| **Play Store** | [`app/collectors/playstore.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/collectors/playstore.py) | Menggunakan pustaka `google-play-scraper` untuk mengambil ulasan aplikasi UMKM tertentu berdasarkan `playstore_app_ids`. | `Optional / Legacy` |
| **Inbox Directory** | [`app/collectors/inbox.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/collectors/inbox.py) | Memantau folder berkas lokal [`data/inbox/`](file:///d:/UNDIP/EXASTI/POC_Scrapper/data/inbox/) untuk file CSV ulasan yang dimasukkan manual. | `Optional / Legacy` |

---

## 5. Matriks Perbandingan Sumber Data

| Platform | Kebutuhan Token/Key | Provider Scraper | Jatah Biaya / Cap Default | Output Utama |
|---|---|---|---|---|
| **YouTube** | Opsional (`YOUTUBE_API_KEY`) | Google API v3 / Scraping Publik | 10.000 unit kuota harian | Views growth, video count, content mix |
| **Google Maps** | Wajib (`APIFY_TOKEN`) | Apify `compass~crawler-google-places` | 30 run/hari, 800 run/bulan | Tempat, rating, feed ulasan pelanggan |
| **TikTok** | Wajib (`APIFY_TOKEN`) | Apify `clockworks~tiktok-scraper` | 18 run/hari (dibagi bersama IG/FB) | Caption video, likes, views, sentimen |
| **Instagram** | Wajib (`APIFY_TOKEN`) | Apify `apify~instagram-scraper` | 18 run/hari (dibagi bersama TT/FB) | Caption post, engagement, sentimen |
| **Facebook** | Wajib (`APIFY_TOKEN`) | Apify `apify~facebook-search-scraper`| 18 run/hari (dibagi bersama TT/IG) | Post publik komunitas, sentimen |
| **Shopee** | Wajib (`APIFY_TOKEN`) | Apify `xtracto~shopee-scraper` | 8 run/hari, 200 run/bulan | Harga produk, rating toko, total terjual |
| **Review Bridge** | Tidak butuh API Key | Chrome DOM Extension | Loopback only / token internal | Ulasan marketplace semi-live |
