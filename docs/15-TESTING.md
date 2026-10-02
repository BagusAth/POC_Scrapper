# 15 — Testing Strategy & Test Suite Specification

Dokumen ini mendokumentasikan strategi pengujian, cakupan test suite, arsitektur isolasi, serta cara menjalankan seluruh pengujian otomatis yang ada di repository `POC_Scrapper`.

---

## 1. Filosofi & Prinsip Pengujian

1. **Nol Panggilan API Pihak Ketiga (Zero External API Calls):**
   Seluruh test suite **dilarang keras memanggil API berbayar atau layanan eksternal sungguhan** (YouTube Data API, Apify, Google Maps, atau Google AI Studio Gemini). Seluruh pengujian menggunakan:
   - `httpx.MockTransport` untuk mensimulasikan respons HTTP pihak ketiga.
   - Fixture JSON lokal yang merepresentasikan data riil platform.
   - Database SQLite in-memory (`:memory:`) atau berkas sementara yang otomatis dibersihkan setelah test selesai.
2. **Pengujian Deterministik & Cepat:**
   Seluruh 73 pengujian unit dan integrasi dapat diselesaikan dalam waktu kurang dari 10 detik tanpa ketergantungan jaringan internet.
3. **Validasi Sintaks Frontend:**
   File JavaScript frontend (`static/app.js`, `static/ui.js`) divalidasi sintaksnya menggunakan engine V8 (`node --check`) untuk memastikan tidak ada kesalahan parsing ES module sebelum deploy.

---

## 2. Cara Menjalankan Pengujian

### 2.1 Menjalankan Seluruh Pytest Suite

Pastikan virtual environment telah aktif, lalu jalankan:

```bash
# Menjalankan seluruh test secara ringkas
python -m pytest -q

# Menjalankan dengan rincian nama test dan durasi
python -m pytest -v

# Menjalankan test pada file tertentu saja
python -m pytest tests/test_api_v3.py -v
```

*Status Eksekusi Saat Ini (Branch `test`):*
```text
73 passed, 1 warning in 6.51s
```

### 2.2 Menjalankan Pengecekan Sintaks Frontend

```bash
node --check static/app.js
node --check static/ui.js
```

---

## 3. Matriks Inventarisasi 20 Berkas Test

Berikut adalah inventaris lengkap seluruh file pengujian di folder `tests/`:

