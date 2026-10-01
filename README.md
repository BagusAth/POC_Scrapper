# Pemantau Tren & Opini UMKM

POC v3 membantu UMKM membaca dua sinyal yang berbeda:

- **YouTube untuk tren produk** — pasokan video, pertumbuhan views, format konten, dan sinyal persaingan.
- **Google Maps untuk opini pelanggan** — tempat, rating, ulasan produk, dan pesaing lokal.
- **TikTok + Instagram untuk sinyal konten** — post publik, caption, engagement, dan creator signal dari keyword/hashtag.

Implementasi saat ini mencakup **P3/M3 + Maps/Social POC**: fondasi data dan kuota, discovery YouTube, snapshot metrik, live ticker SSE, dashboard tren, kolektor opini Google Maps, serta discovery TikTok/Instagram melalui Apify. Tanpa `APIFY_TOKEN`, aplikasi tidak melakukan request dan secara jujur menampilkan sumber Apify belum dikonfigurasi.

## Jalankan dalam kurang dari 10 menit

Butuh Python 3.11 atau lebih baru.

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python scripts/reset_db.py
uvicorn app.main:app --reload
```

Buka [http://127.0.0.1:8000](http://127.0.0.1:8000). Tiga topik awal tersedia: Cappuccino Cincau, Kopi Susu Gula Aren, dan Seblak. Tombol **Pantau produk** menerima produk lain seperti keripik pisang, parfum lokal, atau es teh jumbo; tidak ada kata kunci yang dikunci ke “sepatu”.

### Deploy ke Vercel (POC)

Vercel mengenali `index.py` sebagai entrypoint FastAPI. Deploy dari root repo dengan `npx vercel --prod`, lalu isi Environment Variables `APIFY_TOKEN`, `SOURCES=youtube_trend,maps,tiktok,instagram`, dan `DATABASE_PATH=/tmp/umkm-poc.db` pada project Vercel. Filesystem `/tmp` bersifat sementara pada serverless; gunakan database eksternal sebelum mengandalkan riwayat lintas instance.

### Supabase MCP

Repo ini menyertakan `.mcp.json` untuk Supabase MCP yang dibatasi ke project `itbzozqigakvotvadreb` dan mode `read_only`. Buka ulang client MCP/Codex dari root repo ini, lalu selesaikan OAuth Supabase saat diminta. Konfigurasi tidak menyimpan API key atau service-role secret.

## Data live dan kejujuran sumber

Dashboard tidak memakai data demo untuk Panel A.

- Jika `YOUTUBE_API_KEY` diisi, aplikasi memakai YouTube Data API v3 resmi. Discovery menggunakan `search.list`, sedangkan snapshot views memakai `videos.list`.
- Jika key kosong, POC memakai halaman pencarian dan halaman video YouTube yang publik. Angka views dibaca ulang pada snapshot berikutnya. Mode ini tetap data nyata, tetapi bersifat **best effort** dan lebih mudah berubah dibanding API resmi.
- Komentar YouTube sengaja dimatikan (`YT_COMMENTS_ENABLED=false`). Komentar video sering membahas kreator/tutorial, bukan pengalaman terhadap produk.
- Angka tren adalah sampel hasil pencarian, bukan seluruh YouTube. Produk niche memang dapat menunjukkan kenaikan kecil atau tidak ada video; aplikasi tidak mengarang angka untuk mengisi grafik.
- Jika `APIFY_TOKEN` diisi, server menjalankan Actor `compass~crawler-google-places`, menunggu status `SUCCEEDED`, lalu mengambil dataset ulasan terbaru. Hasilnya difilter berdasarkan nama/kata produk sebelum masuk feed opini.
- Jika token kosong, tidak ada data Maps/TikTok/Instagram sintetis yang dibuat; health API menampilkan sumber Apify belum dikonfigurasi.
- TikTok dan Instagram dikumpulkan dalam satu Actor run per platform/topik. Maksimal tiga keyword/hashtag digabung, sampai 50 post per query, lalu filter umur dan relevansi dilakukan lokal. Download video, thumbnail, avatar, transkripsi, AI description, dan crawl komentar dimatikan default.
- Caption sosial yang lolos relevansi dianalisis menjadi positif, negatif, atau netral memakai analyzer Gemini yang dikonfigurasi dan fallback leksikon lokal. Statistik harian, aspek dominan, dan label per post ditampilkan di dashboard.

Uji satu kata produk tanpa mengubah database utama:

```bash
source .venv/bin/activate
python scripts/yt_trend_probe.py "cappuccino cincau"
python scripts/yt_trend_probe.py "keripik pisang"
python scripts/maps_probe.py "sepatu lokal" --city Bandung
python scripts/social_probe.py "sepatu lokal" --platform tiktok
python scripts/social_probe.py "sepatu lokal" --platform instagram
```

Probe YouTube mencetak query, jumlah kandidat/relevan, komposisi konten, video teratas, dan unit API yang dipakai. Probe Maps menjalankan satu Actor Apify dan hanya mencetak ringkasan tempat relevan. Probe sosial menjalankan satu Actor per platform dan mencetak post relevan tanpa menulis ke database utama; tanpa token probe berhenti sebelum mengirim request.

## Konfigurasi utama

Semua key hanya dibaca dari `.env`; jangan masukkan key ke source code atau commit `.env`.

| Variabel | Default | Fungsi |
|---|---:|---|
| `SOURCES` | `youtube_trend,maps` | Sumber yang disiapkan aplikasi |
| `YOUTUBE_API_KEY` | kosong | Key server YouTube Data API v3; kosong memakai mode publik |
| `YT_TREND_LOOKBACK_DAYS` | `90` | Batas umur video aktif |
| `YT_SEARCH_DATE_PAGES` | `2` | Halaman discovery terbaru |
| `YT_SEARCH_REFRESH_HOURS` | `6` | Interval discovery ulang |
| `YT_MAX_VIDEOS_PER_TOPIC` | `150` | Batas video per topik |
| `YT_STATS_INTERVAL_MINUTES` | `60` | Interval snapshot statistik |
| `YT_COMMENTS_ENABLED` | `false` | Wajib false pada v3 |
| `YT_EXCLUDE_TERMS` | `upin ipin,...` | Istilah hiburan/noise yang dikeluarkan dari feed YouTube |
| `VIDEO_CLASSIFIER` | `auto` | Gemini bila tersedia, lalu fallback aturan |
| `GEMINI_API_KEY` | kosong | Klasifikasi judul dan fitur AI tahap lanjut |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Model Gemini |
| `MAPS_PROVIDER` | `apify` | Provider Maps POC (`apify` atau `places` untuk integrasi berikutnya) |
| `APIFY_TOKEN` | kosong | Token server Apify; jangan pernah dikirim ke browser |
| `APIFY_ACTOR_ID` | `compass~crawler-google-places` | Actor Google Maps yang dijalankan |
| `APIFY_POLL_INTERVAL_SECONDS` | `5` | Jeda polling status run |
| `APIFY_POLL_TIMEOUT_SECONDS` | `600` | Batas waktu satu run |
| `MAPS_MAX_PLACES_PER_SEARCH` | `3` | Cap tempat per kota pada POC |
| `MAPS_MAX_REVIEWS_PER_PLACE` | `10` | Cap ulasan per tempat pada POC |
| `GOOGLE_MAPS_API_KEY` | kosong | Disimpan untuk provider Places API langsung di tahap berikutnya |
| `GOOGLE_MAPS_EMBED_KEY` | kosong | Key browser terpisah dan opsional |
| `MAPS_DAILY_REQUEST_CAP` | `30` | Hard cap request Maps per hari |
| `MAPS_MONTHLY_REQUEST_CAP` | `800` | Hard cap request Maps per bulan |
| `DEFAULT_CITY` | `Bandung` | Kota awal untuk topik baru |
| `TIKTOK_ACTOR_ID` | `clockworks~tiktok-scraper` | Actor TikTok |
| `INSTAGRAM_ACTOR_ID` | `apify~instagram-scraper` | Actor Instagram |
| `SOCIAL_RESULTS_PER_QUERY` | `50` | Post per keyword/hashtag |
| `SOCIAL_MAX_QUERIES_PER_TOPIC` | `3` | Keyword/hashtag per run |
| `SOCIAL_LOOKBACK_DAYS` | `30` | Window post yang disimpan |
| `SOCIAL_REFRESH_HOURS` | `12` | Interval refresh TikTok/Instagram |
| `SOCIAL_DAILY_RUN_CAP` | `12` | Cap Actor run sosial per hari |
| `SOCIAL_MONTHLY_RUN_CAP` | `300` | Cap Actor run sosial per bulan |
| `SOCIAL_COMMENTS_ENABLED` | `false` | Komentar sengaja nonaktif untuk efisiensi |
| `SOCIAL_SENTIMENT_ENABLED` | `true` | Analisis sentimen caption sosial yang relevan |
| `MAX_ACTIVE_TOPICS` | `20` | Batas topik aktif |
| `DATABASE_PATH` | `data/app.db` | SQLite lokal |

Saat `VIDEO_CLASSIFIER=auto` dan `GEMINI_API_KEY` tersedia, maksimal 50 judul diklasifikasikan per request menjadi `review`, `resep`, `ide_usaha`, atau `lainnya`. Judul diperlakukan sebagai data, request melewati rate limiter bersama, dan kegagalan selalu jatuh ke aturan lokal.

## Setup key dan Apify

Untuk mode API resmi:

1. Buat project Google Cloud.
2. Aktifkan **YouTube Data API v3**.
3. Buat token Apify dengan scope minimum yang diperlukan, lalu isi `APIFY_TOKEN` di `.env` (server saja).
4. Biarkan `MAPS_PROVIDER=apify`; aplikasi memakai Actor `compass~crawler-google-places` dan cap lokal `MAPS_*`.
5. Jika kelak memakai provider Places langsung, baru isi `GOOGLE_MAPS_API_KEY` dan ubah `MAPS_PROVIDER=places`.
6. Jika memakai Maps Embed, buat key browser berbeda yang hanya mengizinkan Maps Embed API dan referrer aplikasi.
7. Buat Gemini key melalui Google AI Studio dan isi `GEMINI_API_KEY`.

Referensi Actor: [input schema Google Maps Scraper](https://apify.com/compass/crawler-google-places/input-schema) dan [API Actor](https://apify.com/compass/crawler-google-places/api).

Referensi sosial: [TikTok Scraper input](https://apify.com/clockworks/tiktok-scraper/input-schema), [TikTok API](https://apify.com/clockworks/tiktok-scraper/api), [Instagram Scraper input](https://apify.com/apify/instagram-scraper/input-schema), dan [Instagram API](https://apify.com/apify/instagram-scraper/api). Satu token Apify berlaku untuk semua Actor; token hanya dipakai server.

Restart server setelah mengubah `.env`. Jangan pernah menggunakan key server di JavaScript browser.

## Metrik Panel A

- **Video baru 30 hari** dibanding 30 hari sebelumnya.
- **Indeks perhatian**: median views per hari dari video berumur maksimal 30 hari.
- **Kenaikan views 1/24 jam**: selisih snapshot nyata. Perbandingan 24 jam butuh riwayat 48 jam.
- **Coverage**: porsi video yang memiliki pasangan snapshot yang cukup.
- **Content mix**: proporsi review, resep, ide usaha, dan lainnya.
- **Persaingan ide usaha** meningkat hanya jika volume dan proporsinya benar-benar bertambah.

Snapshot tidak diubah setelah ditulis. Event `trend_tick` dikirim lewat Server-Sent Events sehingga browser memperbarui metrik tanpa reload.

## Endpoint v3

- `GET /api/health` — mode sumber, konfigurasi key, dan status AI.
- `GET /api/usage` — unit YouTube dan request Maps terhadap cap.
- `GET /api/topics` — watchlist produk.
- `POST /api/topics/suggest` — saran kata kunci cepat.
- `POST /api/topics` — tambah topik dan mulai discovery latar belakang.
- `DELETE /api/topics/{id}` — nonaktifkan topik.
- `GET /api/trend?topic_id=...` — seluruh metrik tren.
- `GET /api/trend/videos?topic_id=...&sort=gain&type=review` — tabel bukti video.
- `GET /api/maps/places?topic_id=...` — tempat relevan dan snapshot rating dari koleksi Apify.
- `GET /api/maps/feed?topic_id=...` — opini Maps yang lolos filter produk.
- `GET /api/social/feed?topic_id=...&platform=tiktok|instagram` — post publik yang caption-nya relevan.
- `GET /api/social/stats?topic_id=...` — jumlah post, agregat engagement, distribusi sentiment, aspek, dan trend harian.
- `GET /api/stream` — `trend_tick`, `topic_status`, dan keep-alive.
- `GET /docs` — dokumentasi OpenAPI interaktif.

Endpoint v2 masih ada sementara untuk kompatibilitas internal, tetapi dashboard P3 hanya memakai endpoint v3 di atas.

## Arsitektur

```text
Topik produk
   │
   ├── YouTube discovery ── filter relevansi ── klasifikasi jenis
   │                                             │
   │                                             ▼
   │                                      videos + snapshots
   │                                             │
   │                               metrik deterministik + SSE
   │                                             │
   └─────────────────────────────────────────────▼
                                         Dashboard Panel A

