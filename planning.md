# Task Breakdown & Project Plan

## Phase 1: Inisiasi Web App & Vercel (Hari 1-2)
- Inisiasi *project* `npm create vite@latest hris-app -- --template react-ts`.
- Instalasi Tailwind CSS dan inisiasi Shadcn UI (`npx shadcn-ui@latest init`).
- *Deploy* awal ke Vercel untuk memastikan konfigurasi SPA dan *routing* berfungsi.

## Phase 2: Supabase Auth & RLS (Hari 3-4)
- Setup Supabase Project. Aktifkan *Email/Password Auth*.
- Buat tabel SQL dan **WAJIB** terapkan *Row Level Security* (RLS).
- Buat halaman Login dan proteksi rute halaman menggunakan React Router.

## Phase 3: Pengembangan Form Karyawan (Hari 5-7)
- Buat komponen form reaktif untuk Tutor Bimbel dan Host TikTok menggunakan `react-hook-form` dan `zod` untuk validasi.
- Implementasi kompresi gambar di sisi klien (via `browser-image-compression`) sebelum *upload* ke Supabase Storage.

## Phase 4: Realtime Dashboard (Hari 8-10)
- Buat *Dashboard* Owner menggunakan *Recharts* untuk visualisasi data.
- Hubungkan komponen grafik dengan `supabase.channel` untuk mendengarkan perubahan *database* (*INSERT/UPDATE*).

## Phase 5: Anti-Pause & Optimasi (Hari 11)
- Konfigurasi `pg_cron` di Supabase untuk menjalankan *query* internal harian agar *database* terhindar dari mode *pause* otomatis.
- Audit jaringan (*Network Tab*) untuk memastikan tidak ada *request* berlebih yang menguras limit *Fast Data Transfer* Vercel[cite: 4].