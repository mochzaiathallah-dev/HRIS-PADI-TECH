import React, { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { FormBimbel } from '@/components/forms/FormBimbel'
import { FormTikTok } from '@/components/forms/FormTikTok'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  LogOut, 
  GraduationCap, 
  Video, 
  ShieldCheck, 
  User, 
  Smartphone,
  Sparkles
} from 'lucide-react'

export const InputLaporanPage: React.FC = () => {
  const { profile, user, role, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<'bimbel' | 'tiktok'>(
    role === 'host' ? 'tiktok' : 'bimbel'
  )

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans pb-12">
      {/* Mobile-First Header */}
      <header className="sticky top-0 z-30 w-full border-b bg-white/90 dark:bg-slate-900/90 backdrop-blur">
        <div className="container mx-auto flex h-14 items-center justify-between px-4 max-w-xl">
          <div className="flex items-center space-x-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow">
              HP
            </div>
            <div>
              <div className="text-xs font-bold leading-tight">HRIS PADI TECH</div>
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Smartphone className="h-2.5 w-2.5" /> Portal Pelaporan Karyawan
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="capitalize text-[10px] px-2 py-0.5 font-medium">
              {role || 'karyawan'}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut()}
              className="h-8 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950"
            >
              <LogOut className="h-3.5 w-3.5 mr-1" />
              <span className="text-[11px]">Keluar</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 container mx-auto px-4 py-4 max-w-xl space-y-4">
        {/* User Identity Greeting Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-900 text-white shadow-md">
          <div className="flex items-center space-x-3">
            <div className="h-11 w-11 rounded-full bg-white/20 flex items-center justify-center text-white backdrop-blur border border-white/20">
              <User className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-blue-100 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-300" />
                Terotentikasi Supabase Client (RLS Protected)
              </div>
              <h2 className="text-base font-bold truncate">
                {profile?.nama || user?.email?.split('@')[0]}
              </h2>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-slate-200/80 dark:bg-slate-800/80 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('bimbel')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'bimbel'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="h-4 w-4" />
            <span>Form Bimbel</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tiktok')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'tiktok'
                ? 'bg-white dark:bg-slate-900 text-pink-600 dark:text-pink-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Video className="h-4 w-4" />
            <span>Form TikTok Live</span>
          </button>
        </div>

        {/* Active Form Component */}
        {activeTab === 'bimbel' ? <FormBimbel /> : <FormTikTok />}

        {/* Security & Client-Side Note */}
        <div className="text-[11px] text-muted-foreground p-3 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-start gap-2">
          <Sparkles className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
          <span>
            Data laporan Anda dikirim langsung dari browser ke Supabase PostgreSQL tanpa melalui perantara server, menjamin kecepatan maksimal dan keamanan data.
          </span>
        </div>
      </main>
    </div>
  )
}
