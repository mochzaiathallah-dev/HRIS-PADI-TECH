-- ==============================================================================
-- HRIS PADI TECH - SQL FULL CRUD & REALTIME POWERSCRIPT
-- ==============================================================================
-- Jalankan skrip ini di Supabase SQL Editor untuk mengaktifkan:
-- 1. Full CRUD RLS untuk Owner di semua tabel (users_profile, murid, laporan_bimbel, laporan_tiktok)
-- 2. Realtime publication untuk semua tabel
-- 3. Fungsi Tambah Karyawan Bebas Email Rate Limit
-- 4. Fungsi Ganti Sandi Karyawan
-- 5. Fungsi Hapus Karyawan (Cascade)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- 1. RLS POLICIES (FULL CRUD OWNER & ACCESS CONTROL)
-- ------------------------------------------------------------------------------

-- Helper is_owner
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users_profile
        WHERE id = auth.uid() AND role = 'owner'
    );
$$;

-- RLS users_profile
ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can manage all profiles" ON public.users_profile;
CREATE POLICY "Owner can manage all profiles"
ON public.users_profile FOR ALL
TO authenticated
USING (public.is_owner() OR id = auth.uid())
WITH CHECK (public.is_owner() OR id = auth.uid());

-- RLS murid
ALTER TABLE public.murid ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read murid" ON public.murid;
CREATE POLICY "Authenticated users can read murid"
ON public.murid FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Owner can manage murid" ON public.murid;
CREATE POLICY "Owner can manage murid"
ON public.murid FOR ALL
TO authenticated
USING (public.is_owner())
WITH CHECK (public.is_owner());

-- RLS laporan_bimbel
ALTER TABLE public.laporan_bimbel ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tutor view own or owner view all bimbel" ON public.laporan_bimbel;
CREATE POLICY "Tutor view own or owner view all bimbel"
ON public.laporan_bimbel FOR SELECT
TO authenticated
USING (tutor_id = auth.uid() OR public.is_owner());

DROP POLICY IF EXISTS "Tutor insert own bimbel report" ON public.laporan_bimbel;
CREATE POLICY "Tutor insert own bimbel report"
ON public.laporan_bimbel FOR INSERT
TO authenticated
WITH CHECK (tutor_id = auth.uid() OR public.is_owner());

DROP POLICY IF EXISTS "Owner can manage all bimbel" ON public.laporan_bimbel;
CREATE POLICY "Owner can manage all bimbel"
ON public.laporan_bimbel FOR ALL
TO authenticated
USING (public.is_owner())
WITH CHECK (public.is_owner());

-- RLS laporan_tiktok
ALTER TABLE public.laporan_tiktok ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Host view own or owner view all tiktok" ON public.laporan_tiktok;
CREATE POLICY "Host view own or owner view all tiktok"
ON public.laporan_tiktok FOR SELECT
TO authenticated
USING (host_id = auth.uid() OR public.is_owner());

DROP POLICY IF EXISTS "Host insert own tiktok report" ON public.laporan_tiktok;
CREATE POLICY "Host insert own tiktok report"
ON public.laporan_tiktok FOR INSERT
TO authenticated
WITH CHECK (host_id = auth.uid() OR public.is_owner());

DROP POLICY IF EXISTS "Owner can manage all tiktok" ON public.laporan_tiktok;
CREATE POLICY "Owner can manage all tiktok"
ON public.laporan_tiktok FOR ALL
TO authenticated
USING (public.is_owner())
WITH CHECK (public.is_owner());

-- ------------------------------------------------------------------------------
-- 2. SUPABASE REALTIME REPLICATION (FULL 4 TABLES)
-- ------------------------------------------------------------------------------

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users_profile;
EXCEPTION WHEN OTHERS THEN null; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.murid;
EXCEPTION WHEN OTHERS THEN null; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.laporan_bimbel;
EXCEPTION WHEN OTHERS THEN null; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.laporan_tiktok;
EXCEPTION WHEN OTHERS THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 3. FUNGSI DAFTAR KARYAWAN (BYPASS EMAIL RATE LIMIT)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.owner_create_employee(
    p_email TEXT,
    p_nama TEXT,
    p_password TEXT,
    p_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    new_user_id UUID;
    clean_email TEXT;
    target_role user_role;
BEGIN
    IF NOT public.is_owner() THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya akun Owner yang berhak mendaftarkan karyawan baru!';
    END IF;

    clean_email := lower(trim(p_email));

    IF clean_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RAISE EXCEPTION 'Format email % tidak valid!', clean_email;
    END IF;

    BEGIN
        target_role := p_role::user_role;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Role % tidak valid! Pilih tutor, host, atau owner.', p_role;
    END;

    IF EXISTS (SELECT 1 FROM auth.users WHERE email = clean_email) THEN
        RAISE EXCEPTION 'Email % sudah terdaftar di sistem. Gunakan email lain!', clean_email;
    END IF;

    IF length(p_password) < 6 THEN
        RAISE EXCEPTION 'Password minimal 6 karakter!';
    END IF;

    new_user_id := gen_random_uuid();

    -- Insert ke auth.users (email_confirmed_at = now() bebas rate limit)
    INSERT INTO auth.users (
        id, instance_id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token
    )
    VALUES (
        new_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        clean_email,
        crypt(p_password, gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('nama', p_nama, 'role', target_role::text),
        now(), now(),
        encode(gen_random_bytes(32), 'hex')
    );

    INSERT INTO auth.identities (
        id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at, provider_id
    )
    VALUES (
        gen_random_uuid(),
        new_user_id,
        jsonb_build_object('sub', new_user_id::text, 'email', clean_email),
        'email',
        now(), now(), now(),
        new_user_id::text
    );

    INSERT INTO public.users_profile (id, nama, role)
    VALUES (new_user_id, p_nama, target_role)
    ON CONFLICT (id) DO UPDATE
    SET nama = EXCLUDED.nama,
        role = EXCLUDED.role,
        updated_at = now();

    RETURN jsonb_build_object(
        'success', true,
        'user_id', new_user_id,
        'email', clean_email,
        'nama', p_nama,
        'role', target_role::text
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. FUNGSI GANTI SANDI KARYAWAN OLEH OWNER
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.owner_reset_employee_password(
    p_user_id UUID,
    p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
    IF NOT public.is_owner() THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya akun Owner yang berhak mengganti kata sandi karyawan!';
    END IF;

    IF length(p_new_password) < 6 THEN
        RAISE EXCEPTION 'Password baru minimal 6 karakter!';
    END IF;

    UPDATE auth.users
    SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
        updated_at = now()
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Karyawan dengan ID tersebut tidak ditemukan!';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Kata sandi karyawan berhasil diperbarui.'
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. FUNGSI HAPUS KARYAWAN OLEH OWNER (CASCADE SAFE)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.owner_delete_employee(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
    IF NOT public.is_owner() THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya akun Owner yang berhak menghapus karyawan!';
    END IF;

    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Tidak dapat menghapus akun Anda sendiri!';
    END IF;

    -- Bersihkan relasi foreign key
    DELETE FROM public.laporan_bimbel WHERE tutor_id = p_user_id;
    DELETE FROM public.laporan_tiktok WHERE host_id = p_user_id;
    DELETE FROM public.users_profile WHERE id = p_user_id;
    DELETE FROM auth.identities WHERE user_id = p_user_id;
    DELETE FROM auth.users WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Akun karyawan dan data terkait berhasil dihapus.'
    );
END;
$$;

-- Berikan izin akses
GRANT EXECUTE ON FUNCTION public.owner_create_employee(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_reset_employee_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_delete_employee(UUID) TO authenticated;
