# 17 — Study Case Validation & Acceptance Criteria

Dokumen ini mendokumentasikan pemetaan kepatuhan implementasi sistem terhadap seluruh persyaratan dan panduan **Study Case 2: Pemantau Sentimen Inovasi UMKM**, dilengkapi kriteria penerimaan formal (*Acceptance Criteria* berbasis Given-When-Then).

---

## 1. Matriks Penelusuran Kebutuhan (Traceability Matrix)

| Kebutuhan Studi Kasus 2 | Implementasi di Repository | File Sumber Kode | Metode Validasi & Bukti |
|---|---|---|---|
| **Requirement Wajib 1:** Menampilkan timeline/feed komentar atau opini publik | Komponen Feed Opini yang menyajikan ulasan Google Maps, caption TikTok, Instagram, Facebook, dan Review Bridge secara kronologis mundur beserta badge sentimen dan aspek | - [`app/api/routes_maps.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/api/routes_maps.py) (`feed`)<br>- [`app/api/routes_social.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/api/routes_social.py) (`feed`)<br>- [`static/app.js`](file:///d:/UNDIP/EXASTI/POC_Scrapper/static/app.js) (`renderMaps`, `renderSocial`) | **Uji Otomatis:** `tests/test_api_v3.py::test_maps_feed_endpoint`<br>**Uji Manual:** Buka dashboard, pilih produk "Cappuccino Cincau", kartu ulasan tampil lengkap dengan teks opini, bintang rating, dan sentimen. |
| **Requirement Wajib 2:** Menampilkan indikator visual sederhana penghitung kata kunci terbanyak | Widget Indikator Visual Kata Kunci Terbanyak dengan mode Unigram (1 kata) dan Bigram (2 kata) yang menyaring stopwords dan kata produk secara deterministik | - [`app/nlp/keywords.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/nlp/keywords.py) (`top_keywords`)<br>- [`app/api/routes_stats.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/api/routes_stats.py) (`get_stats`)<br>- [`static/ui.js`](file:///d:/UNDIP/EXASTI/POC_Scrapper/static/ui.js) | **Uji Otomatis:** `tests/test_keywords.py`<br>**Uji Manual:** Buka dashboard, periksa tabel frekuensi kata kunci; kata `manis`, `segar`, `antre` tampil dengan bar panjang proporsional. |
| **Panduan 1:** Crawling media sosial & direktori terbuka | Modul pengumpulan data otomatis dari YouTube, Google Maps, TikTok, Instagram, Facebook, dan Shopee via Apify Actor dan klien HTTP | - [`app/youtube/trend_discovery.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/youtube/trend_discovery.py)<br>- [`app/maps/collector.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/maps/collector.py)<br>- [`app/social/collector.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/social/collector.py) | **Uji Otomatis:** `tests/test_discovery_v3.py`, `tests/test_apify_maps.py`, `tests/test_social_apify.py`<br>**Uji Manual:** Eksekusi probe `python scripts/yt_trend_probe.py "seblak"`. |
| **Panduan 2:** Background script pengolah data | Background scheduler (`TrendScheduler`) dan batch worker (`AnalyzerWorker`) yang berjalan secara asinkron tanpa memblokir request HTTP pengguna | - [`app/youtube/trend_scheduler.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/youtube/trend_scheduler.py)<br>- [`app/analyzer/worker.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/analyzer/worker.py) | **Uji Otomatis:** `tests/test_worker.py`<br>**Uji Manual:** Periksa terminal log saat server berjalan, proses polling berjalan periodik setiap 2-5 detik. |
| **Tujuan Kasus:** Mengetahui tren dan opini untuk inovasi produk UMKM | Panel Sintesis AI yang merangkum tren pasar, keluhan pelanggan teratas, dan merumuskan 3 ide inovasi produk konkret | - [`app/api/routes_summary.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/api/routes_summary.py) (`SummaryService`)<br>- [`app/analyzer/gemini.py`](file:///d:/UNDIP/EXASTI/POC_Scrapper/app/analyzer/gemini.py) | **Uji Manual:** Buka panel Hero Dashboard; kotak kuning menyajikan rekomendasi formulasi produk baru berdasarkan ulasan yang masuk. |

---

## 2. Kriteria Penerimaan (Acceptance Criteria)

### Skenario 1: Pendaftaran Topik Produk UMKM Baru
```gherkin
Given pengguna berada di halaman dashboard utama
When pengguna mengisi form dengan nama "Keripik Pisang" dan kota "Bandung"
And pengguna menekan tombol "MULAI PANTAU SEKARANG"
Then sistem mendaftarkan topik produk baru ke database dengan status "discovering"
And sistem memulai proses discovery video dan pengumpulan ulasan di latar belakang
And banner status progress muncul di dashboard mengonfirmasi pemantauan aktif
```

### Skenario 2: Penampilan Timeline / Feed Opini Publik (Requirement Wajib 1)
```gherkin
Given sistem telah mengumpulkan ulasan pelanggan dari Google Maps atau media sosial
When pengguna membuka tab produk "Cappuccino Cincau"
Then ulasan pelanggan ditampilkan dalam bentuk kartu lini masa secara kronologis
And setiap kartu memuat teks ulasan asli, sumber platform, rating bintang, dan timestamp
And setiap ulasan memiliki badge status sentimen yang jelas (Positif, Negatif, Netral)
And pengguna dapat memfilter ulasan hanya untuk kategori sentimen negatif
```

### Skenario 3: Indikator Visual Frekuensi Kata Kunci (Requirement Wajib 2)
```gherkin
Given terdapat ulasan pelanggan yang tersimpan untuk produk terpilih
When pengguna melihat panel "Kata Kunci Terbanyak"
Then sistem menampilkan daftar 10 kata yang paling sering muncul
And kata-kata umum (stopwords) seperti "dan", "di", "yang" tidak ikut ditampilkan
And nama produk "cappuccino cincau" tidak mendominasi hitungan kata
And saat pengguna mengganti mode ke "2 Kata", sistem menampilkan frasa bigram (misal: "kurang manis", "bumbu meresap")
```

### Skenario 4: Analisis Sentimen & Rekomendasi Inovasi Produk
```gherkin
Given terdapat ulasan pelanggan baru yang baru saja masuk ke sistem
When batch analyzer worker memproses ulasan tersebut
Then ulasan dianalisis menjadi sentimen positif, negatif, atau netral beserta skornya
And ringkasan Sintesis AI menampilkan 3 poin pujian teratas, 3 poin komplain utama, dan 3 ide inovasi produk yang relevan untuk UMKM
```

### Skenario 5: Streaming Pembaruan Live Feed (SSE)
```gherkin
Given browser klien terhubung ke endpoint streaming Server-Sent Events "/api/stream"
When background worker menyimpan video baru atau snapshot views mengalami kenaikan
Then server memancarkan event "trend_tick" atau "comment_updated" secara instan
And indikator ticker di dashboard browser memperbarui angka pertambahan views tanpa reload halaman
```

---

## 3. Skenario Pengujian End-to-End (E2E Validation Checklist)

| No | Tahap Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Status |
|---|---|---|---|---|
| 1 | **Startup Bersih** | Jalankan `python scripts/reset_db.py` lalu `uvicorn app.main:app` | Server menyala di port 8000, 3 topik seed terpasang, database siap | **LULUS** |
| 2 | **API Health** | Request `GET /api/health` | HTTP 200 dengan status `ok` dan laporan konfigurasi jujur | **LULUS** |
| 3 | **Suggester Topik** | Request `POST /api/topics/suggest` dengan payload `{"name": "Es Cincau"}` | HTTP 200, keywords dan product terms terbentuk otomatis | **LULUS** |
| 4 | **Pencegahan Topik Duplikat** | Submit topik dengan nama yang sama | Sistem menolak atau menormalkan nama secara aman | **LULUS** |
| 5 | **Fallback AI Leksikon** | Matikan `GEMINI_API_KEY`, ubah `AI_MODE=lexicon`, jalankan analisis ulasan | Analisis sentimen tetap berjalan lancar menggunakan aturan leksikon lokal | **LULUS** |
| 6 | **Keyword Counter Accuracy**| Request `GET /api/stats?product_id=cappuccino-cincau&ngram=1` | Top keywords mengembalikan daftar kata bermakna bebas stopwords | **LULUS** |
| 7 | **SSE Keep-Alive** | Pantau koneksi `/api/stream` selama 30 detik saat sistem idle | Event `ping` diterima setiap 15 detik | **LULUS** |
| 8 | **Test Suite Regresi** | Jalankan `python -m pytest -q` | Seluruh 73 pengujian otomatis lulus 100% | **LULUS** |
