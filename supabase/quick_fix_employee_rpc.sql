-- ==============================================================================
-- HRIS PADI TECH - MASTER DATABASE SETUP & ROLE AUTHENTICATION FIX
-- ==============================================================================
-- Script ini memperbaiki otentikasi login karyawan & owner, memastikan setiap
-- role (Owner, Tutor Bimbel, Host TikTok Live) tersimpan dengan benar di DB Supabase
-- dan bisa login langsung tanpa kendala konfirmasi email atau skema error.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. ENUM ROLE & TABEL USERS_PROFILE
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('owner', 'tutor', 'host');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.users_profile (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nama TEXT NOT NULL,
    email TEXT,
    role user_role NOT NULL DEFAULT 'tutor',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Pastikan kolom email ada
ALTER TABLE public.users_profile ADD COLUMN IF NOT EXISTS email TEXT;

-- ------------------------------------------------------------------------------
-- 2. HELPER IS_OWNER (Security Definer)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 3. TRIGGER AUTO-CONFIRM EMAIL SEBELUM INSERT KE AUTH.USERS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_confirm_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
    NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, now());
    NEW.aud := COALESCE(NEW.aud, 'authenticated');
    NEW.role := COALESCE(NEW.role, 'authenticated');
    NEW.is_sso_user := COALESCE(NEW.is_sso_user, false);
    NEW.is_anonymous := COALESCE(NEW.is_anonymous, false);
    NEW.raw_app_meta_data := COALESCE(NEW.raw_app_meta_data, '{"provider":"email","providers":["email"]}'::jsonb);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_before_insert ON auth.users;
CREATE TRIGGER on_auth_user_before_insert
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_confirm_auth_user();

-- ------------------------------------------------------------------------------
-- 4. TRIGGER AUTO-SYNC AUTH.USERS -> PUBLIC.USERS_PROFILE
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_role user_role;
    user_name TEXT;
    user_email TEXT;
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

    user_email := lower(trim(NEW.email));

    INSERT INTO public.users_profile (id, nama, email, role)
    VALUES (NEW.id, user_name, user_email, default_role)
    ON CONFLICT (id) DO UPDATE
    SET nama = EXCLUDED.nama,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        updated_at = now();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 5. TRIGGER SYNC PROFILE KE AUTH USER METADATA (Saat Owner Edit di Dashboard)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_profile_to_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_build_object(
        'nama', NEW.nama,
        'role', NEW.role::text
    ),
    updated_at = now()
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_users_profile_updated ON public.users_profile;
CREATE TRIGGER on_users_profile_updated
    AFTER UPDATE ON public.users_profile
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_profile_to_auth();

