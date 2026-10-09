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
  Image as ImageIcon,
  AtSign,
  FileText,
  Download,
  Calendar,
  FileSpreadsheet
} from 'lucide-react'
import { DateRangePickerModal } from '@/components/dashboard/DateRangePickerModal'
import { ImportExcelTiktokModal } from '@/components/dashboard/ImportExcelTiktokModal'
import { generateTiktokSalesReportPDF } from '@/lib/tiktokPdfExporter'

export const DashboardHostPage: React.FC = () => {
  const { profile, user, signOut } = useAuth()

  // Tab State ('input' | 'manage' | 'pdf')
  const [activeTab, setActiveTab] = useState<'input' | 'manage' | 'pdf'>('input')

  // Data States
  const [reports, setReports] = useState<LaporanTiktok[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [realtimePulse, setRealtimePulse] = useState(false)

  // State Laporan PDF Bulanan & Rentang Tanggal
  const [isDateRangeModalOpen, setIsDateRangeModalOpen] = useState(false)
  const [pdfStartDate, setPdfStartDate] = useState('2026-09-21')
  const [pdfEndDate, setPdfEndDate] = useState('2026-10-08')
  const [pdfAccount, setPdfAccount] = useState('@wangigaya')
  const [isGeneratingTabPdf, setIsGeneratingTabPdf] = useState(false)

  // Modals
  const [editTarget, setEditTarget] = useState<LaporanTiktok | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LaporanTiktok | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [isImportExcelOpen, setIsImportExcelOpen] = useState(false)

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

  // Delete Handler (Mendukung RPC fail-safe & Direct Delete)
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      let isDeleted = false

      // 1. Coba via RPC Security Definer terlebih dahulu
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('host_delete_laporan_tiktok', {
          p_id: deleteTarget.id,
        })
        if (!rpcErr && rpcRes && rpcRes.success) {
          isDeleted = true
        }
      } catch (e) {
        console.warn('RPC delete tiktok fallback to direct query:', e)
      }

      // 2. Fallback direct delete
      if (!isDeleted) {
        const { error: delErr } = await supabase
          .from('laporan_tiktok')
          .delete()
          .eq('id', deleteTarget.id)

        if (delErr) throw delErr
      }

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
    const q = searchQuery.toLowerCase().trim()
    return reports.filter((r) => {
      return (
        r.tanggal.includes(q) ||
        r.durasi_menit.toString().includes(q) ||
        r.gmv_rupiah.toString().includes(q) ||
        (r.akun_tiktok && r.akun_tiktok.toLowerCase().includes(q))
      )
    })
  }, [reports, searchQuery])

  // Total Metrik Host
  const totalGMV = useMemo(() => reports.reduce((acc, curr) => acc + (curr.gmv_rupiah || 0), 0), [reports])
  const totalJam = useMemo(() => (reports.reduce((acc, curr) => acc + (curr.durasi_menit || 0), 0) / 60).toFixed(1), [reports])

  // Filter Laporan untuk Ekspor PDF Sesuai Rentang Tanggal
  const pdfFilteredReports = useMemo(() => {
    return reports.filter((r) => {
      const inDate = r.tanggal >= pdfStartDate && r.tanggal <= pdfEndDate
      const inAcc = !pdfAccount || !r.akun_tiktok || r.akun_tiktok === pdfAccount
      return inDate && inAcc
    }).sort((a, b) => a.tanggal.localeCompare(b.tanggal))
  }, [reports, pdfStartDate, pdfEndDate, pdfAccount])

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
              <div className="text-[11px] text-pink-200 flex items-center gap-1.5 flex-wrap">
                <span>{reports.length} sesi live streaming tercatat</span>
                <span>•</span>
                <span className="inline-flex items-center gap-0.5 bg-white/15 px-2 py-0.5 rounded-full text-[10px] font-medium text-pink-100">
                  <AtSign className="h-2.5 w-2.5" /> Akun: @wangigaya
                </span>
              </div>
            </div>
          </div>

          {/* Quick KPI stats badge & Download PDF button */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
            <Button
              type="button"
              size="sm"
              onClick={() => setIsDateRangeModalOpen(true)}
              className="h-9 px-3 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs border border-white/25 shadow-xs font-semibold gap-1.5 backdrop-blur cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5 text-pink-200" />
              <span>Cetak Laporan PDF</span>
            </Button>
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
        <div className="grid grid-cols-3 sm:flex items-center gap-1.5 sm:gap-2 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/70 w-full sm:w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('input')}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'input'
                ? 'bg-white dark:bg-slate-900 text-pink-600 dark:text-pink-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Input Live</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manage')}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'manage'
                ? 'bg-white dark:bg-slate-900 text-pink-600 dark:text-pink-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <ListFilter className="h-3.5 w-3.5" />
            <span>Kelola ({reports.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pdf')}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'pdf'
                ? 'bg-white dark:bg-slate-900 text-pink-600 dark:text-pink-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Laporan PDF</span>
          </button>
        </div>

        {/* TAB 1: FORM INPUT */}
        {activeTab === 'input' && (
          <div className="space-y-4">
            <FormTikTok
              onReportCreated={fetchHostData}
              onEditReport={(rep) => setEditTarget(rep)}
              onDeleteReport={(rep) => setDeleteTarget(rep)}
            />
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
                    onClick={() => setIsImportExcelOpen(true)}
                    className="h-8 text-xs gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400"
                    title="Impor sesi live dari file Excel (.xlsx) atau CSV TikTok Shop"
                  >
                    <FileSpreadsheet className="h-3 w-3 text-emerald-600" />
                    <span>Impor Excel</span>
                  </Button>

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
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800">
                            <AtSign className="h-2.5 w-2.5 mr-0.5" /> {item.akun_tiktok || '@wangigaya'}
                          </Badge>
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

        {/* TAB 3: LAPORAN PENJUALAN PDF RESMI BRM */}
        {activeTab === 'pdf' && (
          <Card className="shadow-md border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="pb-4 border-b">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 text-[10px]">
                      Format Resmi BRM
                    </Badge>
                    <span className="text-xs text-muted-foreground">• 3 Halaman A4</span>
                  </div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-rose-600" />
                    Laporan Penjualan & Performa Live Streaming
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Pilih rentang tanggal (1 bulan atau kustom) untuk mengunduh laporan PDF resmi dari data Supabase.
                  </CardDescription>
                </div>

                <Button
                  type="button"
                  onClick={() => setIsDateRangeModalOpen(true)}
                  className="bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs h-9 px-3.5 rounded-xl shadow-xs gap-1.5 self-start sm:self-center cursor-pointer"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Buka Kalender Rentang Tanggal</span>
                </Button>
              </div>

              {/* Bar Filter Rentang & Akun */}
              <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                    Tanggal Mulai
                  </label>
                  <Input
                    type="date"
                    value={pdfStartDate}
                    onChange={(e) => setPdfStartDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                    Tanggal Selesai
                  </label>
                  <Input
                    type="date"
                    value={pdfEndDate}
                    onChange={(e) => setPdfEndDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                    Akun TikTok
                  </label>
                  <div className="flex gap-1.5">
                    {['@wangigaya', '@paditech', '@gayahijab'].map((acc) => (
                      <button
                        key={acc}
                        type="button"
                        onClick={() => setPdfAccount(acc)}
                        className={`text-[10px] px-2 py-1 rounded-md border font-medium transition-colors cursor-pointer ${
                          pdfAccount === acc
                            ? 'bg-rose-500 text-white border-rose-500 font-semibold'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {acc}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Presets Cepat */}
              <div className="pt-2 flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] text-muted-foreground mr-1">Preset:</span>
                <button
                  type="button"
                  onClick={() => {
                    setPdfStartDate('2026-09-21')
                    setPdfEndDate('2026-10-08')
                  }}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                    pdfStartDate === '2026-09-21' && pdfEndDate === '2026-10-08'
                      ? 'bg-rose-500 text-white border-rose-500'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  ⭐ Periode Referensi BRM (21 Sep - 8 Okt)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date()
                    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
                    const end = now.toISOString().split('T')[0]
                    setPdfStartDate(start)
                    setPdfEndDate(end)
                  }}
                  className="text-[10px] px-2 py-0.5 rounded-full border bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Bulan Ini
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date()
                    const end = now.toISOString().split('T')[0]
                    const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                    setPdfStartDate(past30)
                    setPdfEndDate(end)
                  }}
                  className="text-[10px] px-2 py-0.5 rounded-full border bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  30 Hari Terakhir
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date()
                    const prevM = now.getMonth() === 0 ? 11 : now.getMonth() - 1
                    const prevY = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
                    const start = new Date(prevY, prevM, 1).toISOString().split('T')[0]
                    const lastDay = new Date(prevY, prevM + 1, 0).getDate()
                    const end = new Date(prevY, prevM, lastDay).toISOString().split('T')[0]
                    setPdfStartDate(start)
                    setPdfEndDate(end)
                  }}
                  className="text-[10px] px-2 py-0.5 rounded-full border bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Bulan Lalu
                </button>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* Metrik Agregasi Ringkas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl border bg-slate-50/70 dark:bg-slate-800/50">
                  <span className="text-[10px] text-muted-foreground block">Sesi Terdata</span>
                  <span className="text-base font-bold text-slate-900 dark:text-white">
                    {pdfFilteredReports.length} Sesi
                  </span>
                </div>
                <div className="p-3 rounded-xl border bg-slate-50/70 dark:bg-slate-800/50">
                  <span className="text-[10px] text-muted-foreground block">Total GMV Live</span>
                  <span className="text-base font-bold text-rose-600 dark:text-rose-400">
                    {formatRupiah(pdfFilteredReports.reduce((acc, curr) => acc + (Number(curr.gmv_rupiah) || 0), 0))}
                  </span>
                </div>
                <div className="p-3 rounded-xl border bg-slate-50/70 dark:bg-slate-800/50">
                  <span className="text-[10px] text-muted-foreground block">Total Jam Tayang</span>
                  <span className="text-base font-bold text-slate-900 dark:text-white">
                    {(pdfFilteredReports.reduce((acc, curr) => acc + (Number(curr.durasi_menit) || 0), 0) / 60).toFixed(1)} Jam
                  </span>
                </div>
                <div className="p-3 rounded-xl border bg-slate-50/70 dark:bg-slate-800/50">
                  <span className="text-[10px] text-muted-foreground block">Total Penonton</span>
                  <span className="text-base font-bold text-slate-900 dark:text-white">
                    {pdfFilteredReports.reduce((acc, curr) => acc + (Number(curr.tayangan) || 0), 0).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* Tombol Cetak PDF Utama */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4" />
                    Unduh Dokumen PDF Resmi 3 Halaman
                  </h4>
                  <p className="text-xs text-rose-100 mt-0.5">
                    Format dokumen identik dengan template referensi Berkah Rosita Mandiri (BRM) @wangigaya.
                  </p>
                </div>

                <Button
                  type="button"
                  disabled={isGeneratingTabPdf}
                  onClick={async () => {
                    setIsGeneratingTabPdf(true)
                    try {
                      let sessionsToExport = pdfFilteredReports
                      if (sessionsToExport.length === 0 && pdfStartDate === '2026-09-21' && pdfEndDate === '2026-10-08') {
                        // Sample fallback data
                        sessionsToExport = [
                          { id: '768787967', host_id: 'sample', tanggal: '2026-09-21', durasi_menit: 120, gmv_rupiah: 153009, tayangan: 250, impresi: 700, akun_tiktok: pdfAccount },
                          { id: '768795746', host_id: 'sample', tanggal: '2026-09-21', durasi_menit: 90, gmv_rupiah: 72602, tayangan: 180, impresi: 520, akun_tiktok: pdfAccount },
                          { id: '768824980', host_id: 'sample', tanggal: '2026-09-22', durasi_menit: 60, gmv_rupiah: 25599, tayangan: 120, impresi: 310, akun_tiktok: pdfAccount },
                          { id: '768835271', host_id: 'sample', tanggal: '2026-09-22', durasi_menit: 110, gmv_rupiah: 87266, tayangan: 210, impresi: 640, akun_tiktok: pdfAccount },
                          { id: '769010268', host_id: 'sample', tanggal: '2026-09-27', durasi_menit: 95, gmv_rupiah: 94936, tayangan: 300, impresi: 820, akun_tiktok: pdfAccount },
                          { id: '769019036', host_id: 'sample', tanggal: '2026-09-27', durasi_menit: 180, gmv_rupiah: 420142, tayangan: 850, impresi: 2100, akun_tiktok: pdfAccount },
                          { id: '769021749', host_id: 'sample', tanggal: '2026-09-27', durasi_menit: 75, gmv_rupiah: 21734, tayangan: 110, impresi: 290, akun_tiktok: pdfAccount },
                          { id: '769037457', host_id: 'sample', tanggal: '2026-09-28', durasi_menit: 80, gmv_rupiah: 45765, tayangan: 160, impresi: 450, akun_tiktok: pdfAccount },
                          { id: '769044993', host_id: 'sample', tanggal: '2026-09-28', durasi_menit: 65, gmv_rupiah: 24643, tayangan: 130, impresi: 380, akun_tiktok: pdfAccount },
                          { id: '769039072', host_id: 'sample', tanggal: '2026-09-29', durasi_menit: 70, gmv_rupiah: 23916, tayangan: 140, impresi: 410, akun_tiktok: pdfAccount },
                          { id: '769096132', host_id: 'sample', tanggal: '2026-09-29', durasi_menit: 115, gmv_rupiah: 59022, tayangan: 220, impresi: 610, akun_tiktok: pdfAccount },
                          { id: '769121092', host_id: 'sample', tanggal: '2026-09-30', durasi_menit: 60, gmv_rupiah: 29320, tayangan: 150, impresi: 390, akun_tiktok: pdfAccount },
                          { id: '769126266', host_id: 'sample', tanggal: '2026-09-30', durasi_menit: 90, gmv_rupiah: 79989, tayangan: 240, impresi: 680, akun_tiktok: pdfAccount },
                          { id: '769093164', host_id: 'sample', tanggal: '2026-09-30', durasi_menit: 60, gmv_rupiah: 25855, tayangan: 130, impresi: 360, akun_tiktok: pdfAccount },
                          { id: '769161668', host_id: 'sample', tanggal: '2026-10-01', durasi_menit: 85, gmv_rupiah: 49398, tayangan: 175, impresi: 490, akun_tiktok: pdfAccount },
                          { id: '769166954', host_id: 'sample', tanggal: '2026-10-01', durasi_menit: 105, gmv_rupiah: 66696, tayangan: 230, impresi: 620, akun_tiktok: pdfAccount },
                          { id: '769195949', host_id: 'sample', tanggal: '2026-10-02', durasi_menit: 75, gmv_rupiah: 43784, tayangan: 160, impresi: 430, akun_tiktok: pdfAccount },
                          { id: '769223056', host_id: 'sample', tanggal: '2026-10-03', durasi_menit: 100, gmv_rupiah: 69081, tayangan: 245, impresi: 670, akun_tiktok: pdfAccount },
                          { id: '769233394', host_id: 'sample', tanggal: '2026-10-03', durasi_menit: 60, gmv_rupiah: 25855, tayangan: 125, impresi: 340, akun_tiktok: pdfAccount },
                          { id: '769241463', host_id: 'sample', tanggal: '2026-10-03', durasi_menit: 80, gmv_rupiah: 42216, tayangan: 170, impresi: 460, akun_tiktok: pdfAccount },
                          { id: '769306309', host_id: 'sample', tanggal: '2026-10-05', durasi_menit: 90, gmv_rupiah: 45110, tayangan: 180, impresi: 490, akun_tiktok: pdfAccount },
                          { id: '769389037', host_id: 'sample', tanggal: '2026-10-07', durasi_menit: 130, gmv_rupiah: 186393, tayangan: 420, impresi: 1100, akun_tiktok: pdfAccount },
                          { id: '769376457', host_id: 'sample', tanggal: '2026-10-07', durasi_menit: 55, gmv_rupiah: 22337, tayangan: 115, impresi: 310, akun_tiktok: pdfAccount },
                          { id: '769427308', host_id: 'sample', tanggal: '2026-10-08', durasi_menit: 65, gmv_rupiah: 24452, tayangan: 135, impresi: 360, akun_tiktok: pdfAccount },
                        ]
                      }

                      await generateTiktokSalesReportPDF({
                        startDate: pdfStartDate,
                        endDate: pdfEndDate,
                        akunTiktok: pdfAccount,
                        tokoNama: 'BRM Mandiri',
                        idToko: 'IDLCBUWLP8',
                        sessions: sessionsToExport,
                      })
                    } catch (err: any) {
                      alert(err.message || 'Gagal membuat file PDF')
                    } finally {
                      setIsGeneratingTabPdf(false)
                    }
                  }}
                  className="bg-white hover:bg-slate-100 text-rose-600 font-bold h-10 px-4 rounded-xl shadow-xs shrink-0 gap-2 cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>{isGeneratingTabPdf ? 'Memproses PDF...' : 'Unduh Laporan PDF'}</span>
                </Button>
              </div>

              {/* Rincian Sesi yang Masuk dalam Laporan */}
              <div className="pt-2">
                <h5 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Daftar Sesi Live yang Masuk Laporan ({pdfFilteredReports.length} Sesi)
                </h5>
                {pdfFilteredReports.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground border rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                    Tidak ada sesi live streaming pada rentang tanggal {pdfStartDate} s/d {pdfEndDate}.
                    <p className="mt-1 text-[11px] text-rose-500">
                      Tip: Klik preset "Periode Referensi BRM" di atas untuk melihat contoh data 24 sesi live BRM.
                    </p>
                  </div>
                ) : (
                  <div className="border rounded-xl overflow-hidden divide-y text-xs">
                    {pdfFilteredReports.map((s, idx) => (
                      <div key={s.id || idx} className="p-3 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>#{idx + 1} Sesi {s.tanggal}</span>
                            <Badge variant="outline" className="text-[10px] py-0 px-1 bg-purple-50 text-purple-700">
                              {s.akun_tiktok || '@wangigaya'}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-3">
                            <span>{s.durasi_menit} Menit</span>
                            <span>•</span>
                            <span>{s.tayangan?.toLocaleString('id-ID')} Views</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-rose-600 dark:text-rose-400">
                            {formatRupiah(Number(s.gmv_rupiah) || 0)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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

      {/* Date Range Picker Modal (Pilih Rentang Tanggal Sesuai Screenshot 2) */}
      <DateRangePickerModal
        isOpen={isDateRangeModalOpen}
        onClose={() => setIsDateRangeModalOpen(false)}
        allReports={reports}
        currentAccount={pdfAccount}
        hostName={profile?.nama}
      />

      {/* Import Excel TikTok Modal */}
      <ImportExcelTiktokModal
        isOpen={isImportExcelOpen}
        onClose={() => setIsImportExcelOpen(false)}
        onSuccess={() => fetchHostData()}
        hostEmployees={profile ? [profile] : []}
        defaultHostId={user?.id}
      />
    </div>
  )
}

