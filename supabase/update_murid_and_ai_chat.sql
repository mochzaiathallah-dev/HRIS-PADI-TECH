-- ==============================================================================
-- HRIS PADI TECH - UPDATE RLS MURID & AI CHAT SESSIONS (REALTIME FULL CRUD)
-- ==============================================================================
-- Jalankan query ini di Supabase SQL Editor:
-- 1. Izinkan Tutor & Owner untuk mendaftarkan, mengedit, dan menghapus data Murid.
-- 2. Buat fungsi RPC fallback untuk pendaftaran murid (bypass RLS dengan aman).
-- 3. Tambah kolom session_id dan session_title pada tabel ai_chat_history.
-- ==============================================================================

-- 1. UPDATE POLICY RLS PADA TABEL MURID
ALTER TABLE public.murid ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can manage murid" ON public.murid;
DROP POLICY IF EXISTS "Tutor and owner can manage murid" ON public.murid;
DROP POLICY IF EXISTS "Authenticated users can read murid" ON public.murid;
DROP POLICY IF EXISTS "Staff can manage murid" ON public.murid;

-- Semua user yang login (owner, tutor, host) dapat membaca data murid
CREATE POLICY "Authenticated users can read murid"
ON public.murid FOR SELECT
TO authenticated
USING (true);

-- Tutor dan Owner dapat melakukan INSERT, UPDATE, dan DELETE pada tabel murid
CREATE POLICY "Tutor and owner can manage murid"
ON public.murid FOR ALL
TO authenticated
USING (
    auth.uid() IN (SELECT id FROM public.users_profile WHERE role IN ('owner', 'tutor'))
)
WITH CHECK (
    auth.uid() IN (SELECT id FROM public.users_profile WHERE role IN ('owner', 'tutor'))
);

-- Berikan izin akses penuh ke tabel murid
GRANT ALL ON public.murid TO authenticated;
GRANT ALL ON public.murid TO service_role;