-- ------------------------------------------------------------------------------
-- 6. FUNGSI OWNER DAFTAR KARYAWAN (FULL STANDALONE & ZERO FAILURE)
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
    existing_user_id UUID;
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

    IF length(p_password) < 6 THEN
        RAISE EXCEPTION 'Password minimal 6 karakter!';
    END IF;

    -- Cek jika akun sudah ada di auth.users sebelumnya (Self-healing update)
    SELECT id INTO existing_user_id FROM auth.users WHERE email = clean_email;

    IF existing_user_id IS NOT NULL THEN
        UPDATE auth.users
        SET encrypted_password = crypt(p_password, gen_salt('bf')),
            raw_user_meta_data = jsonb_build_object('nama', p_nama, 'role', target_role::text),
            raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            aud = 'authenticated',
            role = 'authenticated',
            is_sso_user = false,
            is_anonymous = false,
            updated_at = now()
        WHERE id = existing_user_id;

        DELETE FROM auth.identities WHERE user_id = existing_user_id;
        
        INSERT INTO auth.identities (
            id, user_id, identity_data, provider,
            last_sign_in_at, created_at, updated_at, provider_id
        )
        VALUES (
            existing_user_id::text,
            existing_user_id,
            jsonb_build_object('sub', existing_user_id::text, 'email', clean_email, 'email_verified', true, 'phone_verified', false),
            'email',
            now(), now(), now(),
            existing_user_id::text
        );

        INSERT INTO public.users_profile (id, nama, email, role)
        VALUES (existing_user_id, p_nama, clean_email, target_role)
        ON CONFLICT (id) DO UPDATE
        SET nama = EXCLUDED.nama,
            email = EXCLUDED.email,
            role = EXCLUDED.role,
            updated_at = now();

        RETURN jsonb_build_object(
            'success', true,
            'user_id', existing_user_id,
            'email', clean_email,
            'nama', p_nama,
            'role', target_role::text,
            'status', 'updated_and_synced'
        );
    END IF;

    new_user_id := gen_random_uuid();

    INSERT INTO auth.users (
        id, instance_id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token,
        is_sso_user, is_anonymous
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
        encode(gen_random_bytes(32), 'hex'),
        false, false
    );

    DELETE FROM auth.identities WHERE user_id = new_user_id;

    INSERT INTO auth.identities (
        id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at, provider_id
    )
    VALUES (
        new_user_id::text,
        new_user_id,
        jsonb_build_object('sub', new_user_id::text, 'email', clean_email, 'email_verified', true, 'phone_verified', false),
        'email',
        now(), now(), now(),
        new_user_id::text
    );

    INSERT INTO public.users_profile (id, nama, email, role)
    VALUES (new_user_id, p_nama, clean_email, target_role)
    ON CONFLICT (id) DO UPDATE
    SET nama = EXCLUDED.nama,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        updated_at = now();

    RETURN jsonb_build_object(
        'success', true,
        'user_id', new_user_id,
        'email', clean_email,
        'nama', p_nama,
        'role', target_role::text,
        'status', 'created'
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. FUNGSI SINKRONISASI TOTAL SEMUA USER AUTH KE USERS_PROFILE
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_all_auth_users()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    r RECORD;
    v_role user_role;
    v_nama TEXT;
    v_email TEXT;
    sync_count INT := 0;
BEGIN
    FOR r IN SELECT * FROM auth.users LOOP
        BEGIN
            v_role := (r.raw_user_meta_data->>'role')::user_role;
        EXCEPTION
            WHEN OTHERS THEN
                v_role := 'tutor'::user_role;
        END;

        v_nama := COALESCE(
            r.raw_user_meta_data->>'nama',
            r.raw_user_meta_data->>'name',
            split_part(r.email, '@', 1)
        );

        v_email := lower(trim(r.email));

        -- Auto-confirm email jika belum
        UPDATE auth.users
        SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
            aud = 'authenticated',
            role = 'authenticated',
            is_sso_user = false,
            is_anonymous = false,
            raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb
        WHERE id = r.id;

        -- Pastikan identities terhubung
        DELETE FROM auth.identities WHERE user_id = r.id;
        INSERT INTO auth.identities (
            id, user_id, identity_data, provider,
            last_sign_in_at, created_at, updated_at, provider_id
        )
        VALUES (
            r.id::text,
            r.id,
            jsonb_build_object('sub', r.id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
            'email',
            now(), now(), now(),
            r.id::text
        );

        INSERT INTO public.users_profile (id, nama, email, role)
        VALUES (r.id, v_nama, v_email, v_role)
        ON CONFLICT (id) DO UPDATE
        SET nama = EXCLUDED.nama,
            email = EXCLUDED.email,
            role = EXCLUDED.role,
            updated_at = now();

        sync_count := sync_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'synced_count', sync_count
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. FUNGSI RESET SANDI & HAPUS KARYAWAN
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
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
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

    DELETE FROM public.laporan_bimbel WHERE tutor_id = p_user_id;
    DELETE FROM public.laporan_tiktok WHERE host_id = p_user_id;
    DELETE FROM public.users_profile WHERE id = p_user_id;
    DELETE FROM auth.identities WHERE user_id = p_user_id;
    DELETE FROM auth.users WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Akun karyawan dan data terkait berhasil dihapus total.'
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 9. RLS POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner can manage all profiles" ON public.users_profile;
CREATE POLICY "Owner can manage all profiles"
ON public.users_profile FOR ALL
TO authenticated
USING (public.is_owner() OR id = auth.uid())
WITH CHECK (public.is_owner() OR id = auth.uid());

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users_profile;
EXCEPTION WHEN OTHERS THEN null; END $$;

-- Berikan izin akses eksekusi ke authenticated users
GRANT EXECUTE ON FUNCTION public.owner_create_employee(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_reset_employee_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_delete_employee(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_all_auth_users() TO authenticated;

-- Jalankan perbaikan sinkronisasi sekarang
SELECT public.sync_all_auth_users();