| No | File Pengujian | Cakupan & Komponen yang Diuji | Jumlah Test |
|---|---|---|---|
| 1 | [`test_api_v3.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/tests/test_api_v3.py) | Endpoint REST API v3: `/api/topics`, `/api/trend`, `/api/maps/places`, `/api/maps/feed`, `/api/stream`, `/api/health`, `/api/usage`. | 8 |
| 2 | [`test_metrics_v3.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/tests/test_metrics_v3.py) | Perhitungan metrik tren: indeks perhatian (*attention index*), pasokan video 30 hari, laju penambahan views 1 jam & 24 jam. | 4 |
| 3 | [`test_discovery_v3.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/tests/test_discovery_v3.py) | Logika discovery video YouTube, filter relevansi produk, dan pembuangan noise hiburan (`YT_EXCLUDE_TERMS`). | 4 |
| 4 | [`test_content_type_v3.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/tests/test_content_type_v3.py) | Klasifikasi jenis konten video (`review`, `resep`, `ide_usaha`, `lainnya`) via aturan kata kunci dan AI classifier. | 4 |
| 5 | [`test_youtube_client_v3.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/tests/test_youtube_client_v3.py) | Klien YouTube v3 dengan `httpx.MockTransport`, konsumsi kuota pencarian (100u) dan snapshot (1u), serta timeout. | 4 |
| 6 | [`test_public_youtube_v3.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/tests/test_public_youtube_v3.py) | Fallback scraping publik YouTube tanpa API key: ekstraksi ID video, judul, channel, dan viewcount dari HTML mentah. | 3 |
| 7 | [`test_youtube_parsing_v3.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/tests/test_youtube_parsing_v3.py) | Parser item JSON respons YouTube Data API v3 menjadi model `Video` dan `VideoStat`. | 3 |
| 8 | [`test_apify_maps.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/tests/test_apify_maps.py) | Klien Apify Google Maps: inisiasi run, polling status hingga `SUCCEEDED`, download dataset, dan filter relevansi klitika. | 5 |
| 9 | [`test_social_apify.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/tests/test_social_apify.py) | Klien & Parser TikTok, Instagram, dan Facebook Apify: ekstraksi caption, likes, views, dan filter batas waktu 30 hari. | 4 |
| 10 | [`test_marketplace_apify.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/tests/test_marketplace_apify.py) | Parser Shopee Apify: pembersihan URL dari query pelacak, konversi harga teks ke angka, sold count, dan rating. | 3 |
| 11 | [`test_marketplace_ingest.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/tests/test_marketplace_ingest.py) | Endpoint `/api/ingest/marketplace`: validasi domain whitelist, penolakan username, deduplikasi SHA-256, dan token header. | 5 |
| 12 | [`test_keywords.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/tests/test_keywords.py) | Algoritma `top_keywords()`: ekstraksi unigram & bigram, eliminasi stopwords bahasa Indonesia, dan pengurutan deterministik. | 4 |
| 13 | [`test_preprocess.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/tests/test_preprocess.py) | Normalisasi teks: pembersihan URL/mention, pemotongan huruf berulang (*enakkk* -> *enak*), dan ekspansi kamus slang. | 3 |
| 14 | [`test_lexicon.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/tests/test_lexicon.py) | Penganalisis Leksikon: polaritas kata positif/negatif, pembalikan makna oleh kata negasi (*tidak enak*), dan kalimat retoris. | 4 |
| 15 | [`test_gemini_parse.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/tests/test_gemini_parse.py) | Parser respons batch Gemini: pemetaan ID pendek `c1..cN` ke ID database, clamp skor -1.0..1.0, dan pembatasan 3 aspek. | 3 |
| 16 | [`test_worker.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/tests/test_worker.py) | Orkestrasi `AnalyzerWorker`: pembentukan batch, batas waktu tunggu (10s), mitigasi rate limit 429, dan fallback ke leksikon. | 4 |
| 17 | [`test_usage_v3.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/tests/test_usage_v3.py) | Budget tracker (`QuotaTracker`, `MapsUsageTracker`, dll.): pencatatan harian/bulanan dan penolakan request saat cap tercapai. | 3 |
| 18 | [`test_postgres_backend.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/tests/test_postgres_backend.py) | Kompatibilitas `PostgresDatabase`: DDL skema `scraper`, eksekusi kueri, dan transaksi persisten. | 2 |
| 19 | [`test_api.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/tests/test_api.py) | Pengujian regresi endpoint legasi v2: feed ulasan, filter window, cursor pagination, dan agregasi stats produk. | 2 |
| 20 | [`test_youtube.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/tests/test_youtube.py) | Pengujian kolektor legacy YouTube poller dan parsing komentar video. | 2 |

---

## 4. Teknik Mocking & Fixtures

### 4.1 Mock Transport HTTP (`httpx.MockTransport`)
Pengujian tidak pernah membuka koneksi soket internet ke luar. Sebagai gantinya, handler tiruan dipasang pada instance `httpx.AsyncClient`:

```python
# Contoh pola di tests/test_youtube_client_v3.py
def mock_handler(request: httpx.Request) -> httpx.Response:
    if "search" in str(request.url):
        return httpx.Response(200, json={"items": [{"id": {"videoId": "v1"}}]})
    return httpx.Response(200, json={"items": [{"id": "v1", "statistics": {"viewCount": "1000"}}]})

client = YouTubeClient(api_key="fake-key", quota=quota_tracker, transport=httpx.MockTransport(mock_handler))
```

### 4.2 Isolasi Database pada Pytest Fixtures
Pada [`tests/conftest.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/tests/conftest.py), fixture `database` menginisialisasi database SQLite in-memory baru untuk setiap fungsi pengujian:

```python
@pytest.fixture
async def database():
    db = Database(":memory:")
    await db.init()
    yield db
    await db.close()
```
Hal ini memastikan bahwa tidak ada kebocoran state (*state leakage*) antar-pengujian dan eksekusi test selalu bersih serta independen.
