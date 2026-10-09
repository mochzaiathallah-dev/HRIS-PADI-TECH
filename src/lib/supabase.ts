import { createClient } from '@supabase/supabase-js'

// Fallback kredensial Supabase publik (Anon key aman di client-side & terproteksi RLS Supabase)
export const DEFAULT_SUPABASE_URL = 'https://zusbjxtfwzymjfdbewst.supabase.co'
export const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1c2JqeHRmd3p5bWpmZGJld3N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MzQ3NDIsImV4cCI6MjEwNzAxMDc0Mn0.0p1r3qgDqAYTj6Q7p3Q86XqEbeUZVWJ1PGfJfPIWIPY'

export const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim()
export const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim()

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

