# 10 — REST API Specification

Dokumen ini mendokumentasikan seluruh antarmuka REST API yang diimplementasikan pada backend FastAPI di folder `app/api/`.

---

## 1. Ringkasan Endpoint Berdasarkan Domain

| Domain | Metode | Path | Deskripsi Singkat |
|---|---|---|---|
| **System** | `GET` | `/api/health` | Status operasional sistem, konfigurasi token, dan kesehatan AI |
| **Usage** | `GET` | `/api/usage` | Pelacak pemakaian unit YouTube dan kuota Apify |
| **Topics** | `GET` | `/api/topics` | Daftar produk yang sedang dipantau beserta agregat data |
| **Topics** | `POST` | `/api/topics/suggest` | Saran otomatis kata kunci pencarian dan kategori produk |
| **Topics** | `POST` | `/api/topics` | Mendaftarkan topik produk baru ke watchlist |
| **Topics** | `DELETE`| `/api/topics/{topic_id}` | Menonaktifkan topik produk dari pantauan |
| **Trend** | `GET` | `/api/trend` | Metrik tren YouTube lengkap (views, pasokan video, indeks) |
| **Trend** | `GET` | `/api/trend/videos` | Daftar bukti video YouTube dengan filter tipe konten & sort |
| **Maps** | `GET` | `/api/maps/places` | Daftar tempat/gerai Google Maps yang relevan dengan produk |
| **Maps** | `GET` | `/api/maps/feed` | Feed ulasan Google Maps yang lolos filter relevansi |
| **Social** | `GET` | `/api/social/feed` | Postingan publik TikTok/Instagram/Facebook yang relevan |
| **Social** | `GET` | `/api/social/stats` | Agregat engagement, distribusi sentimen, dan tren harian |
| **Marketplace**| `GET` | `/api/marketplace/products` | Sampel katalog produk Shopee yang lolos filter |
| **Marketplace**| `GET` | `/api/marketplace/stats` | Statistik rentang harga, rating rata-rata, dan total terjual |
| **Stream** | `GET` | `/api/stream` | Server-Sent Events (SSE) streaming real-time |
| **Feed** | `GET` | `/api/feed` | Timeline ulasan multi-sumber dengan filter & cursor pagination |
| **Stats** | `GET` | `/api/stats` | Indikator visual kata kunci terbanyak (unigram/bigram) & sentimen |
| **Summary** | `GET` | `/api/summary` | Sintesis AI: pujian, keluhan, dan 3 ide inovasi produk |
| **Ingest** | `POST` | `/api/ingest/marketplace`| Endpoint ingest ulasan dari Review Bridge Chrome extension |

---

## 2. Dokumentasi Rinci Tiap Endpoint

### 2.1 System & Health Domain

#### `GET /api/health`
* **Tujuan:** Memeriksa status kesehatan aplikasi, database backend aktif, mode sumber yang berjalan, dan status konfigurasi API key eksternal.
* **Otentikasi:** Tidak ada (Publik).
* **Contoh Respons (HTTP 200 OK):**
  ```json
  {
    "status": "ok",
    "database_backend": "sqlite",
    "sources_active": ["youtube_trend", "maps", "tiktok", "instagram", "facebook", "shopee"],
    "youtube_configured": true,
    "youtube_mode": "api",
    "maps_provider": "apify",
    "maps_configured": true,
    "apify_configured": true,
    "tiktok_configured": true,
    "instagram_configured": true,
    "facebook_configured": true,
    "shopee_configured": true,
    "max_active_topics": 20,
    "social_sentiment_enabled": true,
    "social_sentiment_analyzer": "gemini",
    "yt_comments_enabled": false,
    "demo_mode": false,
    "analyzer": {
      "ai_mode": "gemini",
      "active_analyzer": "gemini",
      "gemini_healthy": true,
      "cooldown_until": null,
      "last_error": null,
      "pending_count": 0
    },
    "source_messages": {
      "youtube": "YouTube Data API aktif",
      "maps": "Apify Google Maps aktif (compass~crawler-google-places)",
      "tiktok": "TikTok Apify aktif (clockworks~tiktok-scraper)",
      "instagram": "Instagram Apify aktif (apify~instagram-scraper)",
      "facebook": "Facebook Apify aktif (apify~facebook-search-scraper)",
      "shopee": "Shopee Apify aktif (xtracto~shopee-scraper)"
    }
  }
  ```

