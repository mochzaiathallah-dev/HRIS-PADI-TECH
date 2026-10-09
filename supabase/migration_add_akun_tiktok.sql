-- ==============================================================================
-- MIGRATION: Tambah Kolom akun_tiktok pada Tabel public.laporan_tiktok
-- Jalankan query ini di Supabase SQL Editor jika ingin kolom akun_tiktok tersimpan
-- permanen di tabel laporan_tiktok.
-- ==============================================================================

ALTER TABLE public.laporan_tiktok 
ADD COLUMN IF NOT EXISTS akun_tiktok TEXT DEFAULT '@wangigaya';

-- Indeks opsional untuk query pencarian akun
CREATE INDEX IF NOT EXISTS idx_laporan_tiktok_akun ON public.laporan_tiktok(akun_tiktok);

-- Komentar dokumentasi
COMMENT ON COLUMN public.laporan_tiktok.akun_tiktok IS 'Handle akun TikTok yang digunakan saat live streaming, misal: @wangigaya';
