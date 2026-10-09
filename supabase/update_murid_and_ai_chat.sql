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
END $$;
