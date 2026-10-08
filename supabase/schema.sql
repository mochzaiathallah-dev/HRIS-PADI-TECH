-- ==============================================================================
-- HRIS PADI TECH - SUPABASE DATABASE SCHEMA & ROW LEVEL SECURITY (RLS)
-- Complete Production Schema (Phase 1 - Phase 5 + Employee Management Functions)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM TIPE ROLE
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('owner', 'tutor', 'host');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. TABEL USERS_PROFILE (Relasi ke auth.users)
CREATE TABLE IF NOT EXISTS public.users_profile (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nama TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'tutor',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. TABEL MURID (Data Siswa Bimbingan Belajar)
CREATE TABLE IF NOT EXISTS public.murid (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama TEXT NOT NULL,
    tingkat_kelas TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. TABEL LAPORAN_BIMBEL (Pencatatan Sesi Mengajar Tutor)
CREATE TABLE IF NOT EXISTS public.laporan_bimbel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tutor_id UUID NOT NULL REFERENCES public.users_profile(id) ON DELETE RESTRICT,
    murid_id UUID NOT NULL REFERENCES public.murid(id) ON DELETE RESTRICT,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    mata_pelajaran TEXT NOT NULL,
    topik TEXT NOT NULL,
    ringkasan TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. TABEL LAPORAN_TIKTOK (Pencatatan Metrik Live Commerce Host)
CREATE TABLE IF NOT EXISTS public.laporan_tiktok (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id UUID NOT NULL REFERENCES public.users_profile(id) ON DELETE RESTRICT,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    durasi_menit INTEGER NOT NULL CHECK (durasi_menit > 0),
    gmv_rupiah BIGINT NOT NULL CHECK (gmv_rupiah >= 0),
    tayangan INTEGER NOT NULL DEFAULT 0 CHECK (tayangan >= 0),
    impresi INTEGER NOT NULL DEFAULT 0 CHECK (impresi >= 0),
    foto_bukti_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. HELPER FUNCTION: IS_OWNER (Security Definer untuk menghindari rekursi RLS)
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

-- 8. AKTIFKAN ROW LEVEL SECURITY (RLS) PADA SEMUA TABEL
ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.murid ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laporan_bimbel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laporan_tiktok ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- RLS POLICIES
-- ==============================================================================

-- A. Policy users_profile:
DROP POLICY IF EXISTS "Users can read own profile or owner can read all" ON public.users_profile;
CREATE POLICY "Users can read own profile or owner can read all"
ON public.users_profile FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.is_owner());

DROP POLICY IF EXISTS "Users can update own profile name" ON public.users_profile;
CREATE POLICY "Users can update own profile name"
ON public.users_profile FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- B. Policy murid:
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

-- C. Policy laporan_bimbel:
DROP POLICY IF EXISTS "Tutor view own or owner view all bimbel" ON public.laporan_bimbel;
CREATE POLICY "Tutor view own or owner view all bimbel"
ON public.laporan_bimbel FOR SELECT
TO authenticated
USING (tutor_id = auth.uid() OR public.is_owner());

DROP POLICY IF EXISTS "Tutor insert own bimbel report" ON public.laporan_bimbel;
CREATE POLICY "Tutor insert own bimbel report"
ON public.laporan_bimbel FOR INSERT
TO authenticated
WITH CHECK (tutor_id = auth.uid());

DROP POLICY IF EXISTS "Only owner can manage bimbel report" ON public.laporan_bimbel;
CREATE POLICY "Only owner can manage bimbel report"
ON public.laporan_bimbel FOR ALL
TO authenticated
USING (public.is_owner())
WITH CHECK (public.is_owner());

-- D. Policy laporan_tiktok:
DROP POLICY IF EXISTS "Host view own or owner view all tiktok" ON public.laporan_tiktok;
CREATE POLICY "Host view own or owner view all tiktok"
ON public.laporan_tiktok FOR SELECT
TO authenticated
USING (host_id = auth.uid() OR public.is_owner());

DROP POLICY IF EXISTS "Host insert own tiktok report" ON public.laporan_tiktok;
CREATE POLICY "Host insert own tiktok report"
ON public.laporan_tiktok FOR INSERT
TO authenticated
WITH CHECK (host_id = auth.uid());

DROP POLICY IF EXISTS "Only owner can manage tiktok report" ON public.laporan_tiktok;
CREATE POLICY "Only owner can manage tiktok report"
ON public.laporan_tiktok FOR ALL
TO authenticated
USING (public.is_owner())
WITH CHECK (public.is_owner());

-- ==============================================================================
-- 9. POSTGRESQL TRIGGER: AUTO-SYNC AUTH.USERS -> PUBLIC.USERS_PROFILE
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_role user_role;
    user_name TEXT;
BEGIN
    BEGIN
        default_role := (NEW.raw_user_meta_data->>'role')::user_role;
    EXCEPTION
        WHEN OTHERS THEN
            default_role := 'tutor'::user_role;
    END;

    user_name := COALESCE(
        NEW.raw_user_meta_data->>'nama',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );

    INSERT INTO public.users_profile (id, nama, role)
    VALUES (NEW.id, user_name, default_role)
    ON CONFLICT (id) DO UPDATE
    SET nama = EXCLUDED.nama,
        role = EXCLUDED.role,
        updated_at = timezone('utc'::text, now());

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 10. SUPABASE STORAGE: BUCKET BUKTI_TIKTOK & RLS
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('bukti_tiktok', 'bukti_tiktok', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public view for bukti_tiktok" ON storage.objects;
CREATE POLICY "Public view for bukti_tiktok"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'bukti_tiktok');

DROP POLICY IF EXISTS "Authenticated users can upload bukti_tiktok" ON storage.objects;
CREATE POLICY "Authenticated users can upload bukti_tiktok"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'bukti_tiktok');

-- ==============================================================================
-- 11. SUPABASE REALTIME REPLICATION
-- ==============================================================================

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.laporan_bimbel;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN OTHERS THEN null;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.laporan_tiktok;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN OTHERS THEN null;
END $$;

-- ==============================================================================
-- 12. SAMPLE DATA MURID
-- ==============================================================================

INSERT INTO public.murid (nama, tingkat_kelas)
VALUES 
    ('Ahmad Fauzan', 'SD Kelas 5'),
    ('Siti Nurhaliza', 'SMP Kelas 8'),
    ('Budi Santoso', 'SMA Kelas 11'),
    ('Dewi Lestari', 'SD Kelas 6'),
    ('Rizky Pratama', 'SMP Kelas 9')
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- 13. PERFORMANCE INDEXES (PHASE 5 OPTIMIZATION)
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_laporan_bimbel_tutor_id ON public.laporan_bimbel(tutor_id);
CREATE INDEX IF NOT EXISTS idx_laporan_bimbel_murid_id ON public.laporan_bimbel(murid_id);
CREATE INDEX IF NOT EXISTS idx_laporan_bimbel_tanggal ON public.laporan_bimbel(tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_laporan_bimbel_created_at ON public.laporan_bimbel(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_laporan_tiktok_host_id ON public.laporan_tiktok(host_id);
CREATE INDEX IF NOT EXISTS idx_laporan_tiktok_tanggal ON public.laporan_tiktok(tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_laporan_tiktok_created_at ON public.laporan_tiktok(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_profile_role ON public.users_profile(role);
CREATE INDEX IF NOT EXISTS idx_murid_nama ON public.murid(nama);

-- ==============================================================================
-- 14. ANTI-PAUSE KEEP-ALIVE (PG_CRON & SYSTEM HEARTBEAT)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.system_heartbeat (
    id BIGSERIAL PRIMARY KEY,
    pinged_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    status TEXT NOT NULL DEFAULT 'active'
);

ALTER TABLE public.system_heartbeat ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner view heartbeat" ON public.system_heartbeat;
CREATE POLICY "Owner view heartbeat"
ON public.system_heartbeat FOR SELECT
TO authenticated
USING (public.is_owner());

CREATE OR REPLACE FUNCTION public.perform_system_heartbeat()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.system_heartbeat (status)
    VALUES ('daily_pulse');

    DELETE FROM public.system_heartbeat
    WHERE pinged_at < (now() - INTERVAL '30 days');
END;
$$;

DO $$ BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION
    WHEN OTHERS THEN null;
END $$;

DO $$ BEGIN
    PERFORM cron.schedule(
        'keep_supabase_alive_daily',
        '0 0 * * *',
        'SELECT public.perform_system_heartbeat();'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN OTHERS THEN null;
END $$;

-- ==============================================================================
-- 15. OWNER EMPLOYEE MANAGEMENT & PASSWORD RESET FUNCTIONS
-- ==============================================================================

-- Pastikan RLS users_profile mengizinkan Owner untuk manage
DROP POLICY IF EXISTS "Owner can manage all profiles" ON public.users_profile;
CREATE POLICY "Owner can manage all profiles"
ON public.users_profile FOR ALL
TO authenticated
USING (public.is_owner())
WITH CHECK (public.is_owner());

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
            RAISE EXCEPTION 'Role % tidak valid! Pilih tutor atau host.', p_role;
    END;

    IF EXISTS (SELECT 1 FROM auth.users WHERE email = clean_email) THEN
        RAISE EXCEPTION 'Email % sudah terdaftar di sistem. Gunakan email lain!', clean_email;
    END IF;

    IF length(p_password) < 6 THEN
        RAISE EXCEPTION 'Password minimal 6 karakter!';
    END IF;

    new_user_id := gen_random_uuid();

    -- Insert ke auth.users dengan status terverifikasi (email_confirmed_at = now())
    -- Mencegah pengiriman email verifikasi sehingga 100% bebas dari 'email rate limit exceeded'
    INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token
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
        now(),
        now(),
        encode(gen_random_bytes(32), 'hex')
    );

    INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at,
        provider_id
    )
    VALUES (
        gen_random_uuid(),
        new_user_id,
        jsonb_build_object('sub', new_user_id::text, 'email', clean_email),
        'email',
        now(),
        now(),
        now(),
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

GRANT EXECUTE ON FUNCTION public.owner_create_employee(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_reset_employee_password(UUID, TEXT) TO authenticated;

