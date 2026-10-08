import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { supabase } from '@/lib/supabase'
import { Murid } from '@/types'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { UserCog, X, User, GraduationCap, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

const editMuridSchema = z.object({
  nama: z.string().min(2, 'Nama siswa minimal 2 karakter'),
  tingkat_kelas: z.string().min(2, 'Tingkat kelas minimal 2 karakter'),
})

type EditMuridFormValues = z.infer<typeof editMuridSchema>

interface EditMuridModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  murid: Murid | null
}

export const EditMuridModal: React.FC<EditMuridModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  murid,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditMuridFormValues>({
    resolver: zodResolver(editMuridSchema),
  })

  useEffect(() => {
    if (murid) {
      reset({
        nama: murid.nama,
        tingkat_kelas: murid.tingkat_kelas,
      })
      setErrorMessage(null)
      setSuccessMessage(null)
    }
  }, [murid, reset])

  const onSubmit = async (values: EditMuridFormValues) => {
    if (!murid?.id) return

    setIsSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const { error } = await supabase
        .from('murid')
        .update({
          nama: values.nama.trim(),
          tingkat_kelas: values.tingkat_kelas.trim(),
        })
        .eq('id', murid.id)

      if (error) throw error

      setSuccessMessage(`Data siswa ${values.nama} berhasil diperbarui!`)
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1200)
    } catch (err: any) {
      console.error('Error updating murid:', err)
      setErrorMessage(err.message || 'Gagal memperbarui data siswa.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen || !murid) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <Card className="w-full max-w-md shadow-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <div className="flex items-center space-x-2.5">
            <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <UserCog className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Edit Data Siswa</CardTitle>
              <CardDescription className="text-xs">
                Perbarui nama lengkap atau jenjang kelas siswa
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
          <CardContent className="p-5 space-y-4">
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

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-slate-500" />
                Nama Lengkap Siswa
              </Label>
              <Input
                placeholder="Contoh: Muhammad Rafa"
                className="text-xs"
                disabled={isSubmitting}
                {...register('nama')}
              />
              {errors.nama && (
                <p className="text-[11px] text-red-500 font-medium">{errors.nama.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5 text-slate-500" />
                Tingkat / Jenjang Kelas
              </Label>
              <Input
                placeholder="Contoh: SD Kelas 5 / SMP Kelas 8"
                className="text-xs"
                disabled={isSubmitting}
                {...register('tingkat_kelas')}
              />
              {errors.tingkat_kelas && (
                <p className="text-[11px] text-red-500 font-medium">{errors.tingkat_kelas.message}</p>
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs shadow-md shadow-emerald-500/20"
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
