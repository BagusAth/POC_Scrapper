# 06 — Software Requirements Specification (SRS)

Dokumen ini mendokumentasikan spesifikasi teknis perangkat lunak (*Software Requirements Specification*) berdasarkan implementasi aktual di codebase branch `test`.

---

## 1. Functional Requirements (FR)

### FR-001: Pendaftaran Topik Produk UMKM
* **Deskripsi:** Sistem menyediakan layanan untuk mendaftarkan topik produk baru yang ingin dipantau dengan validasi nama unik, kata kunci pencarian, istilah produk, kata negasi, dan kota target.
* **Input:** Payload JSON `TopicCreate` (`name`, `keywords`, `product_terms`, `exclude_terms`, `category`, `cities`).
* **Output:** Objek JSON `Topic` baru dengan status awal `discovering`.
* **Dependency:** Database backend (`topics` table).
* **Referensi Implementasi:**
  - Route: [`app/api/routes_topics.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/api/routes_topics.py) -> `create_topic()`
  - Service: [`app/topics/service.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/topics/service.py) -> `TopicService.create()`
* **Status:** `Implemented`

### FR-002: Saran Kata Kunci Otomatis (Topic Keyword Suggestion)
* **Deskripsi:** Sistem menghasilkan saran kata kunci pencarian (*keywords*), istilah produk (*product terms*), dan deteksi kategori awal berdasarkan nama produk yang diinput pengguna.
* **Input:** Nama produk (`name: str`) dan kota target.
* **Output:** JSON berisi daftar kata kunci, istilah produk, kategori yang disarankan, dan kota target.
* **Dependency:** Logika tokenisasi string dan heuristik kategori F&B.
* **Referensi Implementasi:**
  - Route: [`app/api/routes_topics.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/api/routes_topics.py) -> `suggest()` / `_suggest()`
* **Status:** `Implemented`

### FR-003: Discovery & Pelacakan Video Tren YouTube
* **Deskripsi:** Mengambil daftar video YouTube relevan untuk produk yang dipantau menggunakan API resmi atau fallback web publik, menerapkan filter noise hiburan dan intent UMKM, serta mengklasifikasikan jenis konten.
* **Input:** Topik aktif dan interval waktu penyegaran (`YT_SEARCH_REFRESH_HOURS`).
* **Output:** Baris video tersimpan pada tabel `videos` dengan klasifikasi `review`, `resep`, `ide_usaha`, atau `lainnya`.
* **Dependency:** `YouTubeClient` / `PublicYouTubeClient`, `ContentTypeClassifier`, `QuotaTracker`.
* **Referensi Implementasi:**
  - Service: [`app/youtube/trend_discovery.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/youtube/trend_discovery.py) -> `TrendDiscovery.discover()`
  - Classifier: [`app/youtube/content_type.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/youtube/content_type.py) -> `ContentTypeClassifier.classify()`
* **Status:** `Implemented`

### FR-004: Snapshot & Perhitungan Metrik Tren YouTube
* **Deskripsi:** Mengambil angka statistik views, likes, dan comments terbaru secara berkala, lalu menghitung metrik pasokan video 30 hari, median views per hari (Indeks Perhatian), dan pertambahan views 24 jam.
* **Input:** ID topik dan record historis snapshot video dari tabel `video_stats`.
* **Output:** Objek `TrendMetrics` dan event broadcast SSE `trend_tick`.
* **Dependency:** Database backend, `EventBroker`.
* **Referensi Implementasi:**
  - Service: [`app/youtube/stats_snapshot.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/youtube/stats_snapshot.py) -> `StatsSnapshotService.capture()`
  - Perhitungan: [`app/youtube/trend_metrics.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/youtube/trend_metrics.py) -> `calculate_trend_metrics()`
  - Route: [`app/api/routes_trend.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/api/routes_trend.py) -> `trend()`, `trend_videos()`
* **Status:** `Implemented`