---

### 2.2 Usage & Quota Domain

#### `GET /api/usage`
* **Tujuan:** Menginspeksi pemakaian kuota harian dan bulanan terhadap batas aman (*budget caps*).
* **Otentikasi:** Tidak ada.
* **Contoh Respons (HTTP 200 OK):**
  ```json
  {
    "youtube": {
      "day": "2026-10-02",
      "daily_quota": 10000,
      "search_reserve": 6000,
      "search_units_used": 200,
      "read_units_used": 14,
      "total_units_used": 214,
      "remaining_units": 9786
    },
    "maps": {
      "day": "2026-10-02",
      "month": "2026-10",
      "daily_cap": 30,
      "monthly_cap": 800,
      "daily_used": 3,
      "monthly_used": 12,
      "daily_remaining": 27,
      "monthly_remaining": 788
    },
    "social": {
      "daily_used": 6,
      "daily_cap": 18,
      "monthly_used": 24,
      "monthly_cap": 450
    },
    "marketplace": {
      "daily_used": 1,
      "daily_cap": 8,
      "monthly_used": 5,
      "monthly_cap": 200
    }
  }
  ```

---

### 2.3 Topics & Watchlist Domain

#### `GET /api/topics`
* **Tujuan:** Mengambil daftar seluruh produk yang sedang dipantau beserta ringkasan jumlah video dan tempat yang terlacak.
* **Contoh Respons (HTTP 200 OK):**
  ```json
  {
    "items": [
      {
        "id": "cappuccino-cincau",
        "name": "Cappuccino Cincau",
        "category": "makanan_minuman",
        "keywords": ["cappuccino cincau", "capucino cincau", "es cappuccino cincau"],
        "product_terms": ["cappuccino", "capucino", "cincau"],
        "exclude_terms": [],
        "cities": ["Bandung"],
        "own_place_id": null,
        "status": "active",
        "is_seed": true,
        "is_active": true,
        "created_at": "2026-10-01T00:00:00Z",
        "videos_tracked": 42,
        "places_relevant": 8,
        "social_posts": 19,
        "marketplace_products": 12,
        "yt_last_snapshot_at": "2026-10-02T12:00:00Z",
        "maps_last_refresh_at": "2026-10-02T08:00:00Z"
      }
    ]
  }
  ```

#### `POST /api/topics/suggest`
* **Tujuan:** Menghasilkan saran kata kunci dan istilah produk otomatis.
* **Request Body:**
  ```json
  {
    "name": "Keripik Pisang"
  }
  ```
* **Contoh Respons (HTTP 200 OK):**
  ```json
  {
    "keywords": ["keripik pisang"],
    "product_terms": ["keripik pisang", "keripik", "pisang"],
    "exclude_terms": [],
    "category": "makanan_minuman",
    "cities": ["Bandung"],
    "source": "template"
  }
  ```

#### `POST /api/topics`
* **Tujuan:** Mendaftarkan topik produk baru ke dalam watchlist dan memulai proses pengumpulan latar belakang.
* **Request Body:**
  ```json
  {
    "name": "Keripik Pisang",
    "keywords": ["keripik pisang", "keripik pisang lumer"],
    "product_terms": ["keripik", "pisang", "lumer"],
    "exclude_terms": ["kartun", "lagu"],
    "category": "makanan_minuman",
    "cities": ["Bandung"]
  }
  ```
