import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { LaporanBimbel, LaporanTiktok, Murid, UserProfile } from '@/types'
import { exportBimbelToCSV, exportTikTokToCSV } from '@/lib/csvExporter'
import { generateStudentReportPDF } from '@/lib/pdfExporter'
import { PdfExportModal } from '@/components/dashboard/PdfExportModal'
import { AddEmployeeModal } from '@/components/dashboard/AddEmployeeModal'
import { EditEmployeeModal } from '@/components/dashboard/EditEmployeeModal'
import { ResetPasswordModal } from '@/components/dashboard/ResetPasswordModal'
import { EditBimbelModal } from '@/components/dashboard/EditBimbelModal'
import { EditTikTokModal } from '@/components/dashboard/EditTikTokModal'
import { AddMuridModal } from '@/components/dashboard/AddMuridModal'
import { EditMuridModal } from '@/components/dashboard/EditMuridModal'
import { DeleteConfirmModal } from '@/components/dashboard/DeleteConfirmModal'
import { AiAssistantModal } from '@/components/ai/AiAssistantModal'
import { setupMidnightHeartbeatWatcher } from '@/lib/heartbeat'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts'
import {
  LogOut,
  TrendingUp,
  GraduationCap,
  Video,
  FileDown,
  Search,
  Eye,
  RefreshCw,
  Clock,
  Sparkles,
  Zap,
  Image as ImageIcon,
  Layers,
  Users,
  UserPlus,
  KeyRound,
  UserCheck,
  Edit,
  Trash2,
  BookOpen,
  Plus,
  Mail
} from 'lucide-react'

const CHART_COLORS = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4']

