# System Design Document (SDD)

## A. Arsitektur & Tech Stack (Zero Vercel Compute Strategy)
- **Frontend:** React.js dengan Vite (SPA murni). Ini memastikan Vercel hanya bertindak sebagai CDN statis, menghemat limit *Function Invocations* dan *Active CPU*[cite: 4].
- **UI Framework:** Tailwind CSS + Shadcn UI (versi Web/React). Ringan, *accessible*, dan mendukung *Dark/Light Mode* bawaan.
- **Backend & Database:** Supabase (PostgreSQL).
- **Koneksi:** Menggunakan `@supabase/supabase-js`. Klien React berkomunikasi langsung dengan PostgREST API Supabase. TIDAK ADA *backend/serverless middleware* di Vercel.

## B. Struktur Database (Supabase PostgreSQL)
1. **`users_profile`**: `id` (UUID berelasi ke `auth.users`), `nama`, `role`.
2. **`murid`**: `id`, `nama`, `tingkat_kelas`.
3. **`laporan_bimbel`**: `id`, `tutor_id`, `murid_id`, `tanggal`, `mata_pelajaran`, `topik`, `ringkasan`.
4. **`laporan_tiktok`**: `id`, `host_id`, `tanggal`, `durasi_menit`, `gmv_rupiah`, `tayangan`, `impresi`, `foto_bukti_url`.

## C. Mekanisme Realtime
Mengaktifkan **Supabase Realtime** di tabel `laporan_bimbel` dan `laporan_tiktok`. *Web browser* Owner akan membuka koneksi WebSocket ke Supabase. Saat Tutor/Host menekan "Submit", *dashboard* Owner langsung merender ulang grafik dan total GMV secara instan.