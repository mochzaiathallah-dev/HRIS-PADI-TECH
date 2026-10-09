import React, { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { LaporanTiktok } from '@/types'
import { compressClientImage, CompressionResult, formatFileSize } from '@/lib/imageCompressor'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Video, 
  Calendar, 
  Clock, 
  DollarSign, 
  Eye, 
  Activity, 
  UploadCloud, 
  Image as ImageIcon, 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  X, 
  History,
  Zap,
  Edit,
  Trash2,
  Sparkles,
  AtSign,
  ScanLine,
  RefreshCw,
  FileSpreadsheet
} from 'lucide-react'
import { 
  parseTiktokOrderFile, 
  batchInsertTiktokSessions, 
  ParseTiktokResult 
} from '@/lib/excelTiktokParser'

const DEFAULT_TIKTOK_ACCOUNT = '@wangigaya'
const SUGGESTED_ACCOUNTS = ['@wangigaya', '@paditech', '@gayahijab']

const tiktokSchema = z.object({
  akun_tiktok: z.string().min(1, 'Nama akun TikTok wajib diisi (misal: @wangigaya)'),
  tanggal: z.string().min(1, 'Tanggal sesi live wajib diisi'),
  durasi_menit: z.coerce.number().min(1, 'Durasi live minimal 1 menit'),
  gmv_rupiah: z.coerce.number().min(0, 'GMV tidak boleh negatif'),
  tayangan: z.coerce.number().min(0, 'Tayangan tidak boleh negatif'),
  impresi: z.coerce.number().min(0, 'Impresi tidak boleh negatif'),
})

type TikTokFormValues = z.infer<typeof tiktokSchema>

const QUICK_DURATIONS = [30, 60, 90, 120, 180]

interface FormTikTokProps {
  onReportCreated?: () => void
  onEditReport?: (report: LaporanTiktok) => void
  onDeleteReport?: (report: LaporanTiktok) => void
}

