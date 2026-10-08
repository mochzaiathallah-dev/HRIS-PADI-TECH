import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { LaporanTiktok } from '@/types'
import { FormTikTok } from '@/components/forms/FormTikTok'
import { EditTikTokModal } from '@/components/dashboard/EditTikTokModal'
import { DeleteConfirmModal } from '@/components/dashboard/DeleteConfirmModal'
import { AiAssistantModal } from '@/components/ai/AiAssistantModal'
import { setupMidnightHeartbeatWatcher } from '@/lib/heartbeat'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  LogOut, 
  ShieldCheck, 
  User, 
  Smartphone,
  Sparkles,
  Video,
  Clock,
  Eye,
  Activity,
  Edit,
  Trash2,
  RefreshCw,
  Search,
  PlusCircle,
  ListFilter,
  Image as ImageIcon
} from 'lucide-react'

export const DashboardHostPage: React.FC = () => {
  const { profile, user, signOut } = useAuth()

  // Tab State
  const [activeTab, setActiveTab] = useState<'input' | 'manage'>('input')

  // Data States
  const [reports, setReports] = useState<LaporanTiktok[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [realtimePulse, setRealtimePulse] = useState(false)

  // Modals
  const [editTarget, setEditTarget] = useState<LaporanTiktok | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LaporanTiktok | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // Fetch Host Live Reports
  const fetchHostData = useCallback(async () => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('laporan_tiktok')
        .select('*')
        .eq('host_id', user.id)
        .order('tanggal', { ascending: false })

      if (error) throw error
      if (data) setReports(data as LaporanTiktok[])
    } catch (err: any) {
      console.warn('Notice fetching host data:', err.message)
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchHostData()
    const cleanupHeartbeat = setupMidnightHeartbeatWatcher()
    return () => {
      cleanupHeartbeat()
    }
  }, [fetchHostData])

  // Realtime Supabase Subscription
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel('realtime_host_tiktok')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'laporan_tiktok',
          filter: `host_id=eq.${user.id}`,
        },
        () => {
          setRealtimePulse(true)
          setTimeout(() => setRealtimePulse(false), 2000)
          fetchHostData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, fetchHostData])

  // Delete Handler
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('laporan_tiktok')
        .delete()
        .eq('id', deleteTarget.id)

      if (error) throw error

      setDeleteTarget(null)
      await fetchHostData()
    } catch (err: any) {
      console.error('Error deleting report:', err)
      alert(err.message || 'Gagal menghapus laporan live.')
    } finally {
      setIsDeleting(false)
    }
  }

  // Format Currency
  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val)
  }

  // Filtered Reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      return (
        r.tanggal.includes(searchQuery) ||
        r.durasi_menit.toString().includes(searchQuery) ||
        r.gmv_rupiah.toString().includes(searchQuery)
      )
    })
  }, [reports, searchQuery])

  // Total Metrik Host
  const totalGMV = useMemo(() => reports.reduce((acc, curr) => acc + (curr.gmv_rupiah || 0), 0), [reports])
  const totalJam = useMemo(() => (reports.reduce((acc, curr) => acc + (curr.durasi_menit || 0), 0) / 60).toFixed(1), [reports])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans pb-16">
      {/* Header */}
      <header className="sticky top-0 z-30 w-full border-b bg-white/90 dark:bg-slate-900/90 backdrop-blur">
        <div className="container mx-auto flex h-14 items-center justify-between px-4 max-w-4xl">
          <div className="flex items-center space-x-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-pink-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow">
              HP
            </div>
            <div>
              <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
                <span>HRIS PADI TECH</span>
                <span
                  className={`inline-flex h-2 w-2 rounded-full transition-all duration-300 ${
                    realtimePulse ? 'bg-amber-400 scale-125' : 'bg-emerald-500'
                  }`}
                  title="Sinkronisasi Realtime Aktif"
                />
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Smartphone className="h-2.5 w-2.5" /> Portal Operasional Host TikTok Live
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-pink-600 border-pink-200 dark:border-pink-800 text-[10px] px-2 py-0.5 font-medium">
              Host Live
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
      <main className="flex-1 container mx-auto px-4 py-4 max-w-4xl space-y-4">
        {/* User Identity Greeting Card with Metrics */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-pink-600 via-purple-600 to-slate-900 text-white shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center text-white backdrop-blur border border-white/20">
              <User className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-pink-100 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-300" />
                Portal Operasional Live Commerce
              </div>
              <h2 className="text-base sm:text-lg font-bold truncate">
                {profile?.nama || user?.email?.split('@')[0]}
              </h2>
              <div className="text-[11px] text-pink-200">
                {reports.length} sesi live streaming tercatat
              </div>
            </div>
          </div>

          {/* Quick KPI stats badge */}
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur border border-white/20 text-right">
              <div className="text-[10px] text-pink-200">Total GMV Anda</div>
              <div className="text-xs font-bold text-emerald-300">{formatRupiah(totalGMV)}</div>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur border border-white/20 text-right">
              <div className="text-[10px] text-pink-200">Total Live</div>
              <div className="text-xs font-bold text-white">{totalJam} Jam</div>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/70 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('input')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'input'
                ? 'bg-white dark:bg-slate-900 text-pink-600 dark:text-pink-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Input Live Baru</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manage')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'manage'
                ? 'bg-white dark:bg-slate-900 text-pink-600 dark:text-pink-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <ListFilter className="h-3.5 w-3.5" />
            <span>Kelola Laporan ({reports.length})</span>
          </button>
        </div>

        {/* TAB 1: FORM INPUT */}
        {activeTab === 'input' && (
          <div className="space-y-4">
            <FormTikTok />
          </div>
        )}

        {/* TAB 2: MANAGE & CRUD LIVE REPORTS TABLE */}
        {activeTab === 'manage' && (
          <Card className="shadow-md border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Video className="h-4 w-4 text-pink-600" />
                    Daftar Semua Sesi Live Streaming Anda
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Kelola, perbaiki data sesi live (Edit), atau hapus laporan
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchHostData}
                    className="h-8 text-xs gap-1"
                  >
                    <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Filter Search */}
              <div className="pt-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Cari tanggal sesi live (contoh: 2026-10)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 text-xs h-8"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-pink-600" />
                  Memuat data laporan live...
                </div>
              ) : filteredReports.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  {searchQuery ? 'Tidak ada laporan yang sesuai pencarian.' : 'Belum ada data live streaming.'}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredReports.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">
                            📅 {item.tanggal}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-pink-50 text-pink-700 border-pink-200">
                            <Clock className="h-2.5 w-2.5 mr-1" /> {item.durasi_menit} Menit
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-300 font-bold">
                            GMV: {formatRupiah(item.gmv_rupiah)}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3 text-blue-500" /> {item.tayangan.toLocaleString('id-ID')} Tayangan
                          </span>
                          <span className="flex items-center gap-1">
                            <Activity className="h-3 w-3 text-purple-500" /> {item.impresi.toLocaleString('id-ID')} Impresi
                          </span>
                        </div>

                        {item.foto_bukti_url && (
                          <button
                            type="button"
                            onClick={() => setPreviewImage(item.foto_bukti_url || null)}
                            className="inline-flex items-center gap-1 text-[11px] text-pink-600 hover:underline pt-0.5"
                          >
                            <ImageIcon className="h-3 w-3" />
                            Lihat Screenshot Bukti WebP
                          </button>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditTarget(item)}
                          className="h-8 px-2.5 text-slate-600 hover:text-pink-600 hover:bg-pink-50 text-xs gap-1"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteTarget(item)}
                          className="h-8 px-2.5 text-slate-600 hover:text-red-600 hover:bg-red-50 text-xs gap-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Hapus</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Footer Info */}
        <div className="text-[11px] text-muted-foreground p-3.5 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-start gap-2">
          <Sparkles className="h-4 w-4 text-pink-500 shrink-0 mt-0.5" />
          <span>
            Screenshot GMV otomatis terkompresi di perangkat Anda ke format WebP untuk menghemat kuota seluler. Data live terhubung langsung ke dashboard Owner secara realtime.
          </span>
        </div>
      </main>

      {/* Floating AI Assistant Trigger & Modal */}
      <AiAssistantModal />

      {/* Edit TikTok Modal */}
      <EditTikTokModal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSuccess={fetchHostData}
        laporan={editTarget}
      />

      {/* Delete Confirm Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
        title="Hapus Laporan Live TikTok"
        description={`Apakah Anda yakin ingin menghapus laporan sesi live pada tanggal ${deleteTarget?.tanggal} (GMV: ${formatRupiah(deleteTarget?.gmv_rupiah || 0)})?`}
      />

      {/* Photo Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-lg w-full bg-slate-900 rounded-2xl overflow-hidden p-2" onClick={(e) => e.stopPropagation()}>
            <img src={previewImage} alt="Preview Screenshot GMV" className="w-full h-auto max-h-[80vh] object-contain rounded-xl" />
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-black/60 text-white hover:bg-black"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