### FR-005: Koleksi Tempat & Ulasan Google Maps via Apify
* **Deskripsi:** Menjalankan Actor Apify Google Maps per kota, mengambil ulasan terbaru, menyaring relevansi terhadap produk UMKM, dan menyimpan profil tempat serta opini pelanggan.
* **Input:** Objek `Topic`, nama kota, konfigurasi budget cap.
* **Output:** Baris pada tabel `places`, `place_snapshots`, dan ulasan pada tabel `comments` (kategori `opini_produk` atau `opini_tempat`).
* **Dependency:** `ApifyMapsClient`, `MapsUsageTracker`, `MapsCollector`.
* **Referensi Implementasi:**
  - Client: [`app/maps/apify_client.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/maps/apify_client.py) -> `ApifyMapsClient.collect()`
  - Collector: [`app/maps/collector.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/maps/collector.py) -> `MapsCollector.refresh_topic()`
  - Filter: [`app/maps/relevance.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/maps/relevance.py) -> `place_relevance()`
  - Route: [`app/api/routes_maps.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/api/routes_maps.py) -> `places()`, `feed()`
* **Status:** `Implemented`

### FR-006: Koleksi & Filter Post Sosial (TikTok, Instagram, Facebook)
* **Deskripsi:** Mengambil postingan publik terbaru dari TikTok, Instagram, dan Facebook via Apify, menyaring caption yang memuat istilah produk, dan mencatat metrik engagement.
* **Input:** Topik aktif dan batas lookback 30 hari.
* **Output:** Baris pada tabel `social_posts` dan `social_post_stats`.
* **Dependency:** `SocialApifyClient`, `SocialUsageTracker`, `SocialCollector`.
* **Referensi Implementasi:**
  - Client: [`app/social/apify_client.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/social/apify_client.py) -> `SocialApifyClient.collect()`
  - Collector: [`app/social/collector.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/social/collector.py) -> `SocialCollector.refresh_topic()`
  - Route: [`app/api/routes_social.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/api/routes_social.py) -> `feed()`, `stats()`
* **Status:** `Implemented`

### FR-007: Koleksi Sinyal Katalog Shopee Indonesia
* **Deskripsi:** Mengambil data katalog produk Shopee melalui Apify Actor, mengekstrak rentang harga, rating, jumlah ulasan, dan unit terjual (*sold count*).
* **Input:** Query topik pencarian Shopee.
* **Output:** Baris pada tabel `marketplace_products`.
* **Dependency:** `ShopeeApifyClient`, `MarketplaceUsageTracker`, `MarketplaceCollector`.
* **Referensi Implementasi:**
  - Client: [`app/marketplace/apify_client.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/marketplace/apify_client.py) -> `ShopeeApifyClient.collect()`
  - Collector: [`app/marketplace/collector.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/marketplace/collector.py) -> `MarketplaceCollector.refresh_topic()`
  - Route: [`app/api/routes_marketplace.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/api/routes_marketplace.py) -> `products()`, `stats()`
* **Status:** `Implemented`

### FR-008: Analisis Sentimen Batch & Fallback Berjenjang
* **Deskripsi:** Memproses teks komentar dan caption berstatus `pending` secara asinkron menggunakan Gemini AI Studio. Jika kuota habis atau terjadi kegagalan berulang (3x berturut-turut), otomatis beralih ke analisis berbasis Leksikon lokal.
* **Input:** Batch teks komentar/ulasan (`list[tuple[id, text]]`).
* **Output:** Objek `SentimentResult` (`sentiment: positif|negatif|netral`, `score: float`, `topics: list[str]`).
* **Dependency:** `GeminiAnalyzer`, `LexiconAnalyzer`, `AsyncRateLimiter`.
* **Referensi Implementasi:**
  - Worker: [`app/analyzer/worker.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/analyzer/worker.py) -> `AnalyzerWorker.process_batch()`
  - Gemini: [`app/analyzer/gemini.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/analyzer/gemini.py) -> `GeminiAnalyzer.analyze()`
  - Lexicon: [`app/analyzer/lexicon.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/analyzer/lexicon.py) -> `LexiconAnalyzer.analyze()`
* **Status:** `Implemented`

### FR-009: Perhitungan Frekuensi Kata Kunci Dominan (NLP)
* **Deskripsi:** Menghitung frekuensi kemunculan kata unigram (1 kata) atau bigram (2 kata) dari ulasan pelanggan yang tersaring, dengan eliminasi stopwords bahasa Indonesia dan kata produk.
* **Input:** Korpus teks ulasan dalam jendela waktu (`window`), parameter `ngram` (1 atau 2).
* **Output:** List pasangan `CountItem` (`word`, `count`) terurut frekuensi tertinggi.
* **Dependency:** [`app/nlp/keywords.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/nlp/keywords.py), [`app/nlp/stopwords_id.txt`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/nlp/stopwords_id.txt).
* **Referensi Implementasi:**
  - Function: `top_keywords()` di [`app/nlp/keywords.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/nlp/keywords.py)
  - Endpoint: [`app/api/routes_stats.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/api/routes_stats.py) -> `get_stats()`
