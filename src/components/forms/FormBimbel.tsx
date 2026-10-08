import React, { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Murid, LaporanBimbel } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  GraduationCap, 
  Calendar, 
  User, 
  BookOpen, 
  FileText, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  History,
  Sparkles
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

export const FormBimbel: React.FC = () => {
  const { user } = useAuth()
  const [muridList, setMuridList] = useState<Murid[]>([])
  const [historyList, setHistoryList] = useState<LaporanBimbel[]>([])
  const [isLoadingMurid, setIsLoadingMurid] = useState(true)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
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

  // 2. Fetch Riwayat Laporan Milik Tutor Ini (RLS Protected)
  const fetchHistory = useCallback(async () => {
    if (!user?.id) return
    setIsLoadingHistory(true)
    try {
      const { data, error } = await supabase
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
        .limit(5)

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

  // 3. Submit Handler
  const onSubmit = async (values: BimbelFormValues) => {
    if (!user?.id) {
      setErrorMessage('Sesi otentikasi tidak ditemukan. Silakan login ulang.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    setSubmitSuccess(null)

    try {
      const { error } = await supabase.from('laporan_bimbel').insert({
        tutor_id: user.id,
        murid_id: values.murid_id,
        tanggal: values.tanggal,
        mata_pelajaran: values.mata_pelajaran.trim(),
        topik: values.topik.trim(),
        ringkasan: values.ringkasan.trim(),
      })

      if (error) throw error

      setSubmitSuccess('Laporan sesi bimbel berhasil disimpan ke Supabase!')
      reset({
        tanggal: todayStr,
        murid_id: '',
        mata_pelajaran: '',
        topik: '',
        ringkasan: '',
      })
      await fetchHistory()
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
              <Label htmlFor="murid_id" className="text-xs font-semibold flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-blue-500" />
                Nama Murid
              </Label>
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

            {/* Mata Pelajaran & Quick Select Pills */}
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
              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {QUICK_SUBJECTS.map((subject) => (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => setValue('mata_pelajaran', subject, { shouldValidate: true })}
                    className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                      selectedMapel === subject
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                    }`}
                  >
                    {subject}
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

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-500/20 mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan Laporan...
                </>
              ) : (
                'Kirim Laporan Bimbel'
              )}
            </Button>
          </CardContent>
        </form>
      </Card>

      {/* Riwayat Laporan Terakhir Tutor */}
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
            <div className="space-y-2.5">
              {historyList.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs space-y-1.5 shadow-sm"
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <User className="h-3 w-3 text-blue-500" />
                      {item.murid?.nama || 'Murid'} ({item.murid?.tingkat_kelas || 'Kelas'})
                    </span>
                    <span className="text-slate-500 font-normal">{item.tanggal}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50/50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                      {item.mata_pelajaran}
                    </Badge>
                    <span className="text-slate-700 dark:text-slate-300 font-medium truncate">
                      {item.topik}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px] line-clamp-2">
                    {item.ringkasan}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
