-- ==============================================================================
-- HRIS PADI TECH - PHASE 5: DATABASE OPTIMIZATIONS & ANTI-PAUSE (PG_CRON)
-- ==============================================================================

-- 1. PERFORMANCE INDEXES (Mempercepat query filtering, sorting, dan joins)
CREATE INDEX IF NOT EXISTS idx_laporan_bimbel_tutor_id ON public.laporan_bimbel(tutor_id);
CREATE INDEX IF NOT EXISTS idx_laporan_bimbel_murid_id ON public.laporan_bimbel(murid_id);
CREATE INDEX IF NOT EXISTS idx_laporan_bimbel_tanggal ON public.laporan_bimbel(tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_laporan_bimbel_created_at ON public.laporan_bimbel(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_laporan_tiktok_host_id ON public.laporan_tiktok(host_id);
CREATE INDEX IF NOT EXISTS idx_laporan_tiktok_tanggal ON public.laporan_tiktok(tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_laporan_tiktok_created_at ON public.laporan_tiktok(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_profile_role ON public.users_profile(role);
CREATE INDEX IF NOT EXISTS idx_murid_nama ON public.murid(nama);

-- 2. TABEL SYSTEM_HEARTBEAT (Untuk Anti-Pause Otomatis)
CREATE TABLE IF NOT EXISTS public.system_heartbeat (
    id BIGSERIAL PRIMARY KEY,
    pinged_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    status TEXT NOT NULL DEFAULT 'active'
);

-- Aktifkan RLS pada tabel system_heartbeat
ALTER TABLE public.system_heartbeat ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner view heartbeat" ON public.system_heartbeat;
CREATE POLICY "Owner view heartbeat"
ON public.system_heartbeat FOR SELECT
TO authenticated
USING (public.is_owner());

-- 3. FUNGSI ANTI-PAUSE & ROTASI DATA
CREATE OR REPLACE FUNCTION public.perform_system_heartbeat()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Masukkan 1 baris heartbeat harian
    INSERT INTO public.system_heartbeat (status)
    VALUES ('daily_pulse');

    -- Bersihkan log heartbeat lama (> 30 hari) agar storage tetap ringan
    DELETE FROM public.system_heartbeat
    WHERE pinged_at < (now() - INTERVAL '30 days');
END;
$$;

-- 4. JADWALKAN PG_CRON DI SUPABASE (Menjalankan heartbeat setiap hari jam 00:00 UTC / 07:00 WIB)
-- Catatan: Pastikan ekstensi pg_cron aktif di Supabase Database -> Extensions
DO $$ BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION
    WHEN OTHERS THEN null;
END $$;

DO $$ BEGIN
    -- Jadwalkan cron harian (00:00 UTC = 07:00 WIB)
    PERFORM cron.schedule(
        'keep_supabase_alive_daily',
        '0 0 * * *',
        'SELECT public.perform_system_heartbeat();'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN OTHERS THEN null;
END $$;
