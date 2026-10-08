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
  Zap
} from 'lucide-react'

const tiktokSchema = z.object({
  tanggal: z.string().min(1, 'Tanggal sesi live wajib diisi'),
  durasi_menit: z.coerce.number().min(1, 'Durasi live minimal 1 menit'),
  gmv_rupiah: z.coerce.number().min(0, 'GMV tidak boleh negatif'),
  tayangan: z.coerce.number().min(0, 'Tayangan tidak boleh negatif'),
  impresi: z.coerce.number().min(0, 'Impresi tidak boleh negatif'),
})

type TikTokFormValues = z.infer<typeof tiktokSchema>

const QUICK_DURATIONS = [30, 60, 90, 120, 180]

export const FormTikTok: React.FC = () => {
  const { user } = useAuth()
  const [historyList, setHistoryList] = useState<LaporanTiktok[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCompressing, setIsCompressing] = useState(false)
  const [compressionData, setCompressionData] = useState<CompressionResult | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const todayStr = new Date().toISOString().split('T')[0]

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
      tanggal: todayStr,
      durasi_menit: 60,
      gmv_rupiah: 0,
      tayangan: 0,
      impresi: 0,
    },
  })

  const currentGMV = watch('gmv_rupiah') || 0
  const currentDurasi = watch('durasi_menit') || 0

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
  }, [fetchHistory])

  // 2. Client-Side Image Handling & Compression
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsCompressing(true)
    setErrorMessage(null)

    try {
      const result = await compressClientImage(file)
      setCompressionData(result)
    } catch (err) {
      console.error('Compression error:', err)
      setErrorMessage('Gagal memproses gambar. Pastikan format file adalah JPG/PNG/WEBP.')
    } finally {
      setIsCompressing(false)
    }
  }

  const removeSelectedImage = () => {
    if (compressionData?.previewUrl) {
      URL.revokeObjectURL(compressionData.previewUrl)
    }
    setCompressionData(null)
  }

  // 3. Format Rupiah Currency Helper
  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val)
  }

  // 4. Submit Handler (Upload Bucket + Insert Supabase Table)
  const onSubmit = async (values: TikTokFormValues) => {
    if (!user?.id) {
      setErrorMessage('Sesi otentikasi tidak ditemukan. Silakan login ulang.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    setSubmitSuccess(null)

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
          // Lanjutkan simpan data laporan meskipun upload foto kendala
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('bukti_tiktok')
            .getPublicUrl(fileName)
          fotoBuktiUrl = publicUrlData.publicUrl
        }
      }

      // B. Insert ke Tabel laporan_tiktok
      const { error: insertError } = await supabase.from('laporan_tiktok').insert({
        host_id: user.id,
        tanggal: values.tanggal,
        durasi_menit: values.durasi_menit,
        gmv_rupiah: values.gmv_rupiah,
        tayangan: values.tayangan,
        impresi: values.impresi,
        foto_bukti_url: fotoBuktiUrl,
      })

      if (insertError) throw insertError

      setSubmitSuccess('Laporan performa TikTok Live berhasil dikirim ke Supabase!')
      removeSelectedImage()
      reset({
        tanggal: todayStr,
        durasi_menit: 60,
        gmv_rupiah: 0,
        tayangan: 0,
        impresi: 0,
      })
      await fetchHistory()
    } catch (err: any) {
      console.error('Gagal submit laporan tiktok:', err)
      setErrorMessage(err.message || 'Gagal menyimpan laporan TikTok. Periksa koneksi atau hak akses database.')
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
                <CardDescription className="text-xs">Catat performa penjualan GMV dan impresi live</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] text-pink-600 dark:text-pink-400 border-pink-200 dark:border-pink-900">
              Host Portal
            </Badge>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {/* Feedback Banners */}
            {submitSuccess && (
              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs animate-in fade-in">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                <span className="font-medium">{submitSuccess}</span>
              </div>
            )}

            {errorMessage && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs animate-in fade-in">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="font-medium">{errorMessage}</span>
              </div>
            )}

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
              <div className="flex flex-wrap gap-1.5 pt-1">
                {QUICK_DURATIONS.map((dur) => (
                  <button
                    key={dur}
                    type="button"
                    onClick={() => setValue('durasi_menit', dur, { shouldValidate: true })}
                    className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-colors ${
                      Number(currentDurasi) === dur
                        ? 'bg-pink-600 text-white border-pink-600'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-pink-400'
                    }`}
                  >
                    {dur} Menit
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
                step="1000"
                placeholder="Contoh: 5000000"
                className={`text-sm font-mono ${errors.gmv_rupiah ? 'border-red-500' : ''}`}
                disabled={isSubmitting}
                {...register('gmv_rupiah')}
              />
              {errors.gmv_rupiah && (
                <p className="text-[11px] text-red-500 font-medium">{errors.gmv_rupiah.message}</p>
              )}
            </div>

            {/* Grid Tayangan & Impresi */}
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

            {/* Upload & Client-Side Image Compression */}
            <div className="space-y-2 pt-1">
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5 text-pink-500" />
                  Foto Bukti Screenshot GMV / Live
                </span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  Kompresi Otomatis Klien
                </span>
              </Label>

              {!compressionData ? (
                <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-pink-500 dark:hover:border-pink-500 rounded-xl p-4 text-center transition-colors bg-slate-50/50 dark:bg-slate-900/50">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    disabled={isSubmitting || isCompressing}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  {isCompressing ? (
                    <div className="py-2 flex flex-col items-center space-y-2">
                      <Loader2 className="h-6 w-6 text-pink-500 animate-spin" />
                      <p className="text-xs font-medium text-pink-600 animate-pulse">
                        Mengompres gambar di browser Anda...
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <UploadCloud className="h-7 w-7 mx-auto text-muted-foreground" />
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Klik atau seret foto bukti GMV ke sini
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        PNG, JPG, JPEG (Dikompresi otomatis ke WebP hemat kuota)
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-900/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge variant="success" className="text-[10px] gap-1 py-0">
                        <Zap className="h-3 w-3" /> Hemat {compressionData.ratioPercent}%
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {formatFileSize(compressionData.originalSizeKB)} ➔ {formatFileSize(compressionData.compressedSizeKB)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={removeSelectedImage}
                      className="p-1 rounded-full text-slate-400 hover:text-red-500 hover:bg-slate-200 dark:hover:bg-slate-800"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="relative rounded-lg overflow-hidden border max-h-48 bg-black/10 flex items-center justify-center">
                    <img
                      src={compressionData.previewUrl}
                      alt="Preview Bukti GMV"
                      className="max-h-48 w-auto object-contain rounded"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting || isCompressing}
              className="w-full bg-pink-600 hover:bg-pink-700 text-white font-semibold shadow-md shadow-pink-500/20 mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Mengunggah & Menyimpan Laporan...
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
                    <span className="text-pink-600 dark:text-pink-400 font-bold text-sm">
                      {formatRupiah(Number(item.gmv_rupiah))}
                    </span>
                    <span className="text-slate-500 font-normal">{item.tanggal}</span>
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
                        Lihat Foto Bukti Terunggah
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