* **Status:** `Implemented`

### FR-010: Sintesis AI & Ide Inovasi Otomatis
* **Deskripsi:** Menghasilkan narasi ringkasan opini produk, mengekstrak 3 poin pujian teratas, 3 poin komplain utama, serta merumuskan 3 ide inovasi produk konkret.
* **Input:** Kumpulan ulasan terbaru yang sudah teranalisis sentimennya.
* **Output:** Objek `Summary` (`summary`, `praises`, `complaints`, `innovation_ideas`, `analyzer`).
* **Dependency:** `GeminiSummaryPayload` atau fallback `_template_summary()`.
* **Referensi Implementasi:**
  - Service: [`app/api/routes_summary.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/api/routes_summary.py) -> `SummaryService.get()`
* **Status:** `Implemented`

### FR-011: Streaming Event Real-Time (SSE)
* **Deskripsi:** Memancarkan notifikasi perubahan data (perubahan status topik, penambahan video/ulasan baru, penyelesaian analisis sentimen, tick kenaikan views) ke browser klien.
* **Input:** Panggilan `broker.publish(event_name, data)` dari komponen backend.
* **Output:** HTTP event stream (`text/event-stream`) berformat `event: <name>\ndata: <json>\n\n`.
* **Dependency:** [`app/events.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/events.py) (`EventBroker`), [`app/api/routes_stream.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/api/routes_stream.py).
* **Status:** `Implemented`

### FR-012: Ingest Ulasan Marketplace Semi-Live (Review Bridge Extension)
* **Deskripsi:** Menerima ulasan produk dari Chrome extension browser pengguna, melakukan validasi host marketplace, sanitasi URL, deduplikasi SHA-256, dan memasukkannya ke antrean analisis sentimen.
* **Input:** Payload `MarketplaceBatch` via HTTP POST `/api/ingest/marketplace`.
* **Output:** Jumlah ulasan yang diterima dan ID ulasan yang di-insert.
* **Dependency:** [`app/api/routes_ingest.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/api/routes_ingest.py).
* **Status:** `Implemented`

---

## 2. Non-Functional Requirements (NFR)

### NFR-001: Kontrol Anggaran & Batas Kuota Eksternal (Budget Guard)
* **Deskripsi:** Sistem harus melacak setiap unit panggilan API berbayar (YouTube unit, Apify actor runs) dan menolak panggilan baru secara deterministik saat kuota habis untuk mencegah tagihan membengkak.
* **Referensi:** [`app/youtube/quota.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/youtube/quota.py), [`app/maps/usage.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/maps/usage.py), [`app/social/usage.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/social/usage.py), [`app/marketplace/usage.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/marketplace/usage.py).
* **Status:** `Implemented`

### NFR-002: Dual Database Compatibility
* **Deskripsi:** Aplikasi harus mampu berjalan tanpa konfigurasi rumit di SQLite lokal (`aiosqlite`) untuk keperluan development, serta otomatis beralih ke PostgreSQL Supabase (`asyncpg`) di schema terisolasi `scraper` saat `SUPABASE_DB_URL` tersedia.
* **Referensi:** [`app/db.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/db.py), [`app/db_postgres.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/db_postgres.py).
* **Status:** `Implemented`

### NFR-003: Rate Limiting & Toleransi Kesalahan AI (AI Fault Tolerance)
* **Deskripsi:** Panggilan ke Gemini API dibatasi maksimal 8 RPM via `AsyncRateLimiter`. Jika terjadi HTTP 429 atau kuota habis, waktu jeda (*exponential cooldown*) diterapkan dan seluruh komputasi otomatis dialihkan ke Leksikon lokal.
* **Referensi:** [`app/analyzer/rate_limiter.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/analyzer/rate_limiter.py), [`app/analyzer/worker.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/analyzer/worker.py).
* **Status:** `Implemented`