export const DashboardPage: React.FC = () => {
  const { profile, user, signOut } = useAuth()

  // Data States
  const [bimbelList, setBimbelList] = useState<LaporanBimbel[]>([])
  const [tiktokList, setTiktokList] = useState<LaporanTiktok[]>([])
  const [muridList, setMuridList] = useState<Murid[]>([])
  const [employeeList, setEmployeeList] = useState<UserProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [realtimePulse, setRealtimePulse] = useState(false)

  // Filter States
  const [activeTab, setActiveTab] = useState<'overview' | 'bimbel' | 'tiktok' | 'karyawan' | 'murid'>('overview')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [filterMurid, setFilterMurid] = useState<string>('all')
  const [filterHost, setFilterHost] = useState<string>('all')

  // Modal States - Employee
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false)
  const [editEmployeeTarget, setEditEmployeeTarget] = useState<UserProfile | null>(null)
  const [resetEmployeeTarget, setResetEmployeeTarget] = useState<UserProfile | null>(null)

  // Modal States - Bimbel & TikTok
  const [editBimbelTarget, setEditBimbelTarget] = useState<LaporanBimbel | null>(null)
  const [editTiktokTarget, setEditTiktokTarget] = useState<LaporanTiktok | null>(null)

  // Modal States - Murid
  const [isAddMuridOpen, setIsAddMuridOpen] = useState(false)
  const [editMuridTarget, setEditMuridTarget] = useState<Murid | null>(null)

  // Modal States - Delete Confirm
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'employee' | 'bimbel' | 'tiktok' | 'murid'
    id: string
    name: string
    title: string
    desc: string
  } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Modal States - PDF & Photo Proof
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false)
  const [preselectedMuridId, setPreselectedMuridId] = useState<string | undefined>(undefined)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // 1. Fetch All Data
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      // Fetch Bimbel Reports
      let bimbelData: any = null
      let bimbelError: any = null

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
          tutor:tutor_id ( nama ),
          murid:murid_id ( nama, tingkat_kelas )
        `)
        .order('tanggal', { ascending: false })

      bimbelData = firstAttempt.data
      bimbelError = firstAttempt.error

      if (bimbelError && bimbelError.message.includes('foto_kegiatan_url')) {
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
            tutor:tutor_id ( nama ),
            murid:murid_id ( nama, tingkat_kelas )
          `)
          .order('tanggal', { ascending: false })
        bimbelData = fallbackRes.data
        bimbelError = fallbackRes.error
      }

      if (bimbelError) console.warn('Bimbel fetch warning:', bimbelError.message)
      if (bimbelData) setBimbelList(bimbelData as unknown as LaporanBimbel[])

      // Fetch TikTok Reports
      const { data: tiktokData, error: tiktokError } = await supabase
        .from('laporan_tiktok')
        .select(`
          id,
          host_id,
          tanggal,
          durasi_menit,
          gmv_rupiah,
          tayangan,
          impresi,
          foto_bukti_url,
          created_at,
          host:host_id ( nama )
        `)
        .order('tanggal', { ascending: false })

      if (tiktokError) console.warn('TikTok fetch warning:', tiktokError.message)
      if (tiktokData) setTiktokList(tiktokData as unknown as LaporanTiktok[])

      // Fetch Murid List
      const { data: muridData, error: muridError } = await supabase
        .from('murid')
        .select('*')
        .order('nama', { ascending: true })

      if (muridError) console.warn('Murid fetch warning:', muridError.message)
      if (muridData) setMuridList(muridData as Murid[])

      // Fetch All Employees (Users Profile)
      const { data: empData, error: empError } = await supabase
        .from('users_profile')
        .select('*')
        .order('created_at', { ascending: false })

      if (empError) console.warn('Employee fetch warning:', empError.message)
      if (empData) setEmployeeList(empData as UserProfile[])
    } catch (err) {
      console.error('Error loading dashboard data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 2. Realtime WebSocket Listener (Zero-Compute Realtime Sync on 4 Tables)
  useEffect(() => {
    fetchData()
    const cleanupHeartbeat = setupMidnightHeartbeatWatcher()

    const channel = supabase
      .channel('realtime_owner_full_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'laporan_bimbel' }, () => {
        setRealtimePulse(true)
        setTimeout(() => setRealtimePulse(false), 2500)
        fetchData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'laporan_tiktok' }, () => {
        setRealtimePulse(true)
        setTimeout(() => setRealtimePulse(false), 2500)
        fetchData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users_profile' }, () => {
        setRealtimePulse(true)
        setTimeout(() => setRealtimePulse(false), 2500)
        fetchData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'murid' }, () => {
        setRealtimePulse(true)
        setTimeout(() => setRealtimePulse(false), 2500)
        fetchData()
      })
      .subscribe()

    return () => {
      cleanupHeartbeat()
      supabase.removeChannel(channel)
    }
  }, [fetchData])

  // 3. Confirm Delete Handler
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)

    try {
      if (deleteTarget.type === 'employee') {
        if (deleteTarget.id === user?.id) {
          alert('Anda tidak dapat menghapus akun Owner yang sedang Anda gunakan!')
          setIsDeleting(false)
          return
        }

        // Coba via RPC untuk cascade bersih
        const { error: rpcErr } = await supabase.rpc('owner_delete_employee', {
          p_user_id: deleteTarget.id,
        })

        if (rpcErr) {
          // Fallback direct delete dari users_profile
          const { error: directErr } = await supabase
            .from('users_profile')
            .delete()
            .eq('id', deleteTarget.id)

          if (directErr) throw directErr
        }
      } else if (deleteTarget.type === 'bimbel') {
        const { error } = await supabase.from('laporan_bimbel').delete().eq('id', deleteTarget.id)
        if (error) throw error
      } else if (deleteTarget.type === 'tiktok') {
        const { error } = await supabase.from('laporan_tiktok').delete().eq('id', deleteTarget.id)
        if (error) throw error
      } else if (deleteTarget.type === 'murid') {
        const { error } = await supabase.from('murid').delete().eq('id', deleteTarget.id)
        if (error) throw error
      }

      await fetchData()
      setDeleteTarget(null)
    } catch (err: any) {
      console.error('Delete error:', err)
      alert(err.message || 'Gagal menghapus data. Periksa relasi data terkait.')
    } finally {
      setIsDeleting(false)
    }
  }

  // 4. Computed Filtered Lists
  const filteredBimbel = useMemo(() => {
    return bimbelList.filter((item) => {
      const matchMonth = selectedMonth ? item.tanggal.startsWith(selectedMonth) : true
      const matchMurid = filterMurid !== 'all' ? item.murid_id === filterMurid : true
      const matchSearch = searchQuery
        ? (item.murid?.nama?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           item.mata_pelajaran?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           item.topik?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           item.tutor?.nama?.toLowerCase().includes(searchQuery.toLowerCase()))
        : true
      return matchMonth && matchMurid && matchSearch
    })
  }, [bimbelList, selectedMonth, filterMurid, searchQuery])

  const filteredTiktok = useMemo(() => {
    return tiktokList.filter((item) => {
      const matchMonth = selectedMonth ? item.tanggal.startsWith(selectedMonth) : true
      const matchHost = filterHost !== 'all' ? item.host_id === filterHost : true
      const matchSearch = searchQuery
        ? (item.host?.nama?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           item.tanggal?.includes(searchQuery))
        : true
      return matchMonth && matchHost && matchSearch
    })
  }, [tiktokList, selectedMonth, filterHost, searchQuery])

  const filteredEmployees = useMemo(() => {
    return employeeList.filter((emp) => {
      if (!searchQuery) return true
      return (
        emp.nama?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.role?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })
  }, [employeeList, searchQuery])

  const filteredMurid = useMemo(() => {
    return muridList.filter((m) => {
      if (!searchQuery) return true
      return (
        m.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.tingkat_kelas.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })
  }, [muridList, searchQuery])

  // KPIs
  const totalGMV = useMemo(() => {
    return filteredTiktok.reduce((acc, curr) => acc + Number(curr.gmv_rupiah || 0), 0)
  }, [filteredTiktok])

  const totalDurasiMenit = useMemo(() => {
    return filteredTiktok.reduce((acc, curr) => acc + Number(curr.durasi_menit || 0), 0)
  }, [filteredTiktok])

  const totalSesiBimbel = filteredBimbel.length

  // Chart Data
  const gmvChartData = useMemo(() => {
    const map = new Map<string, number>()
    const sorted = [...filteredTiktok].sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())
    sorted.forEach((item) => {
      map.set(item.tanggal, (map.get(item.tanggal) || 0) + Number(item.gmv_rupiah || 0))
    })
    return Array.from(map.entries()).map(([tanggal, gmv]) => ({
      tanggal: tanggal.slice(5),
      gmv,
    }))
  }, [filteredTiktok])

  const subjectChartData = useMemo(() => {
    const map = new Map<string, number>()
    filteredBimbel.forEach((item) => {
      const subject = item.mata_pelajaran || 'Lainnya'
      map.set(subject, (map.get(subject) || 0) + 1)
    })
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [filteredBimbel])

  const hostChartData = useMemo(() => {
    const map = new Map<string, number>()
    filteredTiktok.forEach((item) => {
      const host = item.host?.nama || 'Host'
      map.set(host, (map.get(host) || 0) + Number(item.gmv_rupiah || 0))
    })
    return Array.from(map.entries()).map(([name, gmv]) => ({ name, gmv }))
  }, [filteredTiktok])

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val)
  }

  // Quick Single Student PDF Export
  const handleQuickStudentPdf = (item: LaporanBimbel) => {
    const studentMurid = muridList.find((m) => m.id === item.murid_id)
    const studentName = item.murid?.nama || studentMurid?.nama || 'Siswa'
    const studentClass = item.murid?.tingkat_kelas || studentMurid?.tingkat_kelas || 'Kelas'
    
    const itemMonth = item.tanggal.slice(0, 7)
    const studentSessions = bimbelList.filter(
      (b) => b.murid_id === item.murid_id && b.tanggal.startsWith(itemMonth)
    ).sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())

    const [year, month] = itemMonth.split('-')
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ]
    const mIdx = parseInt(month, 10) - 1
    const monthLabel = `${months[mIdx] || month} ${year}`

    generateStudentReportPDF({
      namaSiswa: studentName,
      kelas: studentClass,
      tutorNama: item.tutor?.nama || 'Tutor Bimbel',
      periodeBulan: monthLabel,
      sesiList: studentSessions.length > 0 ? studentSessions : [item],
    })
  }

  const distinctHosts = useMemo(() => {
    const hostsMap = new Map<string, string>()
    tiktokList.forEach((t) => {
      if (t.host_id && t.host?.nama) {
        hostsMap.set(t.host_id, t.host.nama)
      }
    })
    return Array.from(hostsMap.entries()).map(([id, nama]) => ({ id, nama }))
  }, [tiktokList])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-30 w-full border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-8">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
              HP
            </div>
            <div>
              <div className="text-base font-bold tracking-tight">HRIS PADI TECH</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span className="hidden sm:inline">Owner Executive Portal •</span>
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className={`h-2 w-2 rounded-full ${realtimePulse ? 'bg-emerald-400 animate-ping' : 'bg-emerald-500'}`} />
                  Realtime WebSocket Active
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData()}
              disabled={isLoading}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-blue-500' : ''}`} />
              Refresh
            </Button>
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs font-semibold">{profile?.nama || user?.email}</span>
              <span className="text-[11px] text-muted-foreground capitalize">Owner (Full RLS & CRUD)</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut()}
              className="gap-1 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 container mx-auto px-4 sm:px-8 py-6 max-w-7xl space-y-6">
        {/* Realtime Alert Banner on Push */}
        {realtimePulse && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-2 shadow-sm">
            <Sparkles className="h-4 w-4 text-emerald-500 animate-bounce" />
            <span className="font-semibold">Sinkronisasi Realtime Supabase Aktif:</span> Data berhasil diperbarui otomatis secara instan tanpa reload!
          </div>
        )}

        {/* Top Control Bar: Filters & Quick Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
              <Clock className="h-3.5 w-3.5" />
              <span>Periode:</span>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-8 w-36 text-xs"
              />
              {selectedMonth && (
                <button
                  onClick={() => setSelectedMonth('')}
                  className="text-[11px] text-blue-600 hover:underline"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Cari data, murid, tutor, host..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs w-48 sm:w-64"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setIsAddEmployeeOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 text-xs shadow-md shadow-indigo-500/20"
            >
              <UserPlus className="h-4 w-4" />
              <span>+ Daftarkan Karyawan</span>
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setPreselectedMuridId(undefined)
                setIsPdfModalOpen(true)
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs shadow-md shadow-blue-500/20"
            >
              <FileDown className="h-4 w-4" />
              <span>Generate PDF Siswa</span>
            </Button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover:shadow-md transition-shadow border-slate-200 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground">
                Total GMV TikTok Live
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-pink-100 dark:bg-pink-950 flex items-center justify-center text-pink-600 dark:text-pink-400">
                <TrendingUp className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold text-pink-600 dark:text-pink-400">
                {formatRupiah(totalGMV)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <Zap className="h-3 w-3 text-yellow-500" /> Dari {filteredTiktok.length} sesi live streaming
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow border-slate-200 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground">
                Total Sesi Bimbingan Belajar
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <GraduationCap className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
                {totalSesiBimbel} Sesi
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Terdistribusi pada {muridList.length} siswa binaan
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow border-slate-200 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground">
                Total Jam Siaran Live
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-950 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Video className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">
                {(totalDurasiMenit / 60).toFixed(1)} Jam
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Setara dengan {totalDurasiMenit.toLocaleString('id-ID')} menit siaran
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow border-slate-200 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground">
                Total Karyawan Aktif
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Users className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
                {employeeList.length} Karyawan
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Owner, Tutor Bimbel & Host TikTok Live
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tab Navigation (5 Tabs: Overview, Bimbel, TikTok, Karyawan, Murid) */}
        <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-2.5 px-3 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Grafik & Visualisasi</span>
          </button>

          <button
            onClick={() => setActiveTab('bimbel')}
            className={`pb-2.5 px-3 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'bimbel'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <GraduationCap className="h-4 w-4" />
            <span>Data Laporan Bimbel ({filteredBimbel.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('tiktok')}
            className={`pb-2.5 px-3 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'tiktok'
                ? 'border-pink-600 text-pink-600 dark:text-pink-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Video className="h-4 w-4" />
            <span>Data Laporan TikTok ({filteredTiktok.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('karyawan')}
            className={`pb-2.5 px-3 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'karyawan'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>👥 Manajemen Karyawan ({employeeList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('murid')}
            className={`pb-2.5 px-3 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'murid'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span>🎓 Siswa Binaan ({muridList.length})</span>
          </button>
        </div>

        {/* TAB 1: OVERVIEW & CHARTS */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart 1: Tren GMV */}
              <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-pink-600" />
                      Tren GMV TikTok Live per Hari
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px]">
                      Recharts Area
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Pergerakan omset live commerce harian
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-64 pt-4">
                  {gmvChartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                      Belum ada data GMV pada filter ini.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={gmvChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorGmv" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="tanggal" fontSize={11} />
                        <YAxis
                          fontSize={11}
                          tickFormatter={(val) => `${(val / 1000000).toFixed(1)}M`}
                        />
                        <Tooltip
                          formatter={(value: any) => [formatRupiah(Number(value)), 'GMV']}
                          labelFormatter={(label) => `Tanggal: ${label}`}
                        />
                        <Area
                          type="monotone"
                          dataKey="gmv"
                          stroke="#ec4899"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorGmv)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Chart 2: Komposisi Mapel */}
              <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-blue-600" />
                      Komposisi Mata Pelajaran Bimbel
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px]">
                      Pie Distribution
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Persentase materi bimbingan yang diajarkan
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-64 pt-4">
                  {subjectChartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                      Belum ada data sesi bimbel pada filter ini.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={subjectChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                          fontSize={10}
                        >
                          {subjectChartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => [`${value} Sesi`, 'Jumlah']} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Chart 3: Performa Host TikTok */}
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Video className="h-4 w-4 text-purple-600" />
                    Kontribusi GMV per Host TikTok
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px]">
                    Bar Ranking
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Perbandingan total penjualan yang dihasilkan tiap host
                </CardDescription>
              </CardHeader>
              <CardContent className="h-56 pt-4">
                {hostChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    Belum ada data host pada filter ini.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hostChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis
                        fontSize={11}
                        tickFormatter={(val) => `${(val / 1000000).toFixed(1)}M`}
                      />
                      <Tooltip formatter={(value: any) => [formatRupiah(Number(value)), 'Total GMV']} />
                      <Bar dataKey="gmv" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 2: DATA LAPORAN BIMBEL (CRUD) */}
        {activeTab === 'bimbel' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <select
                  value={filterMurid}
                  onChange={(e) => setFilterMurid(e.target.value)}
                  className="h-8 rounded-md border border-input bg-transparent px-2.5 text-xs shadow-sm focus:outline-none dark:bg-slate-900"
                >
                  <option value="all">Semua Siswa ({muridList.length})</option>
                  {muridList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nama} ({m.tingkat_kelas})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportBimbelToCSV(filteredBimbel)}
                  className="text-xs gap-1.5"
                >
                  <FileDown className="h-3.5 w-3.5 text-blue-600" />
                  <span>Ekspor CSV</span>
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b text-slate-700 dark:text-slate-300 font-semibold">
                    <tr>
                      <th className="p-3 w-10 text-center">No</th>
                      <th className="p-3">Tanggal</th>
                      <th className="p-3">Nama Siswa</th>
                      <th className="p-3">Tutor Pengajar</th>
                      <th className="p-3">Mata Pelajaran</th>
                      <th className="p-3">Topik / Materi</th>
                      <th className="p-3">Ringkasan Sesi</th>
                      <th className="p-3 text-right">Aksi Kelola</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredBimbel.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-muted-foreground">
                          Tidak ditemukan data laporan bimbel pada kriteria ini.
                        </td>
                      </tr>
                    ) : (
                      filteredBimbel.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 text-center text-muted-foreground">{idx + 1}</td>
                          <td className="p-3 font-medium whitespace-nowrap">{item.tanggal}</td>
                          <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                            {item.murid?.nama || '-'}
                            <span className="block text-[10px] font-normal text-muted-foreground">
                              {item.murid?.tingkat_kelas}
                            </span>
                          </td>
                          <td className="p-3 text-slate-700 dark:text-slate-300">
                            {item.tutor?.nama || '-'}
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-[10px]">
                              {item.mata_pelajaran}
                            </Badge>
                          </td>
                          <td className="p-3 font-medium text-slate-800 dark:text-slate-200">
                            {item.topik}
                          </td>
                          <td className="p-3 max-w-xs truncate text-muted-foreground" title={item.ringkasan}>
                            {item.ringkasan}
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {item.foto_kegiatan_url && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setPreviewImage(item.foto_kegiatan_url!)}
                                  className="h-7 w-7 p-0 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400"
                                  title="Lihat Foto Dokumentasi Mengajar"
                                >
                                  <ImageIcon className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleQuickStudentPdf(item)}
                                className="h-7 px-2 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-400 gap-1"
                                title="Unduh PDF Siswa Ini"
                              >
                                <FileDown className="h-3.5 w-3.5" />
                                <span>PDF</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditBimbelTarget(item)}
                                className="h-7 w-7 p-0 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                                title="Edit Sesi Bimbel"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setDeleteTarget({
                                    type: 'bimbel',
                                    id: item.id,
                                    name: `${item.mata_pelajaran} - ${item.murid?.nama || 'Siswa'} (${item.tanggal})`,
                                    title: 'Hapus Laporan Bimbel',
                                    desc: 'Apakah Anda yakin ingin menghapus catatan sesi mengajar ini secara permanen?',
                                  })
                                }
                                className="h-7 w-7 p-0 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                title="Hapus Laporan"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DATA LAPORAN TIKTOK (CRUD) */}
        {activeTab === 'tiktok' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <select
                  value={filterHost}
                  onChange={(e) => setFilterHost(e.target.value)}
                  className="h-8 rounded-md border border-input bg-transparent px-2.5 text-xs shadow-sm focus:outline-none dark:bg-slate-900"
                >
                  <option value="all">Semua Host ({distinctHosts.length})</option>
                  {distinctHosts.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportTikTokToCSV(filteredTiktok)}
                  className="text-xs gap-1.5"
                >
                  <FileDown className="h-3.5 w-3.5 text-pink-600" />
                  <span>Ekspor CSV</span>
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b text-slate-700 dark:text-slate-300 font-semibold">
                    <tr>
                      <th className="p-3 w-10 text-center">No</th>
                      <th className="p-3">Tanggal</th>
                      <th className="p-3">Host Live</th>
                      <th className="p-3">Durasi</th>
                      <th className="p-3">GMV Penjualan</th>
                      <th className="p-3">Tayangan (Views)</th>
                      <th className="p-3">Impresi</th>
                      <th className="p-3 text-center">Bukti GMV</th>
                      <th className="p-3 text-right">Aksi Kelola</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredTiktok.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-6 text-center text-muted-foreground">
                          Tidak ditemukan data laporan TikTok pada kriteria ini.
                        </td>
                      </tr>
                    ) : (
                      filteredTiktok.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 text-center text-muted-foreground">{idx + 1}</td>
                          <td className="p-3 font-medium whitespace-nowrap">{item.tanggal}</td>
                          <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                            {item.host?.nama || '-'}
                          </td>
                          <td className="p-3 text-slate-700 dark:text-slate-300">
                            {item.durasi_menit} Menit
                          </td>
                          <td className="p-3 font-bold text-pink-600 dark:text-pink-400">
                            {formatRupiah(Number(item.gmv_rupiah))}
                          </td>
                          <td className="p-3 text-slate-700 dark:text-slate-300">
                            {item.tayangan.toLocaleString('id-ID')}
                          </td>
                          <td className="p-3 text-slate-700 dark:text-slate-300">
                            {item.impresi.toLocaleString('id-ID')}
                          </td>
                          <td className="p-3 text-center">
                            {item.foto_bukti_url ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setPreviewImage(item.foto_bukti_url || null)}
                                className="h-7 px-2 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 gap-1"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>Lihat</span>
                              </Button>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditTiktokTarget(item)}
                                className="h-7 w-7 p-0 text-slate-600 hover:text-pink-600 hover:bg-pink-50"
                                title="Edit Laporan TikTok"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setDeleteTarget({
                                    type: 'tiktok',
                                    id: item.id,
                                    name: `Live ${item.host?.nama || 'Host'} (${formatRupiah(Number(item.gmv_rupiah))}) - ${item.tanggal}`,
                                    title: 'Hapus Laporan TikTok Live',
                                    desc: 'Apakah Anda yakin ingin menghapus data laporan live streaming ini?',
                                  })
                                }
                                className="h-7 w-7 p-0 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                title="Hapus Laporan"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: MANAJEMEN KARYAWAN (FULL CRUD) */}
        {activeTab === 'karyawan' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-600" />
                  Daftar Karyawan Terdaftar ({filteredEmployees.length})
                </h3>
                <p className="text-xs text-muted-foreground">
                  Kelola hak akses, perbarui data, reset sandi, atau hapus akun karyawan
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      setIsLoading(true)
                      const { error } = await supabase.rpc('sync_all_auth_users')
                      if (error) console.warn('Sync note:', error.message)
                      await fetchData()
                    } catch (err) {
                      await fetchData()
                    } finally {
                      setIsLoading(false)
                    }
                  }}
                  className="text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-900 dark:text-indigo-400 gap-1.5"
                  title="Sinkronkan seluruh user auth Supabase ke tabel profil karyawan"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Sinkronkan Database</span>
                </Button>

                <Button
                  size="sm"
                  onClick={() => setIsAddEmployeeOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 text-xs shadow-md shadow-indigo-500/20"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>+ Daftarkan Karyawan Baru</span>
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b text-slate-700 dark:text-slate-300 font-semibold">
                    <tr>
                      <th className="p-3 w-10 text-center">No</th>
                      <th className="p-3">Nama Karyawan</th>
                      <th className="p-3">Email Login (Akun)</th>
                      <th className="p-3">Peran / Role</th>
                      <th className="p-3">Status Akses</th>
                      <th className="p-3 text-right">Aksi Kelola Akun</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-muted-foreground">
                          Belum ada karyawan yang terdaftar.
                        </td>
                      </tr>
                    ) : (
                      filteredEmployees.map((emp, idx) => (
                        <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 text-center text-muted-foreground">{idx + 1}</td>
                          <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                            {emp.nama}
                            {emp.id === user?.id && (
                              <Badge variant="outline" className="ml-2 text-[10px] border-emerald-300 text-emerald-600">
                                Akun Anda
                              </Badge>
                            )}
                          </td>
                          <td className="p-3">
                            {emp.email ? (
                              <span className="font-mono text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                <Mail className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                                {emp.email}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-[11px] italic">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={
                                emp.role === 'owner'
                                  ? 'default'
                                  : emp.role === 'tutor'
                                  ? 'outline'
                                  : 'secondary'
                              }
                              className={`text-[11px] capitalize ${
                                emp.role === 'tutor'
                                  ? 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:text-blue-300'
                                  : emp.role === 'host'
                                  ? 'text-pink-700 bg-pink-50 border-pink-200 dark:bg-pink-950 dark:text-pink-300'
                                  : 'bg-indigo-600 text-white'
                              }`}
                            >
                              {emp.role === 'tutor' ? 'Tutor Bimbel' : emp.role === 'host' ? 'Host TikTok Live' : 'Owner'}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                              <UserCheck className="h-3.5 w-3.5" /> Aktif
                            </span>
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Edit Data */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditEmployeeTarget(emp)}
                                className="h-7 px-2.5 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-900 dark:text-indigo-400 gap-1"
                                title="Edit Nama / Role Karyawan"
                              >
                                <Edit className="h-3.5 w-3.5" />
                                <span>Edit</span>
                              </Button>

                              {/* Reset Sandi */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setResetEmployeeTarget(emp)}
                                className="h-7 px-2.5 text-xs text-amber-700 border-amber-200 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-400 gap-1"
                                title="Ganti Kata Sandi"
                              >
                                <KeyRound className="h-3.5 w-3.5" />
                                <span>Sandi</span>
                              </Button>

                              {/* Hapus Karyawan */}
                              {emp.id !== user?.id && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setDeleteTarget({
                                      type: 'employee',
                                      id: emp.id,
                                      name: `${emp.nama} (${emp.role.toUpperCase()})`,
                                      title: 'Hapus Karyawan',
                                      desc: 'Apakah Anda yakin ingin menghapus akun karyawan ini secara permanen beserta seluruh riwayat aktivitasnya?',
                                    })
                                  }
                                  className="h-7 w-7 p-0 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                  title="Hapus Karyawan"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: MANAJEMEN SISWA BINAAN (FULL CRUD) */}
        {activeTab === 'murid' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-emerald-600" />
                  Daftar Siswa Bimbingan Belajar ({filteredMurid.length})
                </h3>
                <p className="text-xs text-muted-foreground">
                  Kelola data siswa, jenjang kelas, dan cetak rapor perkembangan belajar
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => setIsAddMuridOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs shadow-md shadow-emerald-500/20"
              >
                <Plus className="h-4 w-4" />
                <span>+ Tambah Siswa Baru</span>
              </Button>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b text-slate-700 dark:text-slate-300 font-semibold">
                    <tr>
                      <th className="p-3 w-10 text-center">No</th>
                      <th className="p-3">Nama Lengkap Siswa</th>
                      <th className="p-3">Tingkat / Jenjang Kelas</th>
                      <th className="p-3">Total Sesi Diikuti</th>
                      <th className="p-3 text-right">Aksi Kelola</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredMurid.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-muted-foreground">
                          Belum ada siswa binaan yang terdaftar.
                        </td>
                      </tr>
                    ) : (
                      filteredMurid.map((m, idx) => {
                        const totalSesi = bimbelList.filter((b) => b.murid_id === m.id).length
                        return (
                          <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="p-3 text-center text-muted-foreground">{idx + 1}</td>
                            <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                              {m.nama}
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200">
                                {m.tingkat_kelas}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <span className="font-semibold text-blue-600">{totalSesi}</span> Sesi
                            </td>
                            <td className="p-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setPreselectedMuridId(m.id)
                                    setIsPdfModalOpen(true)
                                  }}
                                  className="h-7 px-2.5 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-400 gap-1"
                                  title="Cetak Laporan PDF Siswa Ini"
                                >
                                  <FileDown className="h-3.5 w-3.5" />
                                  <span>Rapor PDF</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditMuridTarget(m)}
                                  className="h-7 w-7 p-0 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50"
                                  title="Edit Siswa"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setDeleteTarget({
                                      type: 'murid',
                                      id: m.id,
                                      name: `${m.nama} (${m.tingkat_kelas})`,
                                      title: 'Hapus Siswa Binaan',
                                      desc: 'Apakah Anda yakin ingin menghapus data siswa ini? Catatan riwayat bimbel terkait siswa ini mungkin akan ikut terhapus.',
                                    })
                                  }
                                  className="h-7 w-7 p-0 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                  title="Hapus Siswa"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- ALL MODALS --- */}

      {/* Add Employee Modal */}
      <AddEmployeeModal
        isOpen={isAddEmployeeOpen}
        onClose={() => setIsAddEmployeeOpen(false)}
        onSuccess={() => fetchData()}
      />

      {/* Edit Employee Modal */}
      <EditEmployeeModal
        isOpen={!!editEmployeeTarget}
        onClose={() => setEditEmployeeTarget(null)}
        onSuccess={() => fetchData()}
        employee={editEmployeeTarget}
      />

      {/* Reset Password Modal */}
      <ResetPasswordModal
        isOpen={!!resetEmployeeTarget}
        onClose={() => setResetEmployeeTarget(null)}
        employee={resetEmployeeTarget}
      />

      {/* Edit Bimbel Modal */}
      <EditBimbelModal
        isOpen={!!editBimbelTarget}
        onClose={() => setEditBimbelTarget(null)}
        onSuccess={() => fetchData()}
        laporan={editBimbelTarget}
        muridList={muridList}
      />

      {/* Edit TikTok Modal */}
      <EditTikTokModal
        isOpen={!!editTiktokTarget}
        onClose={() => setEditTiktokTarget(null)}
        onSuccess={() => fetchData()}
        laporan={editTiktokTarget}
      />

      {/* Add Murid Modal */}
      <AddMuridModal
        isOpen={isAddMuridOpen}
        onClose={() => setIsAddMuridOpen(false)}
        onSuccess={() => fetchData()}
      />

      {/* Edit Murid Modal */}
      <EditMuridModal
        isOpen={!!editMuridTarget}
        onClose={() => setEditMuridTarget(null)}
        onSuccess={() => fetchData()}
        murid={editMuridTarget}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title={deleteTarget?.title || 'Konfirmasi Hapus'}
        description={deleteTarget?.desc || 'Apakah Anda yakin ingin menghapus data ini secara permanen?'}
        itemName={deleteTarget?.name}
        isDeleting={isDeleting}
      />

      {/* PDF Export Modal */}
      <PdfExportModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        muridList={muridList}
        allBimbelReports={bimbelList}
        preselectedMuridId={preselectedMuridId}
      />

      {/* Photo Proof Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative max-w-2xl w-full bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="p-3 border-b flex items-center justify-between">
              <div className="text-xs font-semibold flex items-center gap-1.5">
                <ImageIcon className={`h-4 w-4 ${previewImage?.includes('bimbel') ? 'text-blue-500' : 'text-pink-500'}`} />
                <span>
                  {previewImage?.includes('bimbel')
                    ? 'Foto Dokumentasi Kegiatan Belajar'
                    : 'Foto Bukti Screenshot GMV / Live TikTok'}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewImage(null)}
                className="h-7 w-7 p-0 rounded-full"
              >
                ✕
              </Button>
            </div>
            <div className="p-4 flex items-center justify-center bg-black/10 max-h-[75vh] overflow-auto">
              <img
                src={previewImage}
                alt="Bukti GMV"
                className="max-h-[70vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
      {/* Floating AI Assistant Trigger & Modal */}
      <AiAssistantModal />
    </div>
  )
}
