# Strategi sumber marketplace Indonesia

Dokumen ini mencatat keputusan sumber data POC per 29 September 2026. Review Bridge adalah sumber **semi-live**: ulasan muncul di dasbor segera setelah pengguna menangkap kartu yang sudah tampil, tetapi bukan crawler server tanpa pengawasan.

## Temuan repo referensi

Repo [`rickyzakariap/id-marketplace-tools`](https://github.com/rickyzakariap/id-marketplace-tools) adalah kumpulan POC. Bagian `03-review-sentiment-analyzer` menganalisis CSV/teks, bukan mengambil data. Bagian `05-review-extension` memakai Chrome extension untuk membaca DOM halaman Shopee/Tokopedia dan mengirim hasil ke backend. Repo itu tidak menyediakan TikTok Shop collector atau API live server-side.

Pendekatan DOM cocok untuk demo karena tidak membutuhkan kredensial seller, tetapi selector marketplace dapat berubah kapan saja. Implementasi di proyek ini ditulis ulang, membatasi domain, tidak mengambil username, membatasi 100 ulasan per batch, dan menempatkan integrasi pada endpoint terisolasi.

## Pilihan untuk POC saat ini

```text
Halaman produk yang dibuka pengguna
          │ kartu ulasan sudah dimuat
          ▼
Chrome Review Bridge ──POST──▶ /api/ingest/marketplace
                                      │ validasi + deduplikasi
                                      ▼
                              SQLite → Analyzer
                                      │
                                      ▼
                                  SSE live feed
```

Sumber `tokopedia`, `shopee`, dan `tiktokshop` ikut mendukung filter feed/statistik. Review disimpan sebagai `pending`, lalu worker memprosesnya dengan mode analyzer aktif. Bila Gemini belum dikonfigurasi, mode mock/leksikon tetap berfungsi.

Keterbatasan yang disengaja:

- hanya kartu yang sudah tampil di DOM; tidak ada login, CAPTCHA handling, stealth browser, atau bypass rate limit;
- timestamp dipakai hanya bila halaman menyediakan elemen `time[datetime]`; selain itu waktu ingest dipakai;
- selector TikTok/Tokopedia/Shopee adalah adapter terbaik-usaha dan perlu regression check bila UI marketplace berubah;
- rating diterima untuk fingerprint deduplikasi, sedangkan analisis utama tetap memakai teks;
- endpoint tanpa token hanya boleh diakses dari loopback.

## Status verifikasi POC

- Kontrak extractor diuji di Chromium terhadap fixture DOM yang mengikuti selector repo referensi untuk Shopee/Tokopedia dan atribut `data-e2e` TikTok Shop; ketiganya menghasilkan teks, rating, ID, URL, dan label marketplace yang benar.
- Endpoint ingest, sanitasi URL, penolakan username mentah, deduplikasi, filter sumber, dan CORS extension dilindungi test otomatis.
- Pipeline lengkap `ingest → pending → Gemini → analyzed → SSE/feed` sudah diuji dengan sumber TikTok Shop terkontrol dan menghasilkan analyzer `gemini`.
- Uji browser otomatis langsung ke marketplace tidak menghasilkan data nyata: Shopee mengarahkan ke login/error traffic, Tokopedia gagal dengan HTTP/2 protocol error, dan TikTok Shop menampilkan puzzle Security Check. Karena itu verifikasi data nyata harus dilakukan melalui extension pada sesi browser pengguna yang normal. Ini bukan bypass; pengguna harus membuka produk dan memuat ulasan sendiri.

## Jalur produksi resmi

Untuk toko milik sendiri, target jangka panjang adalah aplikasi seller di TikTok Shop Partner Center: onboarding aplikasi, OAuth seller, scope yang disetujui, request signing, dan webhook. Dokumentasi resmi menyatakan integrasi Open API Tokopedia Indonesia harus bermigrasi ke TikTok Shop Partner Center sejak 30 September 2025: [Partner Center changelog](https://partner.tiktokshop.com/docv2/page/nvx9wggt). SDK resmi tetap memerlukan aplikasi efektif dan scope yang disetujui: [TikTok Shop API SDK overview](https://partner.tiktokshop.com/docv2/page/tts-api-sdk-overview) dan [app review process](https://partner.tiktokshop.com/docv2/page/app-review-process).

TikTok juga mendokumentasikan endpoint riset untuk query TikTok Shop reviews, tetapi akses dan cakupan datanya berbeda dari Seller Open API dan dokumentasinya menyebut field produk yang dijual di Uni Eropa: [Query TikTok Shop Reviews](https://developers.tiktok.com/docs/en/vce-query-tiktok-shop-reviews). Karena itu endpoint riset tersebut tidak dijadikan fondasi POC UMKM Indonesia.

Sebelum mengganti Review Bridge dengan collector resmi, konfirmasi di akun Partner Center:

1. market Indonesia dan tipe aplikasi yang disetujui;
2. scope review/feedback yang benar-benar tersedia;
3. endpoint serta kebijakan penyimpanan data pada versi dokumentasi akun tersebut;
4. webhook yang tersedia untuk perubahan terkait produk/order/review;
5. batas kuota, retensi, dan kewajiban penghapusan data.

Jika scope review tersedia, adapter produksi sebaiknya menjadi collector baru yang menyimpan token seller terenkripsi, menggunakan refresh token, memverifikasi signature/webhook, memakai cursor checkpoint, dan tetap menghasilkan `CommentIn`. Endpoint Review Bridge dapat dipertahankan sebagai fallback demo.

## Keamanan operasional

- Jangan menaruh API key, access token, refresh token, atau app secret di source code.
- Gunakan satu secret aktif per lingkungan di `.env` atau secret manager dan rotasikan bila pernah dibagikan melalui chat/screenshot.
- Jangan menyimpan username pelanggan. Bila identifier stabil wajib dipakai untuk deduplikasi produksi, gunakan HMAC dengan secret server, bukan hash username tanpa salt.
- Tinjau Terms of Service marketplace dan dasar penggunaan data sebelum demo dengan data nyata.