-- 2. FUNGSI RPC KEAMANAN: TUTOR INPUT MURID (FAIL-SAFE RPC)
CREATE OR REPLACE FUNCTION public.tutor_create_murid(
    p_nama TEXT,
    p_tingkat_kelas TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    new_id UUID;
    v_role TEXT;
BEGIN
    -- Validasi role user yang memanggil
    SELECT role::text INTO v_role FROM public.users_profile WHERE id = auth.uid();
    IF v_role NOT IN ('owner', 'tutor') THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya Tutor dan Owner yang dapat mendaftarkan murid.';
    END IF;

    -- Validasi input
    IF p_nama IS NULL OR length(trim(p_nama)) < 2 THEN
        RAISE EXCEPTION 'Nama murid minimal 2 karakter.';
    END IF;

    INSERT INTO public.murid (nama, tingkat_kelas)
    VALUES (trim(p_nama), trim(p_tingkat_kelas))
    RETURNING id INTO new_id;

    RETURN jsonb_build_object(
        'success', true,
        'id', new_id,
        'nama', trim(p_nama),
        'tingkat_kelas', trim(p_tingkat_kelas)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_create_murid TO authenticated;

-- 3. FUNGSI RPC HAPUS MURID OLEH TUTOR/OWNER
CREATE OR REPLACE FUNCTION public.tutor_delete_murid(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role::text INTO v_role FROM public.users_profile WHERE id = auth.uid();
    IF v_role NOT IN ('owner', 'tutor') THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya Tutor dan Owner yang dapat menghapus data murid.';
    END IF;

    DELETE FROM public.murid WHERE id = p_id;
    RETURN jsonb_build_object('success', true, 'id', p_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_delete_murid TO authenticated;

-- 4. UPDATE TABEL AI_CHAT_HISTORY UNTUK MENYIMPAN MULTI-SESI / CHAT GEMINI STYLE
ALTER TABLE public.ai_chat_history ADD COLUMN IF NOT EXISTS session_id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.ai_chat_history ADD COLUMN IF NOT EXISTS session_title TEXT DEFAULT 'Percakapan Baru';

CREATE INDEX IF NOT EXISTS idx_ai_chat_session 
ON public.ai_chat_history(user_id, role, session_id, created_at ASC);

-- Pastikan realtime aktif untuk tabel murid dan ai_chat_history
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.murid;
    EXCEPTION
        WHEN duplicate_object THEN null;
        WHEN others THEN null;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_chat_history;
    EXCEPTION
        WHEN duplicate_object THEN null;
        WHEN others THEN null;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.laporan_bimbel;
    EXCEPTION
        WHEN duplicate_object THEN null;
        WHEN others THEN null;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.laporan_tiktok;
    EXCEPTION
        WHEN duplicate_object THEN null;
        WHEN others THEN null;
    END;
END $$;

-- ==============================================================================
-- 5. PERBAIKAN TOTAL RLS & FUNGSI RPC CRUD LAPORAN BIMBEL & TIKTOK
-- ==============================================================================

-- A. PERBAIKI RLS LAPORAN BIMBEL (TUTOR DAPAT FULL CRUD LAPORAN SENDIRI, OWNER BISA SEMUA)
ALTER TABLE public.laporan_bimbel ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can update or delete bimbel reports" ON public.laporan_bimbel;
DROP POLICY IF EXISTS "Tutor and Owner can view bimbel reports" ON public.laporan_bimbel;
DROP POLICY IF EXISTS "Tutors can insert own bimbel reports" ON public.laporan_bimbel;
DROP POLICY IF EXISTS "Tutor and Owner can update bimbel reports" ON public.laporan_bimbel;
DROP POLICY IF EXISTS "Tutor and Owner can delete bimbel reports" ON public.laporan_bimbel;
DROP POLICY IF EXISTS "Tutor and Owner can manage bimbel reports" ON public.laporan_bimbel;

CREATE POLICY "Tutor and Owner can view bimbel reports"
ON public.laporan_bimbel FOR SELECT
TO authenticated
USING (
    tutor_id = auth.uid() 
    OR auth.uid() IN (SELECT id FROM public.users_profile WHERE role = 'owner')
);

CREATE POLICY "Tutor and Owner can insert bimbel reports"
ON public.laporan_bimbel FOR INSERT
TO authenticated
WITH CHECK (
    tutor_id = auth.uid() 
    OR auth.uid() IN (SELECT id FROM public.users_profile WHERE role = 'owner')
);

CREATE POLICY "Tutor and Owner can update bimbel reports"
ON public.laporan_bimbel FOR UPDATE
TO authenticated
USING (
    tutor_id = auth.uid() 
    OR auth.uid() IN (SELECT id FROM public.users_profile WHERE role = 'owner')
)
WITH CHECK (
    tutor_id = auth.uid() 
    OR auth.uid() IN (SELECT id FROM public.users_profile WHERE role = 'owner')
);

CREATE POLICY "Tutor and Owner can delete bimbel reports"
ON public.laporan_bimbel FOR DELETE
TO authenticated
USING (
    tutor_id = auth.uid() 
    OR auth.uid() IN (SELECT id FROM public.users_profile WHERE role = 'owner')
);

GRANT ALL ON public.laporan_bimbel TO authenticated;
GRANT ALL ON public.laporan_bimbel TO service_role;

-- B. PERBAIKI RLS LAPORAN TIKTOK (HOST DAPAT FULL CRUD LAPORAN SENDIRI, OWNER BISA SEMUA)
ALTER TABLE public.laporan_tiktok ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can update or delete tiktok reports" ON public.laporan_tiktok;
DROP POLICY IF EXISTS "Host and Owner can view tiktok reports" ON public.laporan_tiktok;
DROP POLICY IF EXISTS "Hosts can insert own tiktok reports" ON public.laporan_tiktok;
DROP POLICY IF EXISTS "Host and Owner can update tiktok reports" ON public.laporan_tiktok;
DROP POLICY IF EXISTS "Host and Owner can delete tiktok reports" ON public.laporan_tiktok;
DROP POLICY IF EXISTS "Host and Owner can manage tiktok reports" ON public.laporan_tiktok;

CREATE POLICY "Host and Owner can view tiktok reports"
ON public.laporan_tiktok FOR SELECT
TO authenticated
USING (
    host_id = auth.uid() 
    OR auth.uid() IN (SELECT id FROM public.users_profile WHERE role = 'owner')
);

CREATE POLICY "Host and Owner can insert tiktok reports"
ON public.laporan_tiktok FOR INSERT
TO authenticated
WITH CHECK (
    host_id = auth.uid() 
    OR auth.uid() IN (SELECT id FROM public.users_profile WHERE role = 'owner')
);

CREATE POLICY "Host and Owner can update tiktok reports"
ON public.laporan_tiktok FOR UPDATE
TO authenticated
USING (
    host_id = auth.uid() 
    OR auth.uid() IN (SELECT id FROM public.users_profile WHERE role = 'owner')
)
WITH CHECK (
    host_id = auth.uid() 
    OR auth.uid() IN (SELECT id FROM public.users_profile WHERE role = 'owner')
);

CREATE POLICY "Host and Owner can delete tiktok reports"
ON public.laporan_tiktok FOR DELETE
TO authenticated
USING (
    host_id = auth.uid() 
    OR auth.uid() IN (SELECT id FROM public.users_profile WHERE role = 'owner')
);

GRANT ALL ON public.laporan_tiktok TO authenticated;
GRANT ALL ON public.laporan_tiktok TO service_role;

-- C. FUNGSI RPC SECURITY DEFINER: TUTOR UPDATE LAPORAN BIMBEL (FAIL-SAFE)
CREATE OR REPLACE FUNCTION public.tutor_update_laporan_bimbel(
    p_id UUID,
    p_tanggal DATE,
    p_murid_id UUID,
    p_mata_pelajaran TEXT,
    p_topik TEXT,
    p_ringkasan TEXT,
    p_foto_kegiatan_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_role TEXT;
    v_report_tutor UUID;
BEGIN
    SELECT tutor_id INTO v_report_tutor FROM public.laporan_bimbel WHERE id = p_id;
    IF v_report_tutor IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Laporan tidak ditemukan');
    END IF;

    SELECT role::text INTO v_role FROM public.users_profile WHERE id = v_uid;
    IF v_role != 'owner' AND v_report_tutor != v_uid THEN
        RAISE EXCEPTION 'Akses ditolak: Anda hanya dapat memperbarui laporan Anda sendiri.';
    END IF;

    UPDATE public.laporan_bimbel
    SET tanggal = p_tanggal,
        murid_id = p_murid_id,
        mata_pelajaran = trim(p_mata_pelajaran),
        topik = trim(p_topik),
        ringkasan = trim(p_ringkasan),
        foto_kegiatan_url = p_foto_kegiatan_url
    WHERE id = p_id;

    RETURN jsonb_build_object('success', true, 'id', p_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.tutor_update_laporan_bimbel TO authenticated;

-- D. FUNGSI RPC SECURITY DEFINER: TUTOR HAPUS LAPORAN BIMBEL (FAIL-SAFE)
CREATE OR REPLACE FUNCTION public.tutor_delete_laporan_bimbel(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_role TEXT;
    v_report_tutor UUID;
BEGIN
    SELECT tutor_id INTO v_report_tutor FROM public.laporan_bimbel WHERE id = p_id;
    IF v_report_tutor IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Laporan tidak ditemukan');
    END IF;

    SELECT role::text INTO v_role FROM public.users_profile WHERE id = v_uid;
    IF v_role != 'owner' AND v_report_tutor != v_uid THEN
        RAISE EXCEPTION 'Akses ditolak: Anda hanya dapat menghapus laporan Anda sendiri.';
    END IF;

    DELETE FROM public.laporan_bimbel WHERE id = p_id;
    RETURN jsonb_build_object('success', true, 'id', p_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.tutor_delete_laporan_bimbel TO authenticated;

-- E. FUNGSI RPC SECURITY DEFINER: HOST UPDATE LAPORAN TIKTOK (FAIL-SAFE)
CREATE OR REPLACE FUNCTION public.host_update_laporan_tiktok(
    p_id UUID,
    p_tanggal DATE,
    p_durasi_menit INT,
    p_tayangan INT,
    p_impresi INT,
    p_gmv_rupiah NUMERIC,
    p_catatan TEXT DEFAULT NULL,
    p_foto_bukti_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_role TEXT;
    v_report_host UUID;
BEGIN
    SELECT host_id INTO v_report_host FROM public.laporan_tiktok WHERE id = p_id;
    IF v_report_host IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Laporan tidak ditemukan');
    END IF;

    SELECT role::text INTO v_role FROM public.users_profile WHERE id = v_uid;
    IF v_role != 'owner' AND v_report_host != v_uid THEN
        RAISE EXCEPTION 'Akses ditolak: Anda hanya dapat memperbarui laporan Anda sendiri.';
    END IF;

    UPDATE public.laporan_tiktok
    SET tanggal = p_tanggal,
        durasi_menit = p_durasi_menit,
        tayangan = p_tayangan,
        impresi = p_impresi,
        gmv_rupiah = p_gmv_rupiah,
        catatan = p_catatan,
        foto_bukti_url = COALESCE(p_foto_bukti_url, foto_bukti_url)
    WHERE id = p_id;

    RETURN jsonb_build_object('success', true, 'id', p_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.host_update_laporan_tiktok TO authenticated;

-- F. FUNGSI RPC SECURITY DEFINER: HOST HAPUS LAPORAN TIKTOK (FAIL-SAFE)
CREATE OR REPLACE FUNCTION public.host_delete_laporan_tiktok(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_role TEXT;
    v_report_host UUID;
BEGIN
    SELECT host_id INTO v_report_host FROM public.laporan_tiktok WHERE id = p_id;
    IF v_report_host IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Laporan tidak ditemukan');
    END IF;

    SELECT role::text INTO v_role FROM public.users_profile WHERE id = v_uid;
    IF v_role != 'owner' AND v_report_host != v_uid THEN
        RAISE EXCEPTION 'Akses ditolak: Anda hanya dapat menghapus laporan Anda sendiri.';
    END IF;

    DELETE FROM public.laporan_tiktok WHERE id = p_id;
    RETURN jsonb_build_object('success', true, 'id', p_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.host_delete_laporan_tiktok TO authenticated;