* **Respons Berhasil (HTTP 201 Created):** Mengembalikan entitas `Topic` yang telah disimpan.
* **Error Response (HTTP 409 Conflict):**
  ```json
  {
    "detail": "Batas 20 topik aktif tercapai; nonaktifkan topik lain terlebih dahulu"
  }
  ```

#### `DELETE /api/topics/{topic_id}`
* **Tujuan:** Menonaktifkan topik produk (`is_active = 0`).
* **Respons Berhasil (HTTP 200 OK):** `{"deleted": true}`
* **Error Response (HTTP 404 Not Found):** `{"detail": "Topik tidak ditemukan"}`

---

### 2.4 YouTube Trend Domain

#### `GET /api/trend`
* **Query Parameters:**
  - `topic_id` (string, wajib): ID topik produk.
* **Contoh Respons (HTTP 200 OK):**
  ```json
  {
    "topic_id": "cappuccino-cincau",
    "videos_tracked": 42,
    "new_videos_30d": 12,
    "new_videos_prev_30d": 8,
    "supply_change_pct": 50.0,
    "attention_index": 350.5,
    "views_gain_1h": 120.0,
    "views_gain_since_last": 120,
    "views_gain_24h": 2840,
    "views_gain_prev_24h": 2400,
    "attention_change_pct": 18.3,
    "coverage": 0.95,
    "engagement_rate": 0.042,
    "content_mix": {
      "resep": { "count": 18, "share": 0.428, "views_share": 0.51 },
      "review": { "count": 10, "share": 0.238, "views_share": 0.29 },
      "ide_usaha": { "count": 12, "share": 0.285, "views_share": 0.18 },
      "lainnya": { "count": 2, "share": 0.047, "views_share": 0.02 }
    },
    "supply_trend": "naik",
    "attention_trend": "naik",
    "competition_signal": "stabil",
    "last_snapshot_at": "2026-10-02T12:00:00Z"
  }
  ```

#### `GET /api/trend/videos`
* **Query Parameters:**
  - `topic_id` (string, wajib).
  - `sort` (string, opsional): `gain` (default), `views_per_day`, atau `recent`.
  - `type` (string, opsional): `review`, `resep`, `ide_usaha`, atau `lainnya`.
* **Contoh Respons (HTTP 200 OK):**
  ```json
  {
    "total": 1,
    "items": [
      {
        "video_id": "dQw4w9WgXcQ",
        "title": "Resep Es Cappuccino Cincau Modal Kecil Untung Manis",
        "channel_title": "Dapur Usaha Lokal",
        "content_type": "ide_usaha",
        "published_at": "2026-09-20T10:00:00Z",
        "views": 45200,
        "views_per_day": 3766.6,
        "gain_24h": 850,
        "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      }
    ]
  }
  ```

---

### 2.5 Google Maps Domain

#### `GET /api/maps/places` (dan alias kompatibilitas `GET /api/places`)
* **Query Parameters:** `topic_id` (string, wajib).
* **Contoh Respons (HTTP 200 OK):**
  ```json
  {
    "total": 1,
    "items": [
      {
        "place_id": "ChIJb8w9zZ_vaScR2w7qj8vLqAA",
        "name": "Kedai Cincau Segar Pasirkaliki",
        "address": "Jl. Pasirkaliki No. 120, Bandung",
        "city": "Bandung",
        "rating": 4.6,
        "user_rating_count": 180,
        "is_relevant": true,
        "is_own": false,
        "maps_uri": "https://maps.google.com/?cid=123"
      }
    ]
  }
  ```

#### `GET /api/maps/feed`
* **Query Parameters:**
  - `topic_id` (string, wajib).
  - `limit` (integer, opsional, default: 50, min: 1, max: 200).
