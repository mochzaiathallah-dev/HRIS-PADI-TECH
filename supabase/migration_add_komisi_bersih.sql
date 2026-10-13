-- ==============================================================================
-- MIGRATION: Tambah Kolom komisi_bersih & akun_tiktok pada Tabel public.laporan_tiktok
-- HRIS PADI TECH - Supabase Database Schema Enhancement
-- Jalankan query ini di Supabase SQL Editor untuk menyimpan data komisi bersih
-- secara langsung di kolom tabel laporan_tiktok.
-- ==============================================================================

-- 1. Tambah kolom komisi_bersih (dalam Rupiah)
ALTER TABLE public.laporan_tiktok 
ADD COLUMN IF NOT EXISTS komisi_bersih BIGINT DEFAULT 0;

-- 2. Tambah kolom akun_tiktok jika belum ada
ALTER TABLE public.laporan_tiktok 
ADD COLUMN IF NOT EXISTS akun_tiktok TEXT DEFAULT '@wangigaya';

-- 3. Tambah kolom produk_terjual jika belum ada
ALTER TABLE public.laporan_tiktok 
ADD COLUMN IF NOT EXISTS produk_terjual INTEGER DEFAULT 0;

-- 4. Buat index performa untuk mempercepat filter dan kalkulasi
CREATE INDEX IF NOT EXISTS idx_laporan_tiktok_host_tgl 
ON public.laporan_tiktok(host_id, tanggal DESC);

CREATE INDEX IF NOT EXISTS idx_laporan_tiktok_komisi 
ON public.laporan_tiktok(komisi_bersih);

-- 5. Dokumentasi kolom
COMMENT ON COLUMN public.laporan_tiktok.komisi_bersih IS 'Komisi bersih cair yang diperoleh host live (dalam Rupiah)';
COMMENT ON COLUMN public.laporan_tiktok.akun_tiktok IS 'Handle akun TikTok yang digunakan saat live streaming, misal: @wangigaya';
