-- ==============================================================================
-- HRIS PADI TECH - TAMBAH KOLOM IMAGE_URL PADA AI_CHAT_HISTORY
-- ==============================================================================
-- Jalankan query ini di Supabase SQL Editor:
-- Menambahkan kolom image_url untuk menyimpan link gambar AI resolusi tinggi.
-- Catatan: Sistem frontend HRIS PADI TECH juga memiliki auto-fallback cerdas
-- sehingga fitur gambar AI tetap langsung berfungsi 100% baik kolom ini sudah dibuat maupun belum.
-- ==============================================================================

ALTER TABLE public.ai_chat_history ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Pastikan publikasi realtime mencakup tabel ai_chat_history
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'ai_chat_history'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_chat_history;
    END IF;
END $$;
