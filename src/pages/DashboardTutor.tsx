import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { LaporanBimbel, Murid } from '@/types'
import { FormBimbel } from '@/components/forms/FormBimbel'
import { EditBimbelModal } from '@/components/dashboard/EditBimbelModal'
import { AddMuridModal } from '@/components/dashboard/AddMuridModal'
import { DeleteConfirmModal } from '@/components/dashboard/DeleteConfirmModal'
import { PdfExportModal } from '@/components/dashboard/PdfExportModal'
import { AiAssistantModal } from '@/components/ai/AiAssistantModal'
import { setupMidnightHeartbeatWatcher } from '@/lib/heartbeat'
import { parsePhotoUrls, formatWhatsAppPhotoLinks } from '@/lib/photoUtils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  LogOut, 
  ShieldCheck, 
  User, 
  UserPlus,
  Smartphone,
  Sparkles,
  FileDown,
  Search,
  BookOpen,
  Edit,
  Trash2,
  Share2,
  RefreshCw,
  PlusCircle,
  ListFilter
} from 'lucide-react'

export const DashboardTutorPage: React.FC = () => {
  const { profile, user, signOut } = useAuth()

  // Tab State
  const [activeTab, setActiveTab] = useState<'input' | 'manage'>('input')

  // Data States
  const [reports, setReports] = useState<LaporanBimbel[]>([])
  const [muridList, setMuridList] = useState<Murid[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMapelFilter, setSelectedMapelFilter] = useState('all')
  const [realtimePulse, setRealtimePulse] = useState(false)

  // Modals
  const [editTarget, setEditTarget] = useState<LaporanBimbel | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LaporanBimbel | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false)
  const [isAddMuridOpen, setIsAddMuridOpen] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // Fetch Reports for Tutor
  const fetchTutorData = useCallback(async () => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      // 1. Fetch murid
      const { data: mData } = await supabase
        .from('murid')
        .select('*')
        .order('nama', { ascending: true })
      if (mData) setMuridList(mData as Murid[])

      // 2. Fetch tutor's reports
      let rData: any = null
      let rErr: any = null

      const firstAttempt = await supabase
        .from('laporan_bimbel')
        .select(`
          id,
          tutor_id,
          murid_id,
          tanggal,
          mata_pelajaran,
          topik,
          ringkasan,
          foto_kegiatan_url,
          created_at,
          murid:murid_id (
            nama,
            tingkat_kelas
          )
        `)
        .eq('tutor_id', user.id)
        .order('tanggal', { ascending: false })

      rData = firstAttempt.data
      rErr = firstAttempt.error

      if (rErr && rErr.message.includes('foto_kegiatan_url')) {
        const fallbackRes = await supabase
          .from('laporan_bimbel')
          .select(`
            id,
            tutor_id,
            murid_id,
            tanggal,
            mata_pelajaran,
            topik,
            ringkasan,
            created_at,
            murid:murid_id (
              nama,
              tingkat_kelas
            )
          `)
          .eq('tutor_id', user.id)
          .order('tanggal', { ascending: false })
        rData = fallbackRes.data
        rErr = fallbackRes.error
      }

      if (rErr) throw rErr
      if (rData) setReports(rData as unknown as LaporanBimbel[])
    } catch (err: any) {
      console.warn('Notice fetching tutor data:', err.message)
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchTutorData()
    const cleanupHeartbeat = setupMidnightHeartbeatWatcher()
    return () => {
      cleanupHeartbeat()
    }
  }, [fetchTutorData])

  // Realtime Supabase Subscription
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel('realtime_tutor_bimbel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'laporan_bimbel',
          filter: `tutor_id=eq.${user.id}`,
        },
        () => {
          setRealtimePulse(true)
          setTimeout(() => setRealtimePulse(false), 2000)
          fetchTutorData()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'murid',
        },
        () => {
          setRealtimePulse(true)
          setTimeout(() => setRealtimePulse(false), 2000)
          fetchTutorData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, fetchTutorData])

  // Delete Handler (Mendukung RPC fail-safe & Direct Delete)
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      let isSuccess = false

      // 1. Coba via RPC Security Definer terlebih dahulu (bypass RLS dengan validasi kepemilikan)
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('tutor_delete_laporan_bimbel', {
          p_id: deleteTarget.id,
        })
        if (!rpcErr && rpcRes && rpcRes.success) {
          isSuccess = true
        }
      } catch (e) {
        console.warn('RPC delete fallback to direct query:', e)
      }

      // 2. Jika belum berhasil lewat RPC, lakukan direct delete
      if (!isSuccess) {
        const { error: delErr } = await supabase
          .from('laporan_bimbel')
          .delete()
          .eq('id', deleteTarget.id)

        if (delErr) throw delErr
      }

      setDeleteTarget(null)
      await fetchTutorData()
    } catch (err: any) {
      console.error('Error deleting report:', err)
      alert(err.message || 'Gagal menghapus laporan.')
    } finally {
      setIsDeleting(false)
    }
  }

  // WhatsApp Share Helper (Format Bersih Tanpa Teks Bawah + Link Foto Dokumentasi)
  const shareToWhatsApp = (item: LaporanBimbel) => {
    const photoUrls = parsePhotoUrls(item.foto_kegiatan_url)
    const photoSection = formatWhatsAppPhotoLinks(photoUrls)

    const text = `*LAPORAN KEGIATAN BELAJAR - BIMBEL PADI TECH*

📅 *Tanggal Sesi:* ${item.tanggal}
👤 *Siswa:* ${item.murid?.nama || 'Murid'} ${item.murid?.tingkat_kelas ? `(${item.murid.tingkat_kelas})` : ''}
📚 *Mata Pelajaran:* ${item.mata_pelajaran}
🎯 *Topik / Materi:* ${item.topik}

📝 *Catatan & Evaluasi Pembelajaran:*
${item.ringkasan}${photoSection}`

    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
    window.open(waUrl, '_blank')
  }

  // Filtered Reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const matchSearch =
        (r.murid?.nama || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.mata_pelajaran || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.topik || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.ringkasan || '').toLowerCase().includes(searchQuery.toLowerCase())

      const matchMapel =
        selectedMapelFilter === 'all' || r.mata_pelajaran.toLowerCase() === selectedMapelFilter.toLowerCase()

      return matchSearch && matchMapel
    })
  }, [reports, searchQuery, selectedMapelFilter])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans pb-16">
      {/* Header */}
      <header className="sticky top-0 z-30 w-full border-b bg-white/90 dark:bg-slate-900/90 backdrop-blur">
        <div className="container mx-auto flex h-14 items-center justify-between px-4 max-w-4xl">
          <div className="flex items-center space-x-2.5">
            <img
              src="/logo.png"
              alt="Logo PADI TECH"
              className="h-8 w-8 object-contain rounded-lg drop-shadow-sm hover:scale-105 transition-transform"
            />
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
                <Smartphone className="h-2.5 w-2.5" /> Portal Operasional Tutor Bimbel
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-blue-600 border-blue-200 dark:border-blue-800 text-[10px] px-2 py-0.5 font-medium">
              Tutor
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
        {/* User Identity Greeting Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-900 text-white shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center text-white backdrop-blur border border-white/20">
              <User className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-blue-100 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-300" />
                Portal Operasional Bimbingan Belajar
              </div>
              <h2 className="text-base sm:text-lg font-bold truncate">
                {profile?.nama || user?.email?.split('@')[0]}
              </h2>
              <div className="text-[11px] text-blue-200">
                {reports.length} sesi mengajar tercatat di sistem
              </div>
            </div>
          </div>

          {/* Action Buttons: Tambah Murid & PDF Export */}
          <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              onClick={() => setIsAddMuridOpen(true)}
              className="bg-emerald-500/25 hover:bg-emerald-500/35 text-white border border-emerald-300/40 text-xs h-9 gap-1.5 backdrop-blur shadow-xs cursor-pointer w-full sm:w-auto justify-center"
              title="Input data murid / siswa baru"
            >
              <UserPlus className="h-3.5 w-3.5 text-emerald-300" />
              <span>+ Tambah Murid</span>
            </Button>
            <Button
              type="button"
              onClick={() => setIsPdfModalOpen(true)}
              className="bg-white/15 hover:bg-white/25 text-white border border-white/30 text-xs h-9 gap-1.5 backdrop-blur shadow-xs cursor-pointer w-full sm:w-auto justify-center"
            >
              <FileDown className="h-3.5 w-3.5 text-amber-300" />
              <span>Ekspor PDF Raport</span>
            </Button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 sm:flex items-center gap-1.5 sm:gap-2 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/70 w-full sm:w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('input')}
            className={`flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'input'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Input Sesi Baru</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manage')}
            className={`flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'manage'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
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
            <FormBimbel
              onReportCreated={fetchTutorData}
              onEditReport={(rep) => setEditTarget(rep)}
              onDeleteReport={(rep) => setDeleteTarget(rep)}
            />
          </div>
        )}

        {/* TAB 2: MANAGE & CRUD REPORTS TABLE */}
        {activeTab === 'manage' && (
          <Card className="shadow-md border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-blue-600" />
                    Daftar Semua Sesi Pembelajaran Anda
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Kelola, perbaiki data (Edit), hapus, atau bagikan laporan ke WhatsApp
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchTutorData}
                    className="h-8 text-xs gap-1"
                  >
                    <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="pt-3 flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Cari nama murid, mapel, topik..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 text-xs h-8"
                  />
                </div>
                <select
                  value={selectedMapelFilter}
                  onChange={(e) => setSelectedMapelFilter(e.target.value)}
                  className="h-8 rounded-md border border-input bg-transparent px-2.5 text-xs shadow-sm focus:outline-none dark:bg-slate-900"
                >
                  <option value="all">Semua Mata Pelajaran</option>
                  <option value="Matematika">Matematika</option>
                  <option value="Bahasa Inggris">Bahasa Inggris</option>
                  <option value="IPA (Sains)">IPA (Sains)</option>
                  <option value="IPS">IPS</option>
                  <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                  <option value="Calistung">Calistung</option>
                </select>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                  Memuat data laporan...
                </div>
              ) : filteredReports.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  {searchQuery ? 'Tidak ada laporan yang cocok dengan pencarian.' : 'Belum ada data sesi pembelajaran.'}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredReports.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-blue-500" />
                            {item.murid?.nama || 'Siswa'} ({item.murid?.tingkat_kelas || '-'})
                          </span>
                          <span className="text-[11px] text-muted-foreground font-medium">
                            • {item.tanggal}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200">
                            {item.mata_pelajaran}
                          </Badge>
                        </div>

                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {item.topik}
                        </div>

                        <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">
                          {item.ringkasan}
                        </p>

                        {(() => {
                          const photos = parsePhotoUrls(item.foto_kegiatan_url)
                          if (photos.length === 0) return null
                          return (
                            <div className="pt-1 flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] text-muted-foreground font-medium">
                                Dokumentasi ({photos.length}):
                              </span>
                              {photos.map((url, i) => (
                                <img
                                  key={i}
                                  src={url}
                                  alt={`Dokumentasi ${i + 1}`}
                                  className="h-8 w-8 rounded-md object-cover border border-slate-200 dark:border-slate-700 cursor-pointer shadow-xs hover:opacity-80 transition-opacity"
                                  onClick={() => setPreviewImage(url)}
                                  title="Klik untuk memperbesar"
                                />
                              ))}
                            </div>
                          )
                        })()}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => shareToWhatsApp(item)}
                          title="Bagikan ke WhatsApp Ortu"
                          className="h-8 px-2.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-xs gap-1 shadow-xs"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">WhatsApp</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditTarget(item)}
                          className="h-8 px-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 text-xs"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteTarget(item)}
                          className="h-8 px-2 text-slate-600 hover:text-red-600 hover:bg-red-50 text-xs"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
          <Sparkles className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <span>
            Setiap sesi yang Anda simpan langsung tersinkronisasi ke dashboard Owner dan database Supabase secara realtime. Gunakan tombol <strong>Ekspor PDF</strong> untuk membuat raport belajar siswa resmi.
          </span>
        </div>
      </main>

      {/* Floating AI Assistant Trigger & Modal */}
      <AiAssistantModal />

      {/* Edit Bimbel Modal */}
      <EditBimbelModal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSuccess={fetchTutorData}
        laporan={editTarget}
        muridList={muridList}
      />

      {/* Delete Confirm Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
        title="Hapus Laporan Bimbel"
        description={`Apakah Anda yakin ingin menghapus laporan sesi belajar untuk ${deleteTarget?.murid?.nama || 'murid ini'} pada tanggal ${deleteTarget?.tanggal}? Tindakan ini permanen.`}
      />

      {/* PDF Export Modal */}
      <PdfExportModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        allBimbelReports={reports}
        muridList={muridList}
      />

      {/* Add Murid Modal */}
      <AddMuridModal
        isOpen={isAddMuridOpen}
        onClose={() => setIsAddMuridOpen(false)}
        onSuccess={() => fetchTutorData()}
      />

      {/* Photo Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-lg w-full bg-slate-900 rounded-2xl overflow-hidden p-2" onClick={(e) => e.stopPropagation()}>
            <img src={previewImage} alt="Preview Foto" className="w-full h-auto max-h-[80vh] object-contain rounded-xl" />
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
