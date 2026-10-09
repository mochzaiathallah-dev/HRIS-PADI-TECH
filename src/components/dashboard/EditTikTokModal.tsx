import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { supabase } from '@/lib/supabase'
import { LaporanTiktok } from '@/types'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { 
  Video, 
  X, 
  Calendar, 
  Clock, 
  DollarSign, 
  Eye, 
  Activity, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  AtSign
} from 'lucide-react'

const editTikTokSchema = z.object({
  akun_tiktok: z.string().min(1, 'Akun TikTok wajib diisi (misal: @wangigaya)'),
  tanggal: z.string().min(1, 'Tanggal sesi wajib diisi'),
  durasi_menit: z.coerce.number().min(1, 'Durasi live minimal 1 menit'),
  gmv_rupiah: z.coerce.number().min(0, 'GMV tidak boleh negatif'),
  tayangan: z.coerce.number().min(0, 'Tayangan tidak boleh negatif'),
  impresi: z.coerce.number().min(0, 'Impresi tidak boleh negatif'),
})

type EditTikTokFormValues = z.infer<typeof editTikTokSchema>

interface EditTikTokModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  laporan: LaporanTiktok | null
}

export const EditTikTokModal: React.FC<EditTikTokModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  laporan,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditTikTokFormValues>({
    resolver: zodResolver(editTikTokSchema),
  })

  useEffect(() => {
    if (laporan) {
      reset({
        akun_tiktok: laporan.akun_tiktok || '@wangigaya',
        tanggal: laporan.tanggal,
        durasi_menit: laporan.durasi_menit,
        gmv_rupiah: laporan.gmv_rupiah,
        tayangan: laporan.tayangan,
        impresi: laporan.impresi,
      })
      setErrorMessage(null)
      setSuccessMessage(null)
    }
  }, [laporan, reset])

  const onSubmit = async (values: EditTikTokFormValues) => {
    if (!laporan?.id) return

    setIsSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      // 1. Jalankan Direct Update terlebih dahulu (mendukung seluruh kolom termasuk akun_tiktok)
      const updatePayload: any = {
        tanggal: values.tanggal,
        durasi_menit: values.durasi_menit,
        gmv_rupiah: values.gmv_rupiah,
        tayangan: values.tayangan,
        impresi: values.impresi,
        akun_tiktok: values.akun_tiktok,
      }

      let { error } = await supabase
        .from('laporan_tiktok')
        .update(updatePayload)
        .eq('id', laporan.id)

      if (error && (error.code === '42703' || error.message?.includes('akun_tiktok'))) {
        delete updatePayload.akun_tiktok
        const retry = await supabase
          .from('laporan_tiktok')
          .update(updatePayload)
          .eq('id', laporan.id)
        error = retry.error
      }

      // 2. Fallback via RPC Security Definer jika direct update terhalang RLS
      if (error) {
        console.warn('Direct update fallback to RPC:', error.message)
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('host_update_laporan_tiktok', {
          p_id: laporan.id,
          p_tanggal: values.tanggal,
          p_durasi_menit: values.durasi_menit,
          p_tayangan: values.tayangan,
          p_impresi: values.impresi,
          p_gmv_rupiah: values.gmv_rupiah,
        })
        if (rpcErr || !rpcRes?.success) {
          throw error
        }
      }

      setSuccessMessage('Data laporan TikTok Live berhasil diperbarui!')
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1000)
    } catch (err: any) {
      console.error('Error updating tiktok report:', err)
      setErrorMessage(err.message || 'Gagal memperbarui data TikTok.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen || !laporan) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <Card className="w-full max-w-md shadow-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <div className="flex items-center space-x-2.5">
            <div className="h-9 w-9 rounded-lg bg-pink-100 dark:bg-pink-950 flex items-center justify-center text-pink-600 dark:text-pink-400">
              <Video className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Edit Laporan TikTok</CardTitle>
              <CardDescription className="text-xs">
                Perbarui akun, GMV, durasi, dan traffic live
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

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
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

            {/* Akun TikTok */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <AtSign className="h-3.5 w-3.5 text-pink-500" />
                Akun TikTok Live
              </Label>
              <Input
                type="text"
                placeholder="Contoh: @wangigaya"
                className="text-xs"
                disabled={isSubmitting}
                {...register('akun_tiktok')}
              />
              {errors.akun_tiktok && (
                <p className="text-[11px] text-red-500 font-medium">{errors.akun_tiktok.message}</p>
              )}
            </div>

            {/* Tanggal & Durasi */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-500" />
                  Tanggal Live
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

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                  Durasi (Menit)
                </Label>
                <Input
                  type="number"
                  placeholder="60"
                  className="text-xs"
                  disabled={isSubmitting}
                  {...register('durasi_menit')}
                />
                {errors.durasi_menit && (
                  <p className="text-[11px] text-red-500 font-medium">{errors.durasi_menit.message}</p>
                )}
              </div>
            </div>

            {/* GMV Rupiah */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-slate-500" />
                Total GMV Penjualan (IDR)
              </Label>
              <Input
                type="number"
                min="0"
                step="any"
                placeholder="Contoh: 1500000"
                className="text-xs font-mono"
                disabled={isSubmitting}
                {...register('gmv_rupiah')}
              />
              {errors.gmv_rupiah && (
                <p className="text-[11px] text-red-500 font-medium">{errors.gmv_rupiah.message}</p>
              )}
            </div>

            {/* Tayangan & Impresi */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-slate-500" />
                  Tayangan (Views)
                </Label>
                <Input
                  type="number"
                  placeholder="1200"
                  className="text-xs font-mono"
                  disabled={isSubmitting}
                  {...register('tayangan')}
                />
                {errors.tayangan && (
                  <p className="text-[11px] text-red-500 font-medium">{errors.tayangan.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-slate-500" />
                  Total Impresi
                </Label>
                <Input
                  type="number"
                  placeholder="3500"
                  className="text-xs font-mono"
                  disabled={isSubmitting}
                  {...register('impresi')}
                />
                {errors.impresi && (
                  <p className="text-[11px] text-red-500 font-medium">{errors.impresi.message}</p>
                )}
              </div>
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
              className="bg-pink-600 hover:bg-pink-700 text-white gap-1.5 text-xs shadow-md shadow-pink-500/20"
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
