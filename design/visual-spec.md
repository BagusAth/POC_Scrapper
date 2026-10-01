# Konsep Visual — Pemantau Sentimen UMKM

## Arah

Dashboard diperlakukan sebagai **meja sinyal pasar**, bukan admin panel generik. Latar hijau-ink gelap memberi fokus, sementara permukaan kertas hangat membuat feed panjang tetap nyaman dibaca. Aksen mint menandai data hidup dan tindakan utama; coral dipakai hanya untuk risiko/negatif.

## Token

- Latar aplikasi: `#0B1210`
- Latar panel utama: `#F4F1E8`
- Panel sekunder: `#E9E5D9`
- Teks gelap: `#16221E`
- Teks terang: `#F7F5ED`
- Teks redup: `#6E7772`
- Aksen/live/positif: `#83E6A7`
- Negatif: `#F06F5F`
- Pending: `#E6B85C`
- Netral: `#98A39E`
- Radius panel: 18px; kontrol: 10px; chip: 999px
- Font: sans humanis dengan fallback sistem; judul rapat dan tegas, teks UI 12–14px.

## Komposisi desktop (1600 × 1000)

1. Header tenang: mark gelombang, judul, subjudul, pemilih produk, status LIVE, status analyzer.
2. KPI berupa satu rail terbuka dengan empat kolom dan garis pemisah, bukan empat kartu terpisah.
3. Isi utama 62/38: feed di kiri dan insight rail di kanan.
4. Feed memakai daftar berirama dengan penanda sumber, waktu, produk, teks, sentimen, dan topik. Filter berada tepat di atas daftar.
5. Insight rail memuat donut sentimen, bar kata kunci, dan blok ringkasan AI berwarna mint.
6. CTA `Perbarui ringkasan` ada di blok ringkasan; `Muat lebih banyak` berada di akhir feed.

## Komposisi mobile (390 × 844)

Header menjadi dua baris. KPI menjadi grid 2 × 2. Konten mengikuti urutan spesifikasi: KPI → feed → grafik → ringkasan. Filter dapat digeser horizontal tanpa menyebabkan halaman overflow. Feed mempertahankan hierarki dan sentimen tetap terbaca tanpa hanya mengandalkan warna.

## Gerak

- Titik LIVE berdenyut lembut.
- Komentar SSE baru masuk dari atas selama 240ms dan mendapat highlight mint selama 2 detik.
- Pending memakai shimmer pendek yang berhenti ketika hasil analyzer tiba.
- Semua gerak dimatikan melalui `prefers-reduced-motion`.

## Salinan di atas lipatan

- Pemantau Sentimen UMKM
- Sinyal pasar untuk inovasi produk lokal
- Semua produk
- LIVE / Menyambung ulang…
- AI: Mock / AI: Gemini / AI: Leksikon (fallback)
- Total opini / Positif / Negatif / Menunggu analisis
- Percakapan terbaru
- Semua / Positif / Negatif / Netral
- Semua sumber
- Cari opini…
- Insight pasar

