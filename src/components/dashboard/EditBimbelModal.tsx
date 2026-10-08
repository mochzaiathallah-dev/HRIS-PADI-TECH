import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { supabase } from '@/lib/supabase'
import { LaporanBimbel, Murid } from '@/types'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { 
  GraduationCap, 
  X, 
  Calendar, 
  User, 
  BookOpen, 
  FileText, 
  Loader2, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react'

const editBimbelSchema = z.object({
  tanggal: z.string().min(1, 'Tanggal wajib diisi'),
  murid_id: z.string().min(1, 'Siswa wajib dipilih'),
  mata_pelajaran: z.string().min(2, 'Mata pelajaran minimal 2 karakter'),
  topik: z.string().min(3, 'Topik minimal 3 karakter'),
  ringkasan: z.string().min(5, 'Ringkasan minimal 5 karakter'),
})

type EditBimbelFormValues = z.infer<typeof editBimbelSchema>

interface EditBimbelModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  laporan: LaporanBimbel | null
  muridList: Murid[]
}

export const EditBimbelModal: React.FC<EditBimbelModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  laporan,
  muridList,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditBimbelFormValues>({
    resolver: zodResolver(editBimbelSchema),
  })

  useEffect(() => {
    if (laporan) {
      reset({
        tanggal: laporan.tanggal,
        murid_id: laporan.murid_id,
        mata_pelajaran: laporan.mata_pelajaran,
        topik: laporan.topik,
        ringkasan: laporan.ringkasan,
      })
      setErrorMessage(null)
      setSuccessMessage(null)
    }
  }, [laporan, reset])

  const onSubmit = async (values: EditBimbelFormValues) => {
    if (!laporan?.id) return

    setIsSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const { error } = await supabase
        .from('laporan_bimbel')
        .update({
          tanggal: values.tanggal,
          murid_id: values.murid_id,
          mata_pelajaran: values.mata_pelajaran.trim(),
          topik: values.topik.trim(),
          ringkasan: values.ringkasan.trim(),
        })
        .eq('id', laporan.id)

      if (error) throw error

      setSuccessMessage('Laporan sesi bimbel berhasil diperbarui!')
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1200)
    } catch (err: any) {
      console.error('Error updating bimbel report:', err)
      setErrorMessage(err.message || 'Gagal memperbarui laporan bimbel.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen || !laporan) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <Card className="w-full max-w-lg shadow-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <div className="flex items-center space-x-2.5">
            <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Edit Laporan Bimbel</CardTitle>
              <CardDescription className="text-xs">
                Perbarui detail sesi bimbingan belajar siswa
              </CardDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {successMessage && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                <span className="font-medium">{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="font-medium leading-relaxed">{errorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Tanggal */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-500" />
                  Tanggal Sesi
                </Label>
                <Input
                  type="date"
                  className="text-xs"
                  disabled={isSubmitting}
                  {...register('tanggal')}
                />
                {errors.tanggal && (
                  <p className="text-[11px] text-red-500 font-medium">{errors.tanggal.message}</p>
                )}
              </div>

              {/* Murid */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-500" />
                  Siswa Binaan
                </Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm focus:outline-none dark:bg-slate-900"
                  disabled={isSubmitting}
                  {...register('murid_id')}
                >
                  <option value="">Pilih Siswa...</option>
                  {muridList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nama} ({m.tingkat_kelas})
                    </option>
                  ))}
                </select>
                {errors.murid_id && (
                  <p className="text-[11px] text-red-500 font-medium">{errors.murid_id.message}</p>
                )}
              </div>
            </div>

            {/* Mata Pelajaran */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-slate-500" />
                Mata Pelajaran
              </Label>
              <Input
                placeholder="Contoh: Matematika"
                className="text-xs"
                disabled={isSubmitting}
                {...register('mata_pelajaran')}
              />
              {errors.mata_pelajaran && (
                <p className="text-[11px] text-red-500 font-medium">{errors.mata_pelajaran.message}</p>
              )}
            </div>

            {/* Topik */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-slate-500" />
                Topik / Materi Pembelajaran
              </Label>
              <Input
                placeholder="Contoh: Operasi Pecahan Desimal"
                className="text-xs"
                disabled={isSubmitting}
                {...register('topik')}
              />
              {errors.topik && (
                <p className="text-[11px] text-red-500 font-medium">{errors.topik.message}</p>
              )}
            </div>

            {/* Ringkasan */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-slate-500" />
                Ringkasan & Catatan Belajar
              </Label>
              <Textarea
                rows={4}
                placeholder="Tuliskan catatan kemajuan siswa..."
                className="text-xs"
                disabled={isSubmitting}
                {...register('ringkasan')}
              />
              {errors.ringkasan && (
                <p className="text-[11px] text-red-500 font-medium">{errors.ringkasan.message}</p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex items-center justify-between border-t p-4 bg-slate-50 dark:bg-slate-900/50">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs"
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs shadow-md shadow-blue-500/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Simpan Perubahan'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
