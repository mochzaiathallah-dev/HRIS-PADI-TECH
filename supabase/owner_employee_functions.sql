-- ==============================================================================
-- HRIS PADI TECH - OWNER EMPLOYEE MANAGEMENT & PASSWORD RESET FUNCTIONS
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. FUNGSI DAFTARKAN KARYAWAN BARU (TUTOR / HOST) OLEH OWNER
CREATE OR REPLACE FUNCTION public.owner_create_employee(
    p_email TEXT,
    p_password TEXT,
    p_nama TEXT,
    p_role user_role
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    new_user_id UUID;
    clean_email TEXT;
BEGIN
    -- 1. Validasi Keamanan: Pemanggil fungsi WAJIB memiliki role 'owner'
    IF NOT public.is_owner() THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya akun Owner yang berhak mendaftarkan karyawan baru!';
    END IF;

    clean_email := lower(trim(p_email));

    -- 2. Cek apakah email sudah terdaftar
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = clean_email) THEN
        RAISE EXCEPTION 'Email % sudah terdaftar di sistem. Gunakan email lain!', clean_email;
    END IF;

    IF length(p_password) < 6 THEN
        RAISE EXCEPTION 'Password minimal 6 karakter!';
    END IF;

    new_user_id := gen_random_uuid();

    -- 3. Masukkan ke auth.users (Email langsung terkonfirmasi & password terenkripsi)
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
        jsonb_build_object('nama', p_nama, 'role', p_role::text),
        now(),
        now(),
        encode(gen_random_bytes(32), 'hex')
    );

    -- 4. Masukkan ke auth.identities untuk provider email
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

    -- 5. Pastikan profil di public.users_profile terdaftar
    INSERT INTO public.users_profile (id, nama, role)
    VALUES (new_user_id, p_nama, p_role)
    ON CONFLICT (id) DO UPDATE
    SET nama = EXCLUDED.nama,
        role = EXCLUDED.role,
        updated_at = now();

    RETURN jsonb_build_object(
        'success', true,
        'user_id', new_user_id,
        'email', clean_email,
        'nama', p_nama,
        'role', p_role::text
    );
END;
$$;

-- 2. FUNGSI GANTI KATA SANDI KARYAWAN OLEH OWNER
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
    -- 1. Validasi Keamanan: Pemanggil fungsi WAJIB memiliki role 'owner'
    IF NOT public.is_owner() THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya akun Owner yang berhak mengganti kata sandi karyawan!';
    END IF;

    IF length(p_new_password) < 6 THEN
        RAISE EXCEPTION 'Password baru minimal 6 karakter!';
    END IF;

    -- 2. Update password terenkripsi di auth.users
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

-- Berikan izin eksekusi kepada pengguna terotentikasi (keamanan dijamin di dalam fungsi via public.is_owner())
GRANT EXECUTE ON FUNCTION public.owner_create_employee(TEXT, TEXT, TEXT, user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_reset_employee_password(UUID, TEXT) TO authenticated;
