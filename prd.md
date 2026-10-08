# Product Requirements Document (PRD)

## 1. Tujuan Produk
Membangun sistem HRIS dan POS operasional berbasis Web ringan untuk UMKM yang mengelola divisi Bimbingan Belajar dan *Live Commerce* TikTok. Sistem berfokus pada kecepatan akses via *browser* HP (Tutor/Host) dan Desktop (Owner) tanpa membebani limit *hosting* gratis.

## 2. Target User
- **Owner/Supervisor:** Mengakses *dashboard web* via Desktop/Tablet untuk pantauan *realtime*.
- **Tutor Bimbel & Host TikTok:** Mengakses *web app* via *browser smartphone* untuk absensi dan pelaporan harian.

## 3. Fitur Utama
- **Role-Based Authentication:** Login aman via web.
- **Modul Bimbel (CRUD):** Pencatatan sesi, nama siswa, dan materi pembelajaran.
- **Modul Live Commerce (CRUD):** Pencatatan metrik *live* (GMV, Impresi) dan *upload* foto bukti.
- **Realtime Dashboard:** Angka metrik ter- *update* otomatis di layar Owner tanpa perlu *refresh*.

## 4. User Flow
- **Tutor/Host:** Buka URL Web -> Login -> Isi Form (Bimbel/TikTok) -> Submit langsung ke Supabase -> Logout.
- **Owner:** Buka URL Web -> Login -> Lihat Dashboard Realtime -> Filter Laporan Bulanan -> Export CSV.