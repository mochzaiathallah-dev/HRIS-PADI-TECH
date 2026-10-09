import React, { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Murid, LaporanBimbel } from '@/types'
import { compressClientImage, CompressionResult, formatFileSize } from '@/lib/imageCompressor'
import { parsePhotoUrls, serializePhotoUrls, formatWhatsAppPhotoLinks } from '@/lib/photoUtils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AddMuridModal } from '@/components/dashboard/AddMuridModal'
import { 
  GraduationCap, 
  Calendar, 
  User, 
  UserPlus,
  BookOpen, 
  FileText, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  History,
  Sparkles,
  Camera,
  Image as ImageIcon,
  X,
  Share2,
  Edit,
  Trash2
} from 'lucide-react'

const bimbelSchema = z.object({
  tanggal: z.string().min(1, 'Tanggal sesi mengajar wajib diisi'),
  murid_id: z.string().min(1, 'Silakan pilih siswa yang diajar'),
  mata_pelajaran: z.string().min(2, 'Mata pelajaran minimal 2 karakter'),
  topik: z.string().min(3, 'Topik/materi pembelajaran minimal 3 karakter'),
  ringkasan: z.string().min(5, 'Ringkasan pembelajaran minimal 5 karakter'),
})

type BimbelFormValues = z.infer<typeof bimbelSchema>

const QUICK_SUBJECTS = [
  'Matematika',
  'Bahasa Inggris',
  'IPA (Sains)',
  'IPS',
  'Bahasa Indonesia',
  'Calistung',
  'Fisika',
  'Kimia',
]

interface FormBimbelProps {
  onReportCreated?: () => void
  onEditReport?: (report: LaporanBimbel) => void
  onDeleteReport?: (report: LaporanBimbel) => void
}