export const FormTikTok: React.FC<FormTikTokProps> = ({
  onReportCreated,
  onEditReport,
  onDeleteReport,
}) => {
  const { user } = useAuth()
  const [historyList, setHistoryList] = useState<LaporanTiktok[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCompressing, setIsCompressing] = useState(false)
  const [isScanningAI, setIsScanningAI] = useState(false)
  const [isParsingExcel, setIsParsingExcel] = useState(false)
  const [isBatchSaving, setIsBatchSaving] = useState(false)
  const [excelResult, setExcelResult] = useState<ParseTiktokResult | null>(null)
  const [selectedSessionIdx, setSelectedSessionIdx] = useState<number>(0)
  const [scanNotice, setScanNotice] = useState<string | null>(null)
  const [compressionData, setCompressionData] = useState<CompressionResult | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const todayStr = new Date().toISOString().split('T')[0]

  const savedAccount = typeof window !== 'undefined' 
    ? localStorage.getItem('last_akun_tiktok') || DEFAULT_TIKTOK_ACCOUNT 
    : DEFAULT_TIKTOK_ACCOUNT

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<TikTokFormValues>({
    resolver: zodResolver(tiktokSchema),
    defaultValues: {
      akun_tiktok: savedAccount,
      tanggal: todayStr,
      durasi_menit: 60,
      gmv_rupiah: 0,
      tayangan: 0,
      impresi: 0,
    },
  })

  const currentGMV = watch('gmv_rupiah') || 0
  const currentDurasi = watch('durasi_menit') || 0
  const currentAccount = watch('akun_tiktok') || DEFAULT_TIKTOK_ACCOUNT

  // 1. Fetch Riwayat Laporan Milik Host Ini (RLS Protected)
  const fetchHistory = useCallback(async () => {
    if (!user?.id) return
    setIsLoadingHistory(true)
    try {
      const { data, error } = await supabase
        .from('laporan_tiktok')
        .select('*')
        .eq('host_id', user.id)
        .order('tanggal', { ascending: false })
        .limit(5)

      if (error) throw error
      if (data) setHistoryList(data as LaporanTiktok[])
    } catch (err: any) {
      console.warn('Notice fetching history tiktok:', err.message)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchHistory()
    if (!user?.id) return

    const channel = supabase
      .channel(`realtime_form_tiktok_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'laporan_tiktok',
          filter: `host_id=eq.${user.id}`,
        },
        () => {
          fetchHistory()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, fetchHistory])

  // Helper konversi file gambar ke base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // 2. Scan AI Multimodal OCR dari Screenshot TikTok Live
  const triggerAiScan = async (fileToScan: File) => {
    setIsScanningAI(true)
    setScanNotice(null)
    setErrorMessage(null)

    try {
      const base64Data = await fileToBase64(fileToScan)
      const res = await fetch('/api/scan-tiktok-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType: fileToScan.type || 'image/jpeg'
        })
      })

      const json = await res.json()
      if (json.success && json.data) {
        const { durasi_menit, gmv_rupiah, tayangan, impresi, komentar, produk_terjual, akun_tiktok } = json.data

        if (durasi_menit && durasi_menit > 0) {
          setValue('durasi_menit', durasi_menit, { shouldValidate: true })
        }
        if (typeof gmv_rupiah === 'number') {
          setValue('gmv_rupiah', gmv_rupiah, { shouldValidate: true })
        }
        if (typeof tayangan === 'number') {
          setValue('tayangan', tayangan, { shouldValidate: true })
        }
        if (typeof impresi === 'number') {
          setValue('impresi', impresi, { shouldValidate: true })
        }
        if (akun_tiktok) {
          setValue('akun_tiktok', akun_tiktok, { shouldValidate: true })
          try {
            localStorage.setItem('last_akun_tiktok', akun_tiktok)
          } catch {}
        }

        const summaryParts: string[] = []
        if (durasi_menit) summaryParts.push(`Durasi: ${durasi_menit} mnt`)
        if (typeof gmv_rupiah === 'number') summaryParts.push(`GMV: ${formatRupiah(gmv_rupiah)}`)
        if (typeof tayangan === 'number') summaryParts.push(`Tayangan: ${tayangan.toLocaleString('id-ID')}`)
        if (typeof impresi === 'number') summaryParts.push(`Impresi: ${impresi.toLocaleString('id-ID')}`)
        if (produk_terjual) summaryParts.push(`${produk_terjual} Produk terjual`)
        if (komentar) summaryParts.push(`${komentar} Komentar`)

        setScanNotice(`✨ Data berhasil diekstrak otomatis oleh AI: ${summaryParts.join(' | ')}`)
      } else {
        console.warn('AI OCR Notice:', json)
      }
    } catch (err: any) {
      console.warn('Scan screenshot notice:', err.message)
    } finally {
      setIsScanningAI(false)
    }
  }

  // 3. Client-Side Handling (Excel / CSV Spreadsheet OR Image Screenshot)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setErrorMessage(null)
    setScanNotice(null)
    setSubmitSuccess(null)

    const fileNameLower = file.name.toLowerCase()
    const isSpreadsheet = 
      fileNameLower.endsWith('.xlsx') || 
      fileNameLower.endsWith('.xls') || 
      fileNameLower.endsWith('.csv')

    if (isSpreadsheet) {
      removeSelectedImage()
      setIsParsingExcel(true)

      try {
        const result = await parseTiktokOrderFile(file, currentAccount)
        if (!result.success || result.liveSessions.length === 0) {
          throw new Error(result.error || 'Tidak ditemukan sesi live valid di dalam file ini.')
        }

        setExcelResult(result)
        setSelectedSessionIdx(0)

        // Otomatis isi kolom form dengan data sesi pertama (terbaru)
        const firstSession = result.liveSessions[0]
        setValue('tanggal', firstSession.tanggal, { shouldValidate: true })
        setValue('gmv_rupiah', firstSession.gmv_rupiah, { shouldValidate: true })
        setValue('durasi_menit', firstSession.durasi_menit, { shouldValidate: true })
        setValue('tayangan', firstSession.tayangan, { shouldValidate: true })
        setValue('impresi', firstSession.impresi, { shouldValidate: true })
        if (firstSession.akun_tiktok) {
          setValue('akun_tiktok', firstSession.akun_tiktok, { shouldValidate: true })
        }

        setScanNotice(
          `📊 File Excel "${file.name}" berhasil dianalisis! Terdeteksi ${result.liveSessions.length} sesi LIVE (${formatRupiah(result.totalGMVLive)}). Sesi ke-1 otomatis diisikan ke form.`
        )
      } catch (err: any) {
        console.error('Excel parse error:', err)
        setErrorMessage(err.message || 'Gagal membaca file Excel/CSV.')
      } finally {
        setIsParsingExcel(false)
        e.target.value = ''
      }
      return
    }

    // Jika file gambar screenshot
    setExcelResult(null)
    setIsCompressing(true)

    try {
      const result = await compressClientImage(file)
      setCompressionData(result)
      setIsCompressing(false)

      // Otomatis Pindai Screenshot menggunakan AI Vision
      await triggerAiScan(result.file)
    } catch (err) {
      console.error('Compression error:', err)
      setErrorMessage('Gagal memproses gambar. Pastikan format file adalah JPG/PNG/WEBP atau Excel (.xlsx/.csv).')
      setIsCompressing(false)
    } finally {
      e.target.value = ''
    }
  }

  const handleSelectExcelSession = (idx: number) => {
    if (!excelResult || !excelResult.liveSessions[idx]) return
    const s = excelResult.liveSessions[idx]
    setSelectedSessionIdx(idx)
    setValue('tanggal', s.tanggal, { shouldValidate: true })
    setValue('gmv_rupiah', s.gmv_rupiah, { shouldValidate: true })
    setValue('durasi_menit', s.durasi_menit, { shouldValidate: true })
    setValue('tayangan', s.tayangan, { shouldValidate: true })
    setValue('impresi', s.impresi, { shouldValidate: true })
    if (s.akun_tiktok) {
      setValue('akun_tiktok', s.akun_tiktok, { shouldValidate: true })
    }
    setScanNotice(
      `✨ Sesi #${idx + 1} (${s.tanggal} - ${s.waktu}) berhasil diisikan ke form. GMV: ${formatRupiah(s.gmv_rupiah)}`
    )
  }

  const handleBatchSaveAllSessions = async () => {
    if (!user?.id || !excelResult?.liveSessions.length) return
    setIsBatchSaving(true)
    setErrorMessage(null)
    try {
      const res = await batchInsertTiktokSessions(user.id, excelResult.liveSessions, currentAccount)
      if (!res.success) throw new Error(res.error || 'Gagal menyimpan sesi live.')

      setSubmitSuccess(
        `🎉 Sukses! ${res.insertedCount} sesi live TikTok dari "${excelResult.fileName}" berhasil disimpan ke Supabase! Data langsung sinkron realtime ke dashboard Host & Owner.`
      )
      setExcelResult(null)
      setScanNotice(null)
      await fetchHistory()
      if (onReportCreated) onReportCreated()
    } catch (err: any) {
      console.error('Batch save error:', err)
      setErrorMessage(err.message || 'Gagal menyimpan batch sesi live ke Supabase.')
    } finally {
      setIsBatchSaving(false)
    }
  }

  const removeExcelData = () => {
    setExcelResult(null)
    setScanNotice(null)
  }

  const removeSelectedImage = () => {
    if (compressionData?.previewUrl) {
      URL.revokeObjectURL(compressionData.previewUrl)
    }
    setCompressionData(null)
    setScanNotice(null)
  }

  // 4. Format Rupiah Currency Helper
  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val)
  }

  // 5. Submit Handler (Upload Bucket + Insert Supabase Table)
  const onSubmit = async (values: TikTokFormValues) => {
    if (!user?.id) {
      setErrorMessage('Sesi otentikasi tidak ditemukan. Silakan login ulang.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    setSubmitSuccess(null)

    // Simpan akun preferensi ke localStorage
    try {
      localStorage.setItem('last_akun_tiktok', values.akun_tiktok)
    } catch {}

    try {
      let fotoBuktiUrl: string | null = null

      // A. Upload Foto Terkompresi ke Supabase Storage jika ada
      if (compressionData?.file) {
        const fileExt = 'webp'
        const fileName = `${user.id}/${Date.now()}_bukti.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('bukti_tiktok')
          .upload(fileName, compressionData.file, {
            cacheControl: '3600',
            upsert: true,
          })

        if (uploadError) {
          console.warn('Notice upload storage:', uploadError.message)
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('bukti_tiktok')
            .getPublicUrl(fileName)
          fotoBuktiUrl = publicUrlData.publicUrl
        }
      }

      // B. Insert ke Tabel laporan_tiktok (Dengan Fallback Cerdas jika kolom akun_tiktok belum ada)
      const insertPayload: any = {
        host_id: user.id,
        tanggal: values.tanggal,
        durasi_menit: values.durasi_menit,
        gmv_rupiah: values.gmv_rupiah,
        tayangan: values.tayangan,
        impresi: values.impresi,
        foto_bukti_url: fotoBuktiUrl,
        akun_tiktok: values.akun_tiktok,
      }

      let { error: insertError } = await supabase.from('laporan_tiktok').insert(insertPayload)

      // Fallback jika skema database belum memiliki kolom akun_tiktok (Postgres 42703 / PostgREST PGRST204)
      if (insertError && (insertError.code === '42703' || insertError.code === 'PGRST204' || insertError.message?.includes('akun_tiktok'))) {
        delete insertPayload.akun_tiktok
        const retry = await supabase.from('laporan_tiktok').insert(insertPayload)
        insertError = retry.error
      }

      if (insertError) throw insertError

      setSubmitSuccess(`Laporan performa TikTok Live untuk ${values.akun_tiktok} berhasil dikirim ke Supabase!`)
      removeSelectedImage()
      reset({
        akun_tiktok: values.akun_tiktok,
        tanggal: todayStr,
        durasi_menit: 60,
        gmv_rupiah: 0,
        tayangan: 0,
        impresi: 0,
      })
      await fetchHistory()
      if (onReportCreated) onReportCreated()
    } catch (err: any) {
      console.error('Gagal submit laporan tiktok:', err)
      setErrorMessage(err.message || 'Gagal menyimpan laporan TikTok. Periksa koneksi database.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Form Card */}
      <Card className="shadow-md border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="h-9 w-9 rounded-lg bg-pink-100 dark:bg-pink-950 flex items-center justify-center text-pink-600 dark:text-pink-400">
                <Video className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Input Laporan TikTok Live</CardTitle>
                <CardDescription className="text-xs">
                  Upload screenshot end-live untuk auto-fill data otomatis via AI
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] text-pink-600 dark:text-pink-400 border-pink-200 dark:border-pink-900 bg-pink-50/50 dark:bg-pink-950/30">
                <AtSign className="h-2.5 w-2.5 mr-0.5" />
                {currentAccount}
              </Badge>
              <Badge variant="outline" className="text-[10px] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hidden sm:inline-flex">
                Host Portal
              </Badge>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardContent className="space-y-4">
            {/* Feedback Banners */}
            {submitSuccess && (
              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs animate-in fade-in">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                <span className="font-medium">{submitSuccess}</span>
              </div>
            )}

            {scanNotice && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs animate-in fade-in">
                <Sparkles className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold block">{scanNotice}</span>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 block mt-0.5">
                    Form di bawah telah terisi otomatis. Anda dapat meninjau atau menyesuaikan angka bila diperlukan.
                  </span>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs animate-in fade-in">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="font-medium">{errorMessage}</span>
              </div>
            )}

            {/* SEKSI 1: UPLOAD SCREENSHOT & AUTO-SCAN AI / EXCEL CSV */}
            <div className="space-y-2 p-3.5 rounded-xl border border-pink-200 dark:border-pink-900/50 bg-gradient-to-b from-pink-50/40 to-slate-50/40 dark:from-pink-950/20 dark:to-slate-900/20">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-pink-700 dark:text-pink-300 flex items-center gap-1.5">
                  <ScanLine className="h-4 w-4 text-pink-600" />
                  Bukti Screenshot atau Ekspor Excel / CSV TikTok
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                    <FileSpreadsheet className="h-3 w-3 text-emerald-600" /> Excel/CSV Auto-Aggregate
                  </span>
                  <span className="text-[10px] text-muted-foreground items-center gap-1 font-medium hidden sm:inline-flex">
                    <Sparkles className="h-3 w-3 text-pink-500" /> Gemini Vision OCR
                  </span>
                </div>
              </div>

              {excelResult ? (
                <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 p-3.5 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-3 shadow-xs animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-emerald-200 dark:border-emerald-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-emerald-700 dark:text-emerald-300 shrink-0">
                        <FileSpreadsheet className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-emerald-900 dark:text-emerald-100 flex items-center gap-1.5">
                          <span className="truncate max-w-[200px] sm:max-w-xs">{excelResult.fileName}</span>
                          <Badge variant="outline" className="text-[9px] bg-emerald-100/60 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-300">
                            Excel/CSV Terbaca
                          </Badge>
                        </div>
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                          {excelResult.totalRows} pesanan teragregasi menjadi {excelResult.liveSessions.length} sesi LIVE
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={removeExcelData}
                      title="Hapus data file Excel"
                      className="p-1 rounded-full text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Ringkasan Metrik Excel */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/60 text-center">
                      <span className="text-[10px] text-muted-foreground block">Total GMV Live</span>
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        {formatRupiah(excelResult.totalGMVLive)}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/60 text-center">
                      <span className="text-[10px] text-muted-foreground block">Sesi Terdeteksi</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {excelResult.liveSessions.length} Sesi
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/60 text-center">
                      <span className="text-[10px] text-muted-foreground block">Produk Terjual</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {excelResult.liveSessions.reduce((acc, s) => acc + s.produk_terjual, 0)} Pcs
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/60 text-center">
                      <span className="text-[10px] text-muted-foreground block">Total Pesanan</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {excelResult.totalOrders} Order
                      </span>
                    </div>
                  </div>

                  {/* Pemilih Sesi Spesifik untuk Auto-fill ke Form */}
                  <div className="space-y-1.5 bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Pratinjau Sesi Terpilih (Masuk ke Kolom Form):
                      </span>
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                        Sesi {selectedSessionIdx + 1} dari {excelResult.liveSessions.length}
                      </span>
                    </div>

                    <select
                      value={selectedSessionIdx}
                      onChange={(e) => handleSelectExcelSession(Number(e.target.value))}
                      className="w-full text-xs h-8 px-2 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      {excelResult.liveSessions.map((session, idx) => (
                        <option key={session.contentId || idx} value={idx}>
                          Sesi #{idx + 1} ({session.tanggal} {session.waktu}) - {formatRupiah(session.gmv_rupiah)} ({session.produk_terjual} pcs, {session.orderCount} pesanan)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tombol Aksi Simpan Batch Realtime */}
                  <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                    <Button
                      type="button"
                      disabled={isBatchSaving || isSubmitting}
                      onClick={handleBatchSaveAllSessions}
                      className="w-full sm:flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 gap-1.5 h-9"
                    >
                      {isBatchSaving ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Menyimpan {excelResult.liveSessions.length} Sesi ke Supabase...
                        </>
                      ) : (
                        <>
                          <Zap className="h-3.5 w-3.5" />
                          Simpan Semua {excelResult.liveSessions.length} Sesi ke Supabase (Sinkron Realtime)
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={removeExcelData}
                      className="w-full sm:w-auto text-xs h-9 text-slate-600 border-slate-200 dark:border-slate-700"
                    >
                      Tutup File
                    </Button>
                  </div>
                </div>
              ) : !compressionData ? (
                <div className="relative border-2 border-dashed border-pink-300 dark:border-pink-800 hover:border-pink-500 rounded-xl p-4 text-center transition-all bg-white/70 dark:bg-slate-900/70 hover:bg-pink-50/20 cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,.xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    disabled={isSubmitting || isCompressing || isScanningAI || isParsingExcel || isBatchSaving}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                  />
                  {isCompressing || isScanningAI || isParsingExcel ? (
                    <div className="py-2.5 flex flex-col items-center space-y-2">
                      <Loader2 className="h-6 w-6 text-pink-600 animate-spin" />
                      <p className="text-xs font-semibold text-pink-600 dark:text-pink-400 animate-pulse">
                        {isParsingExcel
                          ? '📊 Mengekstrak & mengagregasi data sesi dari file Excel/CSV...'
                          : isCompressing 
                          ? 'Mengompres gambar di browser...' 
                          : '🤖 AI sedang memindai metrik live dari screenshot...'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {isParsingExcel
                          ? 'Mengelompokkan per ID Konten, menghitung GMV, durasi & produk terjual'
                          : 'Mengekstrak Durasi, GMV, Tayangan & Impresi secara otomatis'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="h-10 w-10 mx-auto rounded-full bg-pink-100 dark:bg-pink-950 flex items-center justify-center text-pink-600">
                        <UploadCloud className="h-5 w-5" />
                      </div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Klik atau seret Screenshot Live atau File Excel / CSV TikTok ke sini
                      </div>
                      <p className="text-[11px] text-pink-600 dark:text-pink-400 font-medium">
                        ✨ Sistem otomatis membaca GMV, Durasi, Tanggal, dan metrik langsung ke kolom form!
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Mendukung screenshot end-live TikTok & file ekspor pesanan TikTok Shop (.xlsx / .csv).
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-900 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge variant="success" className="text-[10px] gap-1 py-0">
                        <Zap className="h-3 w-3" /> Hemat {compressionData.ratioPercent}%
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {formatFileSize(compressionData.originalSizeKB)} ➔ {formatFileSize(compressionData.compressedSizeKB)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isScanningAI}
                        onClick={() => triggerAiScan(compressionData.file)}
                        className="h-7 text-[10px] px-2 text-pink-600 border-pink-200 dark:border-pink-800 hover:bg-pink-50 gap-1"
                      >
                        <RefreshCw className={`h-3 w-3 ${isScanningAI ? 'animate-spin' : ''}`} />
                        <span>Pindai Ulang via AI</span>
                      </Button>

                      <button
                        type="button"
                        onClick={removeSelectedImage}
                        title="Hapus gambar"
                        className="p-1 rounded-full text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {isScanningAI && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-pink-50 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300 text-xs">
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      <span>AI Vision sedang membaca angka metrik dari screenshot...</span>
                    </div>
                  )}

                  <div className="relative rounded-lg overflow-hidden border max-h-48 bg-black/5 flex items-center justify-center">
                    <img
                      src={compressionData.previewUrl}
                      alt="Preview Bukti GMV"
                      className="max-h-48 w-auto object-contain rounded"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* SEKSI 2: DETAIL AKUN TIKTOK & TANGGAL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Akun TikTok */}
              <div className="space-y-1.5">
                <Label htmlFor="akun_tiktok" className="text-xs font-semibold flex items-center gap-1.5">
                  <AtSign className="h-3.5 w-3.5 text-pink-500" />
                  Akun TikTok Live
                </Label>
                <Input
                  id="akun_tiktok"
                  type="text"
                  placeholder="Contoh: @wangigaya"
                  className={`text-sm ${errors.akun_tiktok ? 'border-red-500' : ''}`}
                  disabled={isSubmitting}
                  {...register('akun_tiktok')}
                />
                {/* Sugesti Akun Cepat */}
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {SUGGESTED_ACCOUNTS.map((acc) => (
                    <button
                      key={acc}
                      type="button"
                      onClick={() => {
                        setValue('akun_tiktok', acc, { shouldValidate: true })
                        try {
                          localStorage.setItem('last_akun_tiktok', acc)
                        } catch {}
                      }}
                      className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
                        currentAccount === acc
                          ? 'bg-pink-600 text-white border-pink-600 font-semibold'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-pink-300'
                      }`}
                    >
                      {acc}
                    </button>
                  ))}
                </div>
                {errors.akun_tiktok && (
                  <p className="text-[11px] text-red-500 font-medium">{errors.akun_tiktok.message}</p>
                )}
              </div>

              {/* Tanggal Live */}
              <div className="space-y-1.5">
                <Label htmlFor="tanggal" className="text-xs font-semibold flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-pink-500" />
                  Tanggal Live
                </Label>
                <Input
                  id="tanggal"
                  type="date"
                  className={`text-sm ${errors.tanggal ? 'border-red-500' : ''}`}
                  disabled={isSubmitting}
                  {...register('tanggal')}
                />
                {errors.tanggal && (
                  <p className="text-[11px] text-red-500 font-medium">{errors.tanggal.message}</p>
                )}
              </div>
            </div>

            {/* SEKSI 3: DURASI & GMV */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Durasi Live (Menit) */}
              <div className="space-y-1.5">
                <Label htmlFor="durasi_menit" className="text-xs font-semibold flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-pink-500" />
                  Durasi Live (Menit)
                </Label>
                <Input
                  id="durasi_menit"
                  type="number"
                  min="1"
                  placeholder="Contoh: 120"
                  className={`text-sm ${errors.durasi_menit ? 'border-red-500' : ''}`}
                  disabled={isSubmitting}
                  {...register('durasi_menit')}
                />
                {/* Quick Duration Pills */}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {QUICK_DURATIONS.map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setValue('durasi_menit', dur, { shouldValidate: true })}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                        Number(currentDurasi) === dur
                          ? 'bg-pink-600 text-white border-pink-600 font-semibold'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-pink-400'
                      }`}
                    >
                      {dur} Mnt
                    </button>
                  ))}
                </div>
                {errors.durasi_menit && (
                  <p className="text-[11px] text-red-500 font-medium">{errors.durasi_menit.message}</p>
                )}
              </div>

              {/* GMV Rupiah */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="gmv_rupiah" className="text-xs font-semibold flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-pink-500" />
                    Total GMV Penjualan (Rupiah)
                  </Label>
                  <span className="text-xs font-bold text-pink-600 dark:text-pink-400">
                    {formatRupiah(Number(currentGMV))}
                  </span>
                </div>
                <Input
                  id="gmv_rupiah"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Contoh: 24500"
                  className={`text-sm font-mono ${errors.gmv_rupiah ? 'border-red-500' : ''}`}
                  disabled={isSubmitting}
                  {...register('gmv_rupiah')}
                />
                {errors.gmv_rupiah && (
                  <p className="text-[11px] text-red-500 font-medium">{errors.gmv_rupiah.message}</p>
                )}
              </div>
            </div>

            {/* SEKSI 4: TAYANGAN & IMPRESI */}
            <div className="grid grid-cols-2 gap-3">
              {/* Tayangan */}
              <div className="space-y-1.5">
                <Label htmlFor="tayangan" className="text-xs font-semibold flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-pink-500" />
                  Tayangan (Views)
                </Label>
                <Input
                  id="tayangan"
                  type="number"
                  min="0"
                  placeholder="0"
                  className={`text-sm font-mono ${errors.tayangan ? 'border-red-500' : ''}`}
                  disabled={isSubmitting}
                  {...register('tayangan')}
                />
                {errors.tayangan && (
                  <p className="text-[11px] text-red-500 font-medium">{errors.tayangan.message}</p>
                )}
              </div>

              {/* Impresi */}
              <div className="space-y-1.5">
                <Label htmlFor="impresi" className="text-xs font-semibold flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-pink-500" />
                  Impresi / Interaksi
                </Label>
                <Input
                  id="impresi"
                  type="number"
                  min="0"
                  placeholder="0"
                  className={`text-sm font-mono ${errors.impresi ? 'border-red-500' : ''}`}
                  disabled={isSubmitting}
                  {...register('impresi')}
                />
                {errors.impresi && (
                  <p className="text-[11px] text-red-500 font-medium">{errors.impresi.message}</p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting || isCompressing || isScanningAI}
              className="w-full bg-pink-600 hover:bg-pink-700 text-white font-semibold shadow-md shadow-pink-500/20 mt-3 h-10"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan Laporan ke Supabase...
                </>
              ) : (
                'Kirim Laporan TikTok Live'
              )}
            </Button>
          </CardContent>
        </form>
      </Card>

      {/* Riwayat Laporan Terakhir Host */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-white/60 dark:bg-slate-900/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <History className="h-4 w-4 text-slate-500" />
              <CardTitle className="text-sm font-semibold">Laporan Anda yang Telah Terkirim</CardTitle>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              Tersimpan di Supabase
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingHistory ? (
            <div className="py-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-pink-500" />
              Memuat riwayat laporan...
            </div>
          ) : historyList.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Belum ada laporan sesi live TikTok yang Anda kirimkan.
            </p>
          ) : (
            <div className="space-y-2.5">
              {historyList.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs space-y-2 shadow-sm"
                >
                  <div className="flex items-center justify-between font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="text-pink-600 dark:text-pink-400 font-bold text-sm">
                        {formatRupiah(Number(item.gmv_rupiah))}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-600 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                        {item.akun_tiktok || DEFAULT_TIKTOK_ACCOUNT}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-normal">{item.tanggal}</span>
                      {(onEditReport || onDeleteReport) && (
                        <div className="flex items-center gap-1 ml-2">
                          {onEditReport && (
                            <button
                              type="button"
                              onClick={() => onEditReport(item)}
                              title="Edit Laporan"
                              className="p-1 sm:p-1.5 rounded-md text-slate-500 hover:text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/50 cursor-pointer active:scale-95 transition-all"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {onDeleteReport && (
                            <button
                              type="button"
                              onClick={() => onDeleteReport(item)}
                              title="Hapus Laporan"
                              className="p-1 sm:p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer active:scale-95 transition-all"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 border-t pt-1.5 border-slate-100 dark:border-slate-800">
                    <span>Durasi: {item.durasi_menit} Menit</span>
                    <span>Tayangan: {item.tayangan.toLocaleString('id-ID')}</span>
                    <span>Impresi: {item.impresi.toLocaleString('id-ID')}</span>
                  </div>
                  {item.foto_bukti_url && (
                    <div className="pt-1">
                      <a
                        href={item.foto_bukti_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        <ImageIcon className="h-3 w-3" />
                        Lihat Screenshot Bukti Terunggah
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
