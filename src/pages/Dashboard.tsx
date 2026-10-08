import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { LaporanBimbel, LaporanTiktok, Murid, UserProfile } from '@/types'
import { exportBimbelToCSV, exportTikTokToCSV } from '@/lib/csvExporter'
import { generateStudentReportPDF } from '@/lib/pdfExporter'
import { PdfExportModal } from '@/components/dashboard/PdfExportModal'
import { AddEmployeeModal } from '@/components/dashboard/AddEmployeeModal'
import { ResetPasswordModal } from '@/components/dashboard/ResetPasswordModal'
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
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import {
  LogOut,
  TrendingUp,
  GraduationCap,
  Video,
  FileDown,
  FileText,
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
  ShieldCheck,
  UserCheck
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
  const [activeTab, setActiveTab] = useState<'overview' | 'bimbel' | 'tiktok' | 'karyawan'>('overview')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [filterMurid, setFilterMurid] = useState<string>('all')
  const [filterHost, setFilterHost] = useState<string>('all')

  // Modal States
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false)
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false)
  const [resetEmployeeTarget, setResetEmployeeTarget] = useState<UserProfile | null>(null)
  const [preselectedMuridId, setPreselectedMuridId] = useState<string | undefined>(undefined)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // 1. Fetch All Data
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      // Fetch Bimbel Reports with joins
      const { data: bimbelData, error: bimbelError } = await supabase
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

      if (bimbelError) console.warn('Bimbel fetch warning:', bimbelError.message)
      if (bimbelData) setBimbelList(bimbelData as unknown as LaporanBimbel[])

      // Fetch TikTok Reports with joins
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
      const { data: muridData } = await supabase
        .from('murid')
        .select('*')
        .order('nama', { ascending: true })

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

  // 2. Realtime WebSocket Listener (Zero-Compute Push)
  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel('realtime_owner_channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'laporan_bimbel' },
        () => {
          setRealtimePulse(true)
          setTimeout(() => setRealtimePulse(false), 2500)
          fetchData()
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'laporan_tiktok' },
        () => {
          setRealtimePulse(true)
          setTimeout(() => setRealtimePulse(false), 2500)
          fetchData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchData])

  // 3. Computed KPIs & Analytics
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
        emp.role?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })
  }, [employeeList, searchQuery])

  const totalGMV = useMemo(() => {
    return filteredTiktok.reduce((acc, curr) => acc + Number(curr.gmv_rupiah || 0), 0)
  }, [filteredTiktok])

  const totalDurasiMenit = useMemo(() => {
    return filteredTiktok.reduce((acc, curr) => acc + Number(curr.durasi_menit || 0), 0)
  }, [filteredTiktok])

  const totalSesiBimbel = filteredBimbel.length

  // Chart Data 1: GMV by Date
  const gmvChartData = useMemo(() => {
    const map = new Map<string, number>()
    const sorted = [...filteredTiktok].sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())
    sorted.forEach((item) => {
      const dateKey = item.tanggal
      map.set(dateKey, (map.get(dateKey) || 0) + Number(item.gmv_rupiah || 0))
    })
    return Array.from(map.entries()).map(([tanggal, gmv]) => ({
      tanggal: tanggal.slice(5),
      gmv,
    }))
  }, [filteredTiktok])

  // Chart Data 2: Bimbel Subject Breakdown
  const subjectChartData = useMemo(() => {
    const map = new Map<string, number>()
    filteredBimbel.forEach((item) => {
      const subject = item.mata_pelajaran || 'Lainnya'
      map.set(subject, (map.get(subject) || 0) + 1)
    })
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [filteredBimbel])

  // Chart Data 3: Host GMV Comparison
  const hostChartData = useMemo(() => {
    const map = new Map<string, number>()
    filteredTiktok.forEach((item) => {
      const host = item.host?.nama || 'Host'
      map.set(host, (map.get(host) || 0) + Number(item.gmv_rupiah || 0))
    })
    return Array.from(map.entries()).map(([name, gmv]) => ({ name, gmv }))
  }, [filteredTiktok])

  // Format IDR Helper
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
      tutorNama: item.tutor?.nama || 'Nikita Khoirunnisa',
      periodeBulan: monthLabel,
      sesiList: studentSessions.length > 0 ? studentSessions : [item],
    })
  }

  // Distinct Hosts list
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
      {/* Top Navigation */}
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
              <span className="text-[11px] text-muted-foreground capitalize">Owner (Full RLS)</span>
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
            <span className="font-semibold">Data Baru Terdeteksi Realtime:</span> Metrik dan grafik telah otomatis diperbarui tanpa reload halaman!
          </div>
        )}

        {/* Top Control Bar: Global Filters & Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter Bulan */}
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

            {/* Global Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Cari murid, tutor, host, mapel..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs w-48 sm:w-64"
              />
            </div>
          </div>

          {/* Action: Quick PDF & Add Employee */}
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
          {/* Card 1: Total GMV TikTok */}
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

          {/* Card 2: Total Sesi Bimbel */}
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

          {/* Card 3: Total Durasi Live */}
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

          {/* Card 4: Total Karyawan Aktif */}
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
                Tutor Bimbel & Host TikTok Live
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tab Switcher: Overview / Bimbel Table / TikTok Table / Manajemen Karyawan */}
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
        </div>

        {/* TAB 1: OVERVIEW & CHARTS */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Row Charts 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart 1: Tren GMV Harian */}
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

              {/* Chart 2: Distribusi Mata Pelajaran Bimbel */}
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
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Row Charts 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart 3: GMV per Host */}
              <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Video className="h-4 w-4 text-purple-600" />
                    Kontribusi GMV per Host TikTok
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Perbandingan total penjualan yang dihasilkan tiap Host
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-64 pt-4">
                  {hostChartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                      Belum ada data host.
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
                        <Bar dataKey="gmv" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions Info Card */}
              <Card className="border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-indigo-600" />
                    Akses Langsung Manajemen Karyawan
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Daftarkan akun Tutor/Host baru atau ubah kata sandi karyawan dengan 1 klik
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="p-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 space-y-1.5">
                    <div className="font-semibold text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4" />
                      Fitur Owner Terproteksi PostgreSQL:
                    </div>
                    <ul className="text-[11px] text-muted-foreground list-disc list-inside space-y-0.5">
                      <li>Daftarkan email dan password akun Tutor / Host secara instan</li>
                      <li>Reset password karyawan langsung tanpa perlu buka Supabase dashboard</li>
                      <li>Role isolation: Karyawan hanya bisa mengakses dashboard mereka sendiri</li>
                    </ul>
                  </div>
                </CardContent>
                <div className="p-6 pt-0 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => setIsAddEmployeeOpen(true)}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 shadow-md shadow-indigo-500/20"
                  >
                    <UserPlus className="h-4 w-4" />
                    + Tambah Karyawan
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab('karyawan')}
                    className="text-xs"
                  >
                    Kelola Karyawan ➔
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* TAB 2: DATA LAPORAN BIMBEL */}
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
                <Button
                  size="sm"
                  onClick={() => {
                    setPreselectedMuridId(filterMurid !== 'all' ? filterMurid : undefined)
                    setIsPdfModalOpen(true)
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Generate PDF Siswa</span>
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
                      <th className="p-3">Siswa & Kelas</th>
                      <th className="p-3">Tutor</th>
                      <th className="p-3">Mata Pelajaran</th>
                      <th className="p-3">Topik</th>
                      <th className="p-3">Ringkasan Materi</th>
                      <th className="p-3 text-right">Aksi PDF</th>
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
                          <td className="p-3">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {item.murid?.nama || '-'}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {item.murid?.tingkat_kelas || '-'}
                            </div>
                          </td>
                          <td className="p-3 text-slate-700 dark:text-slate-300">
                            {item.tutor?.nama || '-'}
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-[10px] bg-blue-50/50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200">
                              {item.mata_pelajaran}
                            </Badge>
                          </td>
                          <td className="p-3 font-medium text-slate-800 dark:text-slate-200">
                            {item.topik}
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                            {item.ringkasan}
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Download PDF Laporan Siswa Ini"
                              onClick={() => handleQuickStudentPdf(item)}
                              className="h-7 px-2 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 gap-1"
                            >
                              <FileDown className="h-3.5 w-3.5" />
                              <span className="hidden md:inline">PDF</span>
                            </Button>
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

        {/* TAB 3: DATA LAPORAN TIKTOK LIVE */}
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredTiktok.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-muted-foreground">
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
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: MANAJEMEN KARYAWAN (TUTOR & HOST) */}
        {activeTab === 'karyawan' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-600" />
                  Daftar Karyawan Terdaftar ({filteredEmployees.length})
                </h3>
                <p className="text-xs text-muted-foreground">
                  Kelola hak akses Tutor Bimbel dan Host TikTok Live
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => setIsAddEmployeeOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 text-xs shadow-md shadow-indigo-500/20"
              >
                <UserPlus className="h-4 w-4" />
                <span>+ Daftarkan Karyawan Baru</span>
              </Button>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b text-slate-700 dark:text-slate-300 font-semibold">
                    <tr>
                      <th className="p-3 w-10 text-center">No</th>
                      <th className="p-3">Nama Karyawan</th>
                      <th className="p-3">Peran / Role</th>
                      <th className="p-3">Status Akses</th>
                      <th className="p-3 text-right">Aksi Kata Sandi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-muted-foreground">
                          Belum ada karyawan yang terdaftar.
                        </td>
                      </tr>
                    ) : (
                      filteredEmployees.map((emp, idx) => (
                        <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 text-center text-muted-foreground">{idx + 1}</td>
                          <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                            {emp.nama}
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
                                  : ''
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
                          <td className="p-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setResetEmployeeTarget(emp)}
                              className="h-7 px-2.5 text-xs text-amber-700 border-amber-200 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-400 dark:hover:bg-amber-950 gap-1.5"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                              <span>Ganti Kata Sandi</span>
                            </Button>
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
      </main>

      {/* Add Employee Modal */}
      <AddEmployeeModal
        isOpen={isAddEmployeeOpen}
        onClose={() => setIsAddEmployeeOpen(false)}
        onSuccess={() => fetchData()}
      />

      {/* Reset Password Modal */}
      <ResetPasswordModal
        isOpen={!!resetEmployeeTarget}
        onClose={() => setResetEmployeeTarget(null)}
        employee={resetEmployeeTarget}
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
                <ImageIcon className="h-4 w-4 text-pink-500" />
                <span>Foto Bukti Screenshot GMV / Live TikTok</span>
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
    </div>
  )
}
