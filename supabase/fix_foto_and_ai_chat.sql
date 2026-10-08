-- ==============================================================================
-- HRIS PADI TECH - FIX FOTO KEGIATAN & AI CHAT HISTORY PER USER & ROLE
-- ==============================================================================
-- Jalankan query ini di Supabase SQL Editor:
-- 1. Menambahkan kolom foto_kegiatan_url ke tabel laporan_bimbel
-- 2. Membuat tabel ai_chat_history untuk menyimpan riwayat chat AI per user & role
-- ==============================================================================

-- 1. Tambah kolom foto_kegiatan_url pada laporan_bimbel jika belum ada
ALTER TABLE public.laporan_bimbel ADD COLUMN IF NOT EXISTS foto_kegiatan_url TEXT;

-- 2. Buat tabel ai_chat_history
CREATE TABLE IF NOT EXISTS public.ai_chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'tutor', -- 'tutor', 'host', atau 'owner'
    message_role TEXT NOT NULL DEFAULT 'user', -- 'user' atau 'assistant'
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Buat index untuk pencarian cepat berdasarkan user_id dan role
CREATE INDEX IF NOT EXISTS idx_ai_chat_user_role 
ON public.ai_chat_history(user_id, role, created_at ASC);

-- 3. Aktifkan Row Level Security (RLS)
ALTER TABLE public.ai_chat_history ENABLE ROW LEVEL SECURITY;

-- 4. Kebijakan RLS: Pengguna hanya dapat membaca dan menambah riwayat chat miliknya sendiri
DROP POLICY IF EXISTS "Users can manage own ai chat history" ON public.ai_chat_history;
CREATE POLICY "Users can manage own ai chat history"
ON public.ai_chat_history FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Berikan izin akses ke authenticated users
GRANT ALL ON public.ai_chat_history TO authenticated;
GRANT ALL ON public.ai_chat_history TO service_role;
