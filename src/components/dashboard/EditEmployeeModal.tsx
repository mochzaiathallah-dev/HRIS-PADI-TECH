import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { supabase } from '@/lib/supabase'
import { UserProfile } from '@/types'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { 
  UserCog, 
  X, 
  User, 
  GraduationCap, 
  Video, 
  ShieldCheck, 
  Loader2, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react'

const editEmployeeSchema = z.object({
  nama: z.string().min(2, 'Nama karyawan minimal 2 karakter'),
  role: z.enum(['owner', 'tutor', 'host'] as const),
})

type EditEmployeeFormValues = z.infer<typeof editEmployeeSchema>

interface EditEmployeeModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  employee: UserProfile | null
}

export const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  employee,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<EditEmployeeFormValues>({
    resolver: zodResolver(editEmployeeSchema),
    defaultValues: {
      nama: '',
      role: 'tutor',
    },
  })

  useEffect(() => {
    if (employee) {
      reset({
        nama: employee.nama,
        role: employee.role,
      })
      setErrorMessage(null)
      setSuccessMessage(null)
    }
  }, [employee, reset])

  const selectedRole = watch('role')

  const onSubmit = async (values: EditEmployeeFormValues) => {
    if (!employee?.id) return

    setIsSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const { error } = await supabase
        .from('users_profile')
        .update({
          nama: values.nama.trim(),
          role: values.role,
          updated_at: new Date().toISOString(),
        })
        .eq('id', employee.id)

      if (error) throw error

      setSuccessMessage(`Data ${values.nama} berhasil diperbarui!`)
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1200)
    } catch (err: any) {
      console.error('Error updating employee:', err)
      setErrorMessage(err.message || 'Gagal memperbarui data karyawan.')
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
            <div className="h-9 w-9 rounded-lg bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <UserCog className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Edit Data Karyawan</CardTitle>
              <CardDescription className="text-xs">
                Perbarui nama lengkap dan peran hak akses karyawan
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

            {/* Nama Lengkap */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-nama" className="text-xs font-semibold flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-slate-500" />
                Nama Lengkap Karyawan
              </Label>
              <Input
                id="edit-nama"
                placeholder="Contoh: Nikita Khoirunnisa"
                className={`text-sm ${errors.nama ? 'border-red-500' : ''}`}
                disabled={isSubmitting}
                {...register('nama')}
              />
              {errors.nama && (
                <p className="text-[11px] text-red-500 font-medium">{errors.nama.message}</p>
              )}
            </div>

            {/* Pilihan Peran / Role */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Peran & Hak Akses</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setValue('role', 'tutor', { shouldValidate: true })}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    selectedRole === 'tutor'
                      ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <GraduationCap className="h-4 w-4 text-blue-600 mb-1" />
                  <span>Tutor</span>
                </button>

                <button
                  type="button"
                  onClick={() => setValue('role', 'host', { shouldValidate: true })}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    selectedRole === 'host'
                      ? 'border-pink-600 bg-pink-50/80 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Video className="h-4 w-4 text-pink-600 mb-1" />
                  <span>Host</span>
                </button>

                <button
                  type="button"
                  onClick={() => setValue('role', 'owner', { shouldValidate: true })}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    selectedRole === 'owner'
                      ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <ShieldCheck className="h-4 w-4 text-indigo-600 mb-1" />
                  <span>Owner</span>
                </button>
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
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 text-xs shadow-md shadow-indigo-500/20"
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