### NFR-004: Kepatuhan Privasi Data Pengguna
* **Deskripsi:** Sistem tidak mengekstraksi atau menyimpan username pembeli e-commerce atau identitas sensitif pengguna. Ulasan Maps diberi waktu retensi (*TTL*) default 7 hari di database.
* **Referensi:** [`app/maps/collector.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/maps/collector.py) (`purge_expired_maps`), [`app/api/routes_ingest.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/api/routes_ingest.py).
* **Status:** `Implemented`

### NFR-005: Transparansi Status Sistem (Honesty Principle)
* **Deskripsi:** Endpoint `/api/health` harus melaporkan status konfigurasi token dan mode aktif secara jujur. Jika token Apify atau YouTube belum diisi, sistem wajib melaporkannya sebagai `Not Configured`, bukan menghasilkan data tiruan palsu.
* **Referensi:** [`app/api/routes_health.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/api/routes_health.py).
* **Status:** `Implemented`

---

## 3. External Interface Requirements

1. **YouTube Data API v3:** Menggunakan protokol REST HTTPS dengan metode `GET /youtube/v3/search` dan `GET /youtube/v3/videos`.
2. **Apify REST API v2:** Menggunakan metode `POST /v2/acts/{actor_id}/runs` untuk memulai task scraping dan `GET /v2/actor-runs/{run_id}` untuk pengecekan status serta `GET /v2/datasets/{dataset_id}/items` untuk download hasil.
3. **Google AI Studio (Gemini):** Menggunakan SDK resmi `google-genai` dengan model `gemini-3.8-flash` pada mode structured JSON schema output.
4. **Server-Sent Events (SSE):** Antarmuka streaming HTTP berbasis text/event-stream sesuai standar W3C.
5. **Review Bridge Extension API:** Endpoint `POST /api/ingest/marketplace` yang dilindungi validasi loopback dan header `X-Ingest-Token`.

---

## 4. Matriks Status Implementasi SRS

| ID | Nama Kebutuhan | Status Aktual | Catatan |
|---|---|---|---|
| FR-001 | Pendaftaran Topik Produk | `Implemented` | Maksimal 20 topik aktif |
| FR-002 | Saran Kata Kunci Otomatis | `Implemented` | Berbasis heuristik bahasa Indonesia |
| FR-003 | Discovery Video YouTube | `Implemented` | API resmi / Public scraper fallback |
| FR-004 | Snapshot & Metrik Tren | `Implemented` | Ticker views live per jam & 24 jam |
| FR-005 | Ulasan Google Maps | `Implemented` | Apify places crawler terintegrasi |
| FR-006 | Sinyal Media Sosial (TT/IG/FB) | `Implemented` | Apify social actor terintegrasi |
| FR-007 | Sinyal Katalog Shopee | `Implemented` | Apify shopee actor terintegrasi |
| FR-008 | Analisis Sentimen Gemini/Leksikon | `Implemented` | Batching async dengan fallback otomatis |
| FR-009 | Penghitung Kata Kunci NLP | `Implemented` | Unigram & bigram dengan stopwords ID |
| FR-010 | Sintesis Inovasi AI | `Implemented` | Rangkuman pujian, keluhan & ide inovasi |
| FR-011 | Live Feed Server-Sent Events | `Implemented` | Broadcast multi-event non-blocking |
| FR-012 | Review Bridge Extension | `Implemented` | Chrome extension di `integrations/` |
| NFR-001| Budget Guard & Usage Tracker | `Implemented` | Log persisten di tabel `api_usage` |
| NFR-002| Dual DB SQLite/Postgres | `Implemented` | Postgres otomatis jika ada Supabase URL |
| NFR-003| AI Rate Limiter & Fallback | `Implemented` | Leaky-bucket 8 RPM |
| NFR-004| Privasi & TTL Data | `Implemented` | Purge data maps > 7 hari |
| NFR-005| Kejujuran Status Kesehatan | `Implemented` | Terverifikasi via `/api/health` |