export const FormBimbel: React.FC<FormBimbelProps> = ({
  onReportCreated,
  onEditReport,
  onDeleteReport,
}) => {
  const { user } = useAuth()
  const [muridList, setMuridList] = useState<Murid[]>([])
  const [historyList, setHistoryList] = useState<LaporanBimbel[]>([])
  const [isLoadingMurid, setIsLoadingMurid] = useState(true)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCompressing, setIsCompressing] = useState(false)
  const [compressedImages, setCompressedImages] = useState<CompressionResult[]>([])
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastSubmittedReport, setLastSubmittedReport] = useState<{
    namaMurid: string
    kelas?: string
    tanggal: string
    mapel: string
    topik: string
    ringkasan: string
    fotoUrls: string[]
  } | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [isAddMuridModalOpen, setIsAddMuridModalOpen] = useState(false)

  const todayStr = new Date().toISOString().split('T')[0]

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<BimbelFormValues>({
    resolver: zodResolver(bimbelSchema),
    defaultValues: {
      tanggal: todayStr,
      murid_id: '',
      mata_pelajaran: '',
      topik: '',
      ringkasan: '',
    },
  })

  const selectedMapel = watch('mata_pelajaran')

  // 1. Fetch Daftar Murid
  const fetchMurid = useCallback(async () => {
    setIsLoadingMurid(true)
    try {
      const { data, error } = await supabase
        .from('murid')
        .select('*')
        .order('nama', { ascending: true })

      if (error) throw error
      if (data) setMuridList(data as Murid[])
    } catch (err: any) {
      console.warn('Notice fetching murid:', err.message)
    } finally {
      setIsLoadingMurid(false)
    }
  }, [])

  // Callback saat murid baru berhasil didaftarkan oleh tutor
  const handleMuridCreated = (newMurid: { id: string; nama: string; tingkat_kelas: string }) => {
    setMuridList((prev) => {
      const exists = prev.some((m) => m.id === newMurid.id)
      if (exists) return prev
      return [...prev, newMurid as Murid].sort((a, b) => a.nama.localeCompare(b.nama))
    })
    setValue('murid_id', newMurid.id, { shouldValidate: true })
  }

  // 2. Fetch Riwayat Laporan Milik Tutor Ini (RLS Protected)
  const fetchHistory = useCallback(async () => {
    if (!user?.id) return
    setIsLoadingHistory(true)
    try {
      let data: any = null
      let error: any = null

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
        .limit(10)

      data = firstAttempt.data
      error = firstAttempt.error

      if (error && error.message.includes('foto_kegiatan_url')) {
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
          .limit(10)
        data = fallbackRes.data
        error = fallbackRes.error
      }

      if (error) throw error
      if (data) setHistoryList(data as unknown as LaporanBimbel[])
    } catch (err: any) {
      console.warn('Notice fetching history bimbel:', err.message)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchMurid()
    fetchHistory()
  }, [fetchMurid, fetchHistory])

  // Realtime subscription untuk sinkronisasi murid di frontend tutor
  useEffect(() => {
    const channel = supabase
      .channel('realtime_form_bimbel_murid_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'murid' }, () => {
        fetchMurid()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchMurid])

  // 3. Client-Side Image Selection & Compression (Mendukung Lebih dari 1 Foto, Auto WebP)
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsCompressing(true)
    setErrorMessage(null)

    try {
      const remainingSlots = 5 - compressedImages.length
      if (remainingSlots <= 0) {
        alert('Maksimal 5 foto dokumentasi per sesi mengajar.')
        setIsCompressing(false)
        return
      }

      const filesToProcess = Array.from(files).slice(0, remainingSlots)
      const newCompressed: CompressionResult[] = []

      for (const file of filesToProcess) {
        const res = await compressClientImage(file)
        newCompressed.push(res)
      }

      setCompressedImages((prev) => [...prev, ...newCompressed])
    } catch (err) {
      console.error('Compression error:', err)
      setErrorMessage('Gagal memproses gambar. Pastikan format file JPG, PNG, atau WEBP.')
    } finally {
      setIsCompressing(false)
      e.target.value = ''
    }
  }

  const removeSelectedImage = (index: number) => {
    setCompressedImages((prev) => {
      const target = prev[index]
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl)
      }
      return prev.filter((_, i) => i !== index)
    })
  }

  const clearAllImages = () => {
    compressedImages.forEach((c) => {
      if (c.previewUrl) URL.revokeObjectURL(c.previewUrl)
    })
    setCompressedImages([])
  }

  // 4. WhatsApp Share Helper (Format Bersih Tanpa Teks Bawah)
  const shareToWhatsApp = (report: {
    namaMurid: string
    kelas?: string
    tanggal: string
    mapel: string
    topik: string
    ringkasan: string
    fotoUrls?: string[]
  }) => {
    const photoSection = formatWhatsAppPhotoLinks(report.fotoUrls || [])

    const text = `*LAPORAN KEGIATAN BELAJAR - BIMBEL PADI TECH*

📅 *Tanggal Sesi:* ${report.tanggal}
👤 *Siswa:* ${report.namaMurid} ${report.kelas ? `(${report.kelas})` : ''}
📚 *Mata Pelajaran:* ${report.mapel}
🎯 *Topik / Materi:* ${report.topik}

📝 *Catatan & Evaluasi Pembelajaran:*
${report.ringkasan}${photoSection}`

    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
    window.open(waUrl, '_blank')
  }

  // 5. Submit Handler (Upload Semua Foto & Simpan ke Supabase)
  const onSubmit = async (values: BimbelFormValues) => {
    if (!user?.id) {
      setErrorMessage('Sesi otentikasi tidak ditemukan. Silakan login ulang.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    setSubmitSuccess(null)

    try {
      const uploadedUrls: string[] = []

      // A. Upload Semua Foto Terkompresi ke Supabase Storage (Bucket bukti_tiktok)
      if (compressedImages.length > 0) {
        for (let idx = 0; idx < compressedImages.length; idx++) {
          const item = compressedImages[idx]
          const fileExt = 'webp'
          const fileName = `bimbel/${user.id}/${Date.now()}_${idx + 1}.${fileExt}`

          const { error: uploadError } = await supabase.storage
            .from('bukti_tiktok')
            .upload(fileName, item.file, {
              cacheControl: '3600',
              upsert: true,
            })

          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage
              .from('bukti_tiktok')
              .getPublicUrl(fileName)
            uploadedUrls.push(publicUrlData.publicUrl)
          } else {
            console.warn('Storage upload note:', uploadError.message)
          }
        }
      }

      const serializedFotoUrl = serializePhotoUrls(uploadedUrls)

      // B. Insert Data Laporan Bimbel ke Supabase Table
      const insertPayload: any = {
        tutor_id: user.id,
        murid_id: values.murid_id,
        tanggal: values.tanggal,
        mata_pelajaran: values.mata_pelajaran.trim(),
        topik: values.topik.trim(),
        ringkasan: values.ringkasan.trim(),
        foto_kegiatan_url: serializedFotoUrl,
      }

      let { error } = await supabase.from('laporan_bimbel').insert(insertPayload)

      if (error && error.message.includes('foto_kegiatan_url')) {
        delete insertPayload.foto_kegiatan_url
        const retryRes = await supabase.from('laporan_bimbel').insert(insertPayload)
        error = retryRes.error
      }

      if (error) throw error

      // Cari nama murid untuk preview WA
      const muridObj = muridList.find(m => m.id === values.murid_id)

      setLastSubmittedReport({
        namaMurid: muridObj ? muridObj.nama : 'Siswa',
        kelas: muridObj?.tingkat_kelas,
        tanggal: values.tanggal,
        mapel: values.mata_pelajaran.trim(),
        topik: values.topik.trim(),
        ringkasan: values.ringkasan.trim(),
        fotoUrls: uploadedUrls,
      })

      setSubmitSuccess(`Laporan sesi bimbel & ${uploadedUrls.length > 0 ? `${uploadedUrls.length} dokumentasi foto ` : ''}berhasil tersimpan ke Supabase!`)
      clearAllImages()
      reset({
        tanggal: todayStr,
        murid_id: '',
        mata_pelajaran: '',
        topik: '',
        ringkasan: '',
      })

      await fetchHistory()
      onReportCreated?.()
    } catch (err: any) {
      console.error('Gagal submit laporan bimbel:', err)
      setErrorMessage(err.message || 'Gagal menyimpan laporan. Periksa koneksi atau hak akses database.')
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
              <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Input Laporan Bimbel</CardTitle>
                <CardDescription className="text-xs">Catat aktivitas dan perkembangan siswa</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900">
              Tutor Portal
            </Badge>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {/* Feedback Banners */}
            {submitSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 space-y-2.5 animate-in fade-in">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 text-xs font-semibold">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span>{submitSuccess}</span>
                </div>
                {lastSubmittedReport && (
                  <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800/80 space-y-2">
                    {lastSubmittedReport.fotoUrls.length > 0 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                        <span className="text-[10px] text-emerald-800 dark:text-emerald-200 font-medium shrink-0">
                          Foto Terlampir ({lastSubmittedReport.fotoUrls.length}):
                        </span>
                        {lastSubmittedReport.fotoUrls.map((url, i) => (
                          <img
                            key={i}
                            src={url}
                            alt={`Preview ${i + 1}`}
                            className="h-10 w-10 rounded-md object-cover border border-emerald-300 dark:border-emerald-700 cursor-pointer shadow-xs hover:opacity-85"
                            onClick={() => setPreviewImage(url)}
                          />
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                        Bagikan langsung ke orang tua siswa:
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => shareToWhatsApp(lastSubmittedReport)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 gap-1.5 shadow-xs"
                      >
                        <Share2 className="h-3 w-3" />
                        Kirim ke WhatsApp
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {errorMessage && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs animate-in fade-in">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="font-medium">{errorMessage}</span>
              </div>
            )}

            {/* Tanggal Mengajar */}
            <div className="space-y-1.5">
              <Label htmlFor="tanggal" className="text-xs font-semibold flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-blue-500" />
                Tanggal Sesi
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

            {/* Pilih Murid */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="murid_id" className="text-xs font-semibold flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-blue-500" />
                  Nama Murid
                </Label>
                <button
                  type="button"
                  onClick={() => setIsAddMuridModalOpen(true)}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                  title="Tambah data siswa/murid baru langsung dari dashboard tutor"
                >
                  <UserPlus className="h-3 w-3" />
                  + Input Murid Baru
                </button>
              </div>
              <select
                id="murid_id"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900"
                disabled={isSubmitting || isLoadingMurid}
                {...register('murid_id')}
              >
                <option value="" disabled>
                  {isLoadingMurid ? 'Memuat data murid...' : '-- Pilih Murid / Siswa --'}
                </option>
                {muridList.map((m) => (
                  <option key={m.id} value={m.id} className="dark:bg-slate-900">
                    {m.nama} ({m.tingkat_kelas})
                  </option>
                ))}
              </select>
              {errors.murid_id && (
                <p className="text-[11px] text-red-500 font-medium">{errors.murid_id.message}</p>
              )}
            </div>

            {/* Mata Pelajaran & Quick Pills */}
            <div className="space-y-1.5">
              <Label htmlFor="mata_pelajaran" className="text-xs font-semibold flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-blue-500" />
                Mata Pelajaran
              </Label>
              <Input
                id="mata_pelajaran"
                placeholder="Contoh: Matematika, IPA, Bahasa Inggris"
                className={`text-sm ${errors.mata_pelajaran ? 'border-red-500' : ''}`}
                disabled={isSubmitting}
                {...register('mata_pelajaran')}
              />
              {/* Quick Pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {QUICK_SUBJECTS.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setValue('mata_pelajaran', sub, { shouldValidate: true })}
                    className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-all ${
                      selectedMapel === sub
                        ? 'bg-blue-600 text-white border-blue-600 font-medium shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
              {errors.mata_pelajaran && (
                <p className="text-[11px] text-red-500 font-medium">{errors.mata_pelajaran.message}</p>
              )}
            </div>

            {/* Topik / Materi Pembelajaran */}
            <div className="space-y-1.5">
              <Label htmlFor="topik" className="text-xs font-semibold flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                Topik / Materi Pembelajaran
              </Label>
              <Input
                id="topik"
                placeholder="Contoh: Operasi Hitung Pecahan & Soal Cerita"
                className={`text-sm ${errors.topik ? 'border-red-500' : ''}`}
                disabled={isSubmitting}
                {...register('topik')}
              />
              {errors.topik && (
                <p className="text-[11px] text-red-500 font-medium">{errors.topik.message}</p>
              )}
            </div>

            {/* Ringkasan Pembelajaran */}
            <div className="space-y-1.5">
              <Label htmlFor="ringkasan" className="text-xs font-semibold flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-blue-500" />
                Ringkasan & Catatan Evaluasi Siswa
              </Label>
              <Textarea
                id="ringkasan"
                rows={3}
                placeholder="Tuliskan pemahaman murid, kendala materi, atau PR yang diberikan..."
                className={`text-sm resize-none ${errors.ringkasan ? 'border-red-500' : ''}`}
                disabled={isSubmitting}
                {...register('ringkasan')}
              />
              {errors.ringkasan && (
                <p className="text-[11px] text-red-500 font-medium">{errors.ringkasan.message}</p>
              )}
            </div>

            {/* Upload Foto Dokumentasi (Dengan Auto WebP Compression) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5 text-blue-500" />
                  Foto Dokumentasi Sesi Belajar (Opsional)
                </span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  Kompresi WebP Otomatis
                </span>
              </Label>

              {/* Daftar Foto yang Telah Dipilih & Terkompresi */}
              {compressedImages.length > 0 && (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {compressedImages.map((img, idx) => (
                      <div
                        key={idx}
                        className="relative rounded-xl border border-blue-200 dark:border-blue-900 p-2 bg-blue-50/40 dark:bg-blue-950/20 flex items-center gap-2.5"
                      >
                        <img
                          src={img.previewUrl}
                          alt={`Foto ${idx + 1}`}
                          className="h-12 w-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700 cursor-pointer shrink-0 shadow-xs"
                          onClick={() => setPreviewImage(img.previewUrl)}
                        />
                        <div className="flex-1 min-w-0 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[11px] text-slate-800 dark:text-slate-200">
                              Foto {idx + 1}
                            </span>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-300">
                              Hemat {img.ratioPercent}%
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            {formatFileSize(img.originalSizeKB)} ➔ {formatFileSize(img.compressedSizeKB)} (WebP)
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSelectedImage(idx)}
                          disabled={isSubmitting}
                          className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
                          title="Hapus Foto Ini"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Input Button (Maksimal 5 Foto) */}
              {compressedImages.length < 5 && (
                <label className="flex flex-col items-center justify-center p-3.5 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-400 bg-slate-50/50 dark:bg-slate-900/50 cursor-pointer transition-colors group">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                    <ImageIcon className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    <span>
                      {isCompressing
                        ? 'Mengompresi gambar otomatis ke WebP...'
                        : compressedImages.length > 0
                        ? `Tambah Foto Dokumentasi (${compressedImages.length}/5)`
                        : 'Pilih Foto Dokumentasi Belajar (Bisa Lebih dari 1 Foto)'}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    Maksimal 5 foto • JPG/PNG/WEBP (otomatis dikompresi ringan & hemat kuota)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    disabled={isSubmitting || isCompressing}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting || isCompressing}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-500/20 mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan Laporan & Foto...
                </>
              ) : (
                'Kirim Laporan Bimbel'
              )}
            </Button>
          </CardContent>
        </form>
      </Card>

      {/* Riwayat Laporan Terakhir Tutor dengan Aksi CRUD & WhatsApp */}
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
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              Memuat riwayat laporan...
            </div>
          ) : historyList.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Belum ada laporan sesi bimbel yang Anda kirimkan.
            </p>
          ) : (
            <div className="space-y-3">
              {historyList.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs space-y-2 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-slate-900 dark:text-slate-100 font-bold flex items-center gap-1.5 text-xs">
                        <User className="h-3.5 w-3.5 text-blue-500" />
                        {item.murid?.nama || 'Murid'} {item.murid?.tingkat_kelas ? `(${item.murid.tingkat_kelas})` : ''}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {item.tanggal}
                      </span>
                    </div>

                    {/* Aksi Cepat: Edit, Delete, WA */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          shareToWhatsApp({
                            namaMurid: item.murid?.nama || 'Murid',
                            kelas: item.murid?.tingkat_kelas,
                            tanggal: item.tanggal,
                            mapel: item.mata_pelajaran,
                            topik: item.topik,
                            ringkasan: item.ringkasan,
                            fotoUrls: parsePhotoUrls(item.foto_kegiatan_url),
                          })
                        }
                        title="Bagikan ke WhatsApp"
                        className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                      </button>

                      {onEditReport && (
                        <button
                          type="button"
                          onClick={() => onEditReport(item)}
                          title="Edit Laporan"
                          className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {onDeleteReport && (
                        <button
                          type="button"
                          onClick={() => onDeleteReport(item)}
                          title="Hapus Laporan"
                          className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50/50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                      {item.mata_pelajaran}
                    </Badge>
                    <span className="text-slate-700 dark:text-slate-300 font-semibold truncate">
                      {item.topik}
                    </span>
                  </div>

                  <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                    {item.ringkasan}
                  </p>

                  {/* Thumbnail Foto Dokumentasi jika ada */}
                  {(() => {
                    const photos = parsePhotoUrls(item.foto_kegiatan_url)
                    if (photos.length === 0) return null
                    return (
                      <div className="pt-1.5 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-muted-foreground font-medium">
                          Dokumentasi ({photos.length}):
                        </span>
                        {photos.map((url, i) => (
                          <img
                            key={i}
                            src={url}
                            alt={`Dokumentasi ${i + 1}`}
                            className="h-9 w-9 rounded-md object-cover border border-slate-200 dark:border-slate-700 cursor-pointer shadow-xs hover:opacity-80 transition-opacity"
                            onClick={() => setPreviewImage(url)}
                            title="Klik untuk memperbesar"
                          />
                        ))}
                      </div>
                    )
                  })()}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Preview Foto */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-lg w-full bg-slate-900 rounded-2xl overflow-hidden p-2" onClick={e => e.stopPropagation()}>
            <img src={previewImage} alt="Preview Dokumentasi" className="w-full h-auto max-h-[80vh] object-contain rounded-xl" />
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-black/60 text-white hover:bg-black"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal Tambah Murid Baru Langsung Oleh Tutor */}
      <AddMuridModal
        isOpen={isAddMuridModalOpen}
        onClose={() => setIsAddMuridModalOpen(false)}
        onSuccess={() => fetchMurid()}
        onCreated={handleMuridCreated}
      />
    </div>
  )
}