Google Maps usage guard ──► Apify Actor run ──► polling ──► dataset
                                      │
                                      └── filter relevansi ──► places + opini produk
```

SQLite menggunakan WAL, busy timeout, index per topik/waktu, dan tabel `api_usage` persisten. Pencarian YouTube yang mahal dan pembacaan statistik yang murah memiliki bucket kuota terpisah. Hari YouTube mengikuti zona waktu Pasifik; cap Maps mengikuti UTC.

## Testing

```bash
source .venv/bin/activate
python -m pytest -q
node --check static/app.js
node --check static/ui.js
```

Seluruh test memakai SQLite sementara, fake client, atau `httpx.MockTransport`; test tidak memanggil YouTube, Google Maps, atau Gemini sungguhan.

## Reset data

```bash
python scripts/reset_db.py
```

Perintah ini menghapus database lokal aplikasi, membuat schema v3, dan menanam tiga topik awal. Gunakan hanya saat data lokal memang boleh diganti.

## Privasi dan kepatuhan

- Key server tidak pernah masuk response API atau frontend.
- Panel tren menyimpan metadata publik dan snapshot agregat video, bukan komentar YouTube.
- Implementasi Maps menjaga atribusi penulis/Google, TTL konten, pembatasan cache, dan ketentuan sumber yang dipakai. Place ID dapat dipertahankan; konten Places/ulasan memiliki TTL POC.
- Data Places tidak boleh ditempelkan pada peta non-Google.
- Tinjau ketentuan Google Maps Platform terbaru sebelum penggunaan produksi; TTL POC bukan jaminan kepatuhan.

## Struktur penting

```text
app/youtube/       discovery, client, quota, snapshot, metrik, scheduler
app/maps/          Apify client, parser, relevansi, collector, error, budget guard
app/topics/        layanan watchlist produk
app/api/           endpoint topics, trend, usage, health, SSE
static/            dashboard P3 responsif
config/            seed topik dan aspek
scripts/           reset database dan probe sumber
tests/             unit/integrasi tanpa API eksternal
```

Spesifikasi implementasi lengkap ada di [SPEC.md](SPEC.md).
