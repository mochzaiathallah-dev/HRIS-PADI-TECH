-- ==============================================================================
-- MIGRATION: Fitur Laporan TikTok Live & Ekspor PDF 1 Bulan
-- HRIS PADI TECH - Supabase Database Enhancement
-- ==============================================================================

-- 1. Pastikan kolom-kolom performa live streaming tersedia pada tabel laporan_tiktok
ALTER TABLE public.laporan_tiktok 
ADD COLUMN IF NOT EXISTS akun_tiktok TEXT DEFAULT '@wangigaya';

ALTER TABLE public.laporan_tiktok 
ADD COLUMN IF NOT EXISTS produk_terjual INTEGER DEFAULT 0;

ALTER TABLE public.laporan_tiktok 
ADD COLUMN IF NOT EXISTS komentar INTEGER DEFAULT 0;

ALTER TABLE public.laporan_tiktok 
ADD COLUMN IF NOT EXISTS catatan TEXT;

-- 2. Buat Index untuk mempercepat query laporan per rentang tanggal & akun (Menghemat Supabase Egress & Log Query)
CREATE INDEX IF NOT EXISTS idx_laporan_tiktok_range 
ON public.laporan_tiktok(host_id, tanggal DESC);

CREATE INDEX IF NOT EXISTS idx_laporan_tiktok_akun_date 
ON public.laporan_tiktok(akun_tiktok, tanggal DESC);

-- 3. Tabel Riwayat Pembuatan Laporan PDF (Opsional untuk audit log generasi laporan)
CREATE TABLE IF NOT EXISTS public.riwayat_laporan_pdf (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id UUID NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
    akun_tiktok TEXT NOT NULL DEFAULT '@wangigaya',
    periode_mulai DATE NOT NULL,
    periode_selesai DATE NOT NULL,
    total_gmv BIGINT NOT NULL DEFAULT 0,
    total_sesi INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.riwayat_laporan_pdf ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Host can view and insert own pdf logs" ON public.riwayat_laporan_pdf;
CREATE POLICY "Host can view and insert own pdf logs"
ON public.riwayat_laporan_pdf FOR ALL
TO authenticated
USING (
    host_id = auth.uid() 
    OR auth.uid() IN (SELECT id FROM public.users_profile WHERE role = 'owner')
)
WITH CHECK (
    host_id = auth.uid() 
    OR auth.uid() IN (SELECT id FROM public.users_profile WHERE role = 'owner')
);

GRANT ALL ON public.riwayat_laporan_pdf TO authenticated;
GRANT ALL ON public.riwayat_laporan_pdf TO service_role;