* **Contoh Respons (HTTP 200 OK):**
  ```json
  {
    "total": 1,
    "items": [
      {
        "id": "Ci9zb21lX3JhbmRvbV9pZA",
        "topic_id": "cappuccino-cincau",
        "source": "gmaps",
        "place_id": "ChIJb8w9zZ_vaScR2w7qj8vLqAA",
        "text": "Rasa cappuccino cincaunya mantap bgt, manisnya pas dan cincaunya kenyal!",
        "stars": 5,
        "author_name": "Budi Santoso",
        "created_at": "2026-09-15T08:30:00Z",
        "mentions_product": true,
        "category": "opini_produk",
        "status": "analyzed",
        "sentiment": "positif",
        "score": 0.85,
        "topics": ["rasa", "kemasan"],
        "analyzer": "gemini"
      }
    ]
  }
  ```

---

### 2.6 Social Domain (TikTok, Instagram, Facebook)

#### `GET /api/social/feed`
* **Query Parameters:**
  - `topic_id` (string, wajib).
  - `platform` (string, opsional): `tiktok`, `instagram`, atau `facebook`.
  - `limit` (integer, opsional, default: 100, max: 500).
* **Contoh Respons (HTTP 200 OK):**
  ```json
  {
    "total": 1,
    "items": [
      {
        "platform": "tiktok",
        "post_id": "728192837192",
        "topic_id": "cappuccino-cincau",
        "text": "Nyobain es cappuccino cincau viral di Dipatiukur, beneran seenak itu guys! #kulinerbandung",
        "author_name": "kulineran.bdg",
        "url": "https://www.tiktok.com/@kulineran.bdg/video/728192837192",
        "published_at": "2026-09-28T14:15:00Z",
        "views": 25000,
        "likes": 1800,
        "comments": 45,
        "shares": 120,
        "sentiment": "positif",
        "sentiment_score": 0.9,
        "sentiment_topics": ["rasa"]
      }
    ]
  }
  ```

#### `GET /api/social/stats`
* **Query Parameters:** `topic_id` (string, wajib).
* **Contoh Respons (HTTP 200 OK):**
  ```json
  {
    "topic_id": "cappuccino-cincau",
    "total_posts": 19,
    "total_likes": 14200,
    "total_views": 185000,
    "sentiment_breakdown": {
      "positif": 14,
      "negatif": 2,
      "netral": 3
    },
    "top_aspects": [
      {"topic": "rasa", "count": 12},
      {"topic": "harga", "count": 5}
    ]
  }
  ```

---

### 2.7 Marketplace Domain (Shopee)

#### `GET /api/marketplace/products`
* **Query Parameters:**
  - `topic_id` (string, wajib).
  - `platform` (string, default: `shopee`).
  - `limit` (integer, default: 100).
* **Contoh Respons (HTTP 200 OK):**
  ```json
  {
    "total": 1,
    "items": [
      {
        "platform": "shopee",
        "product_id": "1892837192",
        "topic_id": "cappuccino-cincau",
        "title": "Bubuk Minuman Cappuccino Cincau Premium 1kg Halal",
        "shop_name": "Bandung Powder Drink",
        "price": 45000.0,
        "original_price": 55000.0,
        "rating": 4.9,
        "rating_count": 340,
        "sold_count": 1200,
        "url": "https://shopee.co.id/product/123/1892837192"
      }
    ]
  }
  ```

#### `GET /api/marketplace/stats`
* **Query Parameters:** `topic_id` (string, wajib).
* **Contoh Respons (HTTP 200 OK):**
  ```json
  {
    "platform": "shopee",
    "products": 12,
    "price_min": 15000.0,
    "price_max": 75000.0,
    "price_median": 45000.0,
    "avg_rating": 4.8,
    "total_sold": 4800
  }
  ```

---

### 2.8 Statistics & Keyword Frequency Counter

