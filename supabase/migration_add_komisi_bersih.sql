-- ==============================================================================
-- MIGRATION: Enhancements for TikTok Live Host & Product/Store Operations
-- HRIS PADI TECH - Supabase Database Schema
-- Mendukung:
-- 1. Kolom komisi_bersih, akun_tiktok, nama_toko, produk_terjual, catatan di laporan_tiktok
-- 2. Tabel akun_tiktok_host untuk manajemen akun dinamis per Host (CRUD Realtime)
-- ==============================================================================

-- 1. Tambah kolom komisi_bersih (dalam Rupiah)
ALTER TABLE public.laporan_tiktok 
ADD COLUMN IF NOT EXISTS komisi_bersih BIGINT DEFAULT 0;

-- 2. Tambah kolom akun_tiktok
ALTER TABLE public.laporan_tiktok 
ADD COLUMN IF NOT EXISTS akun_tiktok TEXT DEFAULT '@petualangansajak';

-- 3. Tambah kolom produk_terjual
ALTER TABLE public.laporan_tiktok 
ADD COLUMN IF NOT EXISTS produk_terjual INTEGER DEFAULT 0;

-- 4. Tambah kolom nama_toko (BRM / Campur / Toko Tertentu)
ALTER TABLE public.laporan_tiktok 
ADD COLUMN IF NOT EXISTS nama_toko TEXT DEFAULT 'Berkah Rosita Mandiri (BRM)';

-- 5. Tambah kolom catatan
ALTER TABLE public.laporan_tiktok 
ADD COLUMN IF NOT EXISTS catatan TEXT;

-- 6. Index performa untuk mempercepat pencarian & agregasi
CREATE INDEX IF NOT EXISTS idx_laporan_tiktok_host_tgl 
ON public.laporan_tiktok(host_id, tanggal DESC);

CREATE INDEX IF NOT EXISTS idx_laporan_tiktok_komisi 
ON public.laporan_tiktok(komisi_bersih);

CREATE INDEX IF NOT EXISTS idx_laporan_tiktok_toko 
ON public.laporan_tiktok(nama_toko);

CREATE INDEX IF NOT EXISTS idx_laporan_tiktok_akun 
ON public.laporan_tiktok(akun_tiktok);

-- 7. Tabel akun_tiktok_host untuk menyimpan daftar akun TikTok tiap host
CREATE TABLE IF NOT EXISTS public.akun_tiktok_host (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(host_id, username)
);

-- Index pada akun_tiktok_host
CREATE INDEX IF NOT EXISTS idx_akun_tiktok_host_id ON public.akun_tiktok_host(host_id);

-- Enable RLS pada akun_tiktok_host
ALTER TABLE public.akun_tiktok_host ENABLE ROW LEVEL SECURITY;

-- Policy RLS: Host dapat melihat akun mereka sendiri, Owner dapat melihat semua akun
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'akun_tiktok_host' AND policyname = 'Allow select akun_tiktok_host'
  ) THEN
    CREATE POLICY "Allow select akun_tiktok_host" ON public.akun_tiktok_host
    FOR SELECT TO authenticated
    USING (
      auth.uid() = host_id OR 
      EXISTS (SELECT 1 FROM public.users_profile WHERE id = auth.uid() AND role = 'owner')
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'akun_tiktok_host' AND policyname = 'Allow insert akun_tiktok_host'
  ) THEN
    CREATE POLICY "Allow insert akun_tiktok_host" ON public.akun_tiktok_host
    FOR INSERT TO authenticated
    WITH CHECK (
      auth.uid() = host_id OR 
      EXISTS (SELECT 1 FROM public.users_profile WHERE id = auth.uid() AND role = 'owner')
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'akun_tiktok_host' AND policyname = 'Allow delete akun_tiktok_host'
  ) THEN
    CREATE POLICY "Allow delete akun_tiktok_host" ON public.akun_tiktok_host
    FOR DELETE TO authenticated
    USING (
      auth.uid() = host_id OR 
      EXISTS (SELECT 1 FROM public.users_profile WHERE id = auth.uid() AND role = 'owner')
    );
  END IF;
END $$;

-- Dokumentasi Kolom
COMMENT ON COLUMN public.laporan_tiktok.komisi_bersih IS 'Komisi bersih cair yang diperoleh host live (dalam Rupiah)';
COMMENT ON COLUMN public.laporan_tiktok.akun_tiktok IS 'Handle akun TikTok yang digunakan saat live streaming, misal: @petualangansajak';
COMMENT ON COLUMN public.laporan_tiktok.nama_toko IS 'Nama toko atau produk yang terjual, misal: Berkah Rosita Mandiri (BRM)';
COMMENT ON TABLE public.akun_tiktok_host IS 'Daftar akun TikTok yang dimiliki/dikelola oleh masing-masing host live';
