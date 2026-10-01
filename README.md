# Pemantau Tren & Opini UMKM

POC v3 membantu UMKM membaca dua sinyal yang berbeda:

- **YouTube untuk tren produk** — pasokan video, pertumbuhan views, format konten, dan sinyal persaingan.
- **Google Maps untuk opini pelanggan** — tempat, rating, ulasan produk, dan pesaing lokal.

Implementasi saat ini selesai sampai **P3/M3**: fondasi data dan kuota, discovery YouTube, snapshot metrik, live ticker SSE, dashboard tren, serta pencarian topik produk bebas. Kolektor Google Maps dimulai pada M4; status dan budget guard-nya sudah tersedia, tetapi UI tidak mengklaim bahwa ulasan Maps sudah dikumpulkan.

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

## Data live dan kejujuran sumber

Dashboard tidak memakai data demo untuk Panel A.

- Jika `YOUTUBE_API_KEY` diisi, aplikasi memakai YouTube Data API v3 resmi. Discovery menggunakan `search.list`, sedangkan snapshot views memakai `videos.list`.
- Jika key kosong, POC memakai halaman pencarian dan halaman video YouTube yang publik. Angka views dibaca ulang pada snapshot berikutnya. Mode ini tetap data nyata, tetapi bersifat **best effort** dan lebih mudah berubah dibanding API resmi.
- Komentar YouTube sengaja dimatikan (`YT_COMMENTS_ENABLED=false`). Komentar video sering membahas kreator/tutorial, bukan pengalaman terhadap produk.
- Angka tren adalah sampel hasil pencarian, bukan seluruh YouTube. Produk niche memang dapat menunjukkan kenaikan kecil atau tidak ada video; aplikasi tidak mengarang angka untuk mengisi grafik.
- Google Maps ditampilkan sebagai **belum dikonfigurasi / tahap berikutnya** sampai kolektor M4 tersedia dan key server diisi.

Uji satu kata produk tanpa mengubah database utama:

```bash
source .venv/bin/activate
python scripts/yt_trend_probe.py "cappuccino cincau"
python scripts/yt_trend_probe.py "keripik pisang"
```

Probe mencetak query, jumlah kandidat/relevan, komposisi konten, video teratas, dan unit API yang dipakai.

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
| `VIDEO_CLASSIFIER` | `auto` | Gemini bila tersedia, lalu fallback aturan |
| `GEMINI_API_KEY` | kosong | Klasifikasi judul dan fitur AI tahap lanjut |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Model Gemini |
| `GOOGLE_MAPS_API_KEY` | kosong | Key server Places API (New), dipakai mulai M4 |
| `GOOGLE_MAPS_EMBED_KEY` | kosong | Key browser terpisah dan opsional |
| `MAPS_DAILY_REQUEST_CAP` | `30` | Hard cap request Maps per hari |
| `MAPS_MONTHLY_REQUEST_CAP` | `800` | Hard cap request Maps per bulan |
| `DEFAULT_CITY` | `Bandung` | Kota awal untuk topik baru |
| `MAX_ACTIVE_TOPICS` | `5` | Batas topik aktif |
| `DATABASE_PATH` | `data/app.db` | SQLite lokal |

Saat `VIDEO_CLASSIFIER=auto` dan `GEMINI_API_KEY` tersedia, maksimal 50 judul diklasifikasikan per request menjadi `review`, `resep`, `ide_usaha`, atau `lainnya`. Judul diperlakukan sebagai data, request melewati rate limiter bersama, dan kegagalan selalu jatuh ke aturan lokal.

## Setup key Google Cloud

Untuk mode API resmi:

1. Buat project Google Cloud.
2. Aktifkan **YouTube Data API v3**.
3. Untuk tahap Maps M4+, aktifkan **Places API (New)** dan billing.
4. Buat key server, batasi key hanya ke API yang benar, lalu isi `YOUTUBE_API_KEY` dan/atau `GOOGLE_MAPS_API_KEY`.
5. Pasang quota harian dan budget alert di Google Cloud; aplikasi juga menerapkan cap lokal.
6. Jika kelak memakai Maps Embed, buat key browser berbeda yang hanya mengizinkan Maps Embed API dan referrer aplikasi.
7. Buat Gemini key melalui Google AI Studio dan isi `GEMINI_API_KEY`.

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

Google Maps usage guard + schema ──► kolektor tempat/opini pada M4+
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
- Implementasi Maps M4 wajib menjaga atribusi penulis/Google, TTL konten, pembatasan cache, dan ketentuan Places API terbaru. Place ID dapat dipertahankan; konten Places tidak boleh dianggap bebas disimpan permanen.
- Data Places tidak boleh ditempelkan pada peta non-Google.
- Tinjau ketentuan Google Maps Platform terbaru sebelum penggunaan produksi; TTL POC bukan jaminan kepatuhan.

## Struktur penting

```text
app/youtube/       discovery, client, quota, snapshot, metrik, scheduler
app/maps/          fondasi error dan budget guard Maps
app/topics/        layanan watchlist produk
app/api/           endpoint topics, trend, usage, health, SSE
static/            dashboard P3 responsif
config/            seed topik dan aspek
scripts/           reset database dan probe YouTube
tests/             unit/integrasi tanpa API eksternal
```

Spesifikasi implementasi lengkap ada di [SPEC.md](SPEC.md).