#### `GET /api/stats`
* **Tujuan:** Memenuhi **Requirement Wajib 2 Study Case 2** (Indikator visual penghitung kata terbanyak).
* **Query Parameters:**
  - `product_id` (string, opsional).
  - `window` (string, default: `30d`): `1h`, `24h`, `7d`, `30d`, `90d`, `all`.
  - `ngram` (integer, default: `1`, min: 1, max: 2).
* **Contoh Respons (HTTP 200 OK):**
  ```json
  {
    "product_id": "cappuccino-cincau",
    "window": "30d",
    "total": 35,
    "sentiment": {
      "positif": 24,
      "negatif": 6,
      "netral": 5,
      "pending": 0
    },
    "top_keywords": [
      { "word": "kenyal", "count": 18 },
      { "word": "manis", "count": 15 },
      { "word": "segar", "count": 14 },
      { "word": "antre", "count": 8 },
      { "word": "porsi", "count": 7 }
    ],
    "top_topics": [
      { "topic": "rasa", "count": 22 },
      { "topic": "kemasan", "count": 9 },
      { "topic": "harga", "count": 6 }
    ],
    "by_source": {
      "gmaps": 20,
      "tiktok": 10,
      "instagram": 5
    }
  }
  ```

---

### 2.9 Summary & AI Innovation Synthesis

#### `GET /api/summary`
* **Query Parameters:**
  - `product_id` (string, opsional).
  - `refresh` (boolean, opsional, default: `false`).
* **Contoh Respons (HTTP 200 OK):**
  ```json
  {
    "summary": "Dari 35 opini terbaru, 69% bernada positif dan 17% bernada negatif. Konsumen sangat menyukai tekstur cincau yang kenyal dan kesegaran rasa kopi, namun sejumlah pembeli mengeluhkan tingkat kemanisan yang berlebih.",
    "praises": [
      "Tekstur cincau kenyal dan segar",
      "Perpaduan rasa kopi dan coklat pas",
      "Harga terjangkau untuk porsi besar"
    ],
    "complaints": [
      "Tingkat kemanisan terlalu tinggi jika es mencair",
      "Kemasan gelas mudah bocor di tutup",
      "Waktu antre saat jam istirahat cukup lama"
    ],
    "innovation_ideas": [
      "Sediakan opsi pilihan level gula (Normal, Less Sugar 50%, No Sugar)",
      "Gunakan penutup kemasan cup sealer presisi agar tidak tumpah saat take-away",
      "Buat varian cincau pandan atau cincau kedelai sebagai diferensiasi menu"
    ],
    "analyzer": "gemini",
    "generated_at": "2026-10-02T12:30:00Z"
  }
  ```

---

### 2.10 Review Bridge / Ingest Domain

#### `POST /api/ingest/marketplace`
* **Tujuan:** Menerima ulasan dari Chrome extension browser pengguna.
* **Headers:**
  - `Content-Type: application/json`
  - `X-Ingest-Token` (string, opsional bila di loopback).
* **Request Body:**
  ```json
  {
    "marketplace": "shopee",
    "product_id": "cappuccino-cincau",
    "product_url": "https://shopee.co.id/Bubuk-Minuman-Cappuccino-Cincau-i.123.456",
    "reviews": [
      {
        "external_id": "rev_01",
        "text": "Pengiriman cepat, bubuk minumannya wangi banget dan cincaunya lembut",
        "rating": 5
      }
    ]
  }
  ```
* **Respons Berhasil (HTTP 202 Accepted):**
  ```json
  {
    "source": "shopee",
    "received": 1,
    "accepted": 1,
    "duplicates": 0,
    "comment_ids": ["sp_a8f9b2c3d4e5f6..."]
  }
  ```
* **Error Responses:**
  - HTTP 401 Unauthorized: `{"detail": "Token ingest tidak valid"}`
  - HTTP 403 Forbidden: `{"detail": "Tanpa token, ingest hanya tersedia dari komputer lokal"}`
  - HTTP 422 Unprocessable: `{"detail": "URL produk tidak cocok dengan marketplace yang dipilih"}`
