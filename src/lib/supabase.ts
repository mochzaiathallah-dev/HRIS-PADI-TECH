import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string || '').trim()
export const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string || '').trim()

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Perhatian: VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY belum terpasang di Environment Variables Vercel.'
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)


