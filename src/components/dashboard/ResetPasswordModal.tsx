import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { supabase } from '@/lib/supabase'
import { UserProfile } from '@/types'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  KeyRound, 
  X, 
  User, 
  Mail,
  Lock, 
  Loader2, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react'

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Kata sandi baru minimal 6 karakter'),
})

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>

interface ResetPasswordModalProps {
  isOpen: boolean
  onClose: () => void
  employee: UserProfile | null
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  isOpen,
  onClose,
  employee,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: '',
    },
  })

  const onSubmit = async (values: ResetPasswordFormValues) => {
    if (!employee?.id) return

    setIsSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const { error } = await supabase.rpc('owner_reset_employee_password', {
        p_user_id: employee.id,
        p_new_password: values.newPassword,
      })

      if (error) {
        throw new Error(error.message)
      }

      setSuccessMessage(`Kata sandi untuk ${employee.nama} berhasil diperbarui!`)
      reset()
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err: any) {
      console.error('Error resetting password:', err)
      setErrorMessage(err.message || 'Gagal mereset kata sandi karyawan.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen || !employee) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <Card className="w-full max-w-md shadow-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <div className="flex items-center space-x-2.5">
            <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Ganti Kata Sandi Karyawan</CardTitle>
              <CardDescription className="text-xs">
                Setel ulang kata sandi login karyawan yang lupa sandi
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
            {/* Feedback Banners */}
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

            {/* Info Karyawan & Email */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-slate-500" /> Nama Karyawan:
                </span>
                <Badge variant="outline" className="capitalize text-[10px]">
                  {employee.role}
                </Badge>
              </div>
              <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                {employee.nama}
              </div>
              {employee.email && (
                <div className="text-xs text-muted-foreground font-mono flex items-center gap-1 pt-1 border-t border-slate-200 dark:border-slate-700">
                  <Mail className="h-3 w-3 text-amber-500" /> {employee.email}
                </div>
              )}
            </div>

            {/* Password Baru */}
            <div className="space-y-1.5">
              <Label htmlFor="reset-new-password" className="text-xs font-semibold flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-slate-500" />
                Kata Sandi Baru
              </Label>
              <Input
                id="reset-new-password"
                type="text"
                placeholder="Masukkan kata sandi baru (min. 6 karakter)"
                className={`text-sm ${errors.newPassword ? 'border-red-500' : ''}`}
                disabled={isSubmitting}
                {...register('newPassword')}
              />
              {errors.newPassword && (
                <p className="text-[11px] text-red-500 font-medium">{errors.newPassword.message}</p>
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
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 text-xs shadow-md shadow-amber-500/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Memperbarui...
                </>
              ) : (
                <>
                  <KeyRound className="h-3.5 w-3.5" />
                  Simpan Sandi Baru
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
