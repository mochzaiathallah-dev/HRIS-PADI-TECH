import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createClient } from '@supabase/supabase-js'
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase'
import { UserRole } from '@/types'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { 
  UserPlus, 
  X, 
  Mail, 
  Lock, 
  User, 
  GraduationCap, 
  Video, 
  Loader2, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react'

const addEmployeeSchema = z.object({
  nama: z.string().min(2, 'Nama karyawan minimal 2 karakter'),
  email: z.string().min(1, 'Email wajib diisi').email('Format email tidak valid'),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter'),
  role: z.enum(['tutor', 'host'] as const),
})

type AddEmployeeFormValues = z.infer<typeof addEmployeeSchema>

interface AddEmployeeModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
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
  } = useForm<AddEmployeeFormValues>({
    resolver: zodResolver(addEmployeeSchema),
    defaultValues: {
      nama: '',
      email: '',
      password: '',
      role: 'tutor',
    },
  })

  const selectedRole = watch('role')

  const onSubmit = async (values: AddEmployeeFormValues) => {
    setIsSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const emailClean = values.email.trim().toLowerCase()
      const namaClean = values.nama.trim()

      // Menggunakan Supabase Auth SignUp resmi (Bebas error skema & 100% kompatibel dengan GoTrue)
      const tempAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })

      const { data: signUpData, error: signUpError } = await tempAuthClient.auth.signUp({
        email: emailClean,
        password: values.password,
        options: {
          data: {
            nama: namaClean,
            role: values.role,
          },
        },
      })

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          throw new Error(`Email ${emailClean} sudah terdaftar di sistem. Gunakan email lain!`)
        }
        throw signUpError
      }

      if (!signUpData.user) {
        throw new Error('Gagal membuat akun karyawan. Periksa kembali format data yang diisi.')
      }

      if (signUpData.user.identities && signUpData.user.identities.length === 0) {
        throw new Error(`Email ${emailClean} sudah terdaftar sebelumnya di sistem. Silakan gunakan email lain.`)
      }

      // Upsert profile
      const { error: profileError } = await supabase
        .from('users_profile')
        .upsert({
          id: signUpData.user.id,
          nama: namaClean,
          email: emailClean,
          role: values.role as UserRole,
        })

      if (profileError) {
        console.warn('Profile upsert note:', profileError.message)
      }

      setSuccessMessage(
        `Karyawan ${namaClean} berhasil didaftarkan sebagai ${
          values.role === 'tutor' ? 'Tutor Bimbel' : 'Host TikTok Live'
        }!`
      )
      reset()

      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1500)
    } catch (err: any) {
      console.error('Error creating employee:', err)
      setErrorMessage(err.message || 'Gagal mendaftarkan karyawan. Periksa koneksi internet Anda.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <Card className="w-full max-w-md shadow-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <div className="flex items-center space-x-2.5">
            <div className="h-9 w-9 rounded-lg bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Daftarkan Karyawan Baru</CardTitle>
              <CardDescription className="text-xs">
                Buat akun operasional Tutor Bimbel atau Host TikTok Live
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
            {/* Feedback Message */}
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

            {/* Pilihan Peran / Role */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Peran Karyawan</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setValue('role', 'tutor', { shouldValidate: true })}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    selectedRole === 'tutor'
                      ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <GraduationCap className="h-4 w-4 text-blue-600" />
                  <span>Tutor Bimbel</span>
                </button>

                <button
                  type="button"
                  onClick={() => setValue('role', 'host', { shouldValidate: true })}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    selectedRole === 'host'
                      ? 'border-pink-600 bg-pink-50/80 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Video className="h-4 w-4 text-pink-600" />
                  <span>Host TikTok Live</span>
                </button>
              </div>
            </div>

            {/* Nama Karyawan */}
            <div className="space-y-1.5">
              <Label htmlFor="emp-nama" className="text-xs font-semibold flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-slate-500" />
                Nama Lengkap Karyawan
              </Label>
              <Input
                id="emp-nama"
                placeholder="Contoh: Nikita Khoirunnisa"
                className={`text-sm ${errors.nama ? 'border-red-500' : ''}`}
                disabled={isSubmitting}
                {...register('nama')}
              />
              {errors.nama && (
                <p className="text-[11px] text-red-500 font-medium">{errors.nama.message}</p>
              )}
            </div>

            {/* Email Karyawan */}
            <div className="space-y-1.5">
              <Label htmlFor="emp-email" className="text-xs font-semibold flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-slate-500" />
                Email Login Karyawan
              </Label>
              <Input
                id="emp-email"
                type="email"
                placeholder="nikita@paditech.com"
                className={`text-sm ${errors.email ? 'border-red-500' : ''}`}
                disabled={isSubmitting}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-[11px] text-red-500 font-medium">{errors.email.message}</p>
              )}
            </div>

            {/* Password Awal */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="emp-password" className="text-xs font-semibold flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-slate-500" />
                  Kata Sandi Awal
                </Label>
                <span className="text-[10px] text-muted-foreground">Min. 6 karakter</span>
              </div>
              <Input
                id="emp-password"
                type="text"
                placeholder="Contoh: paditech123"
                className={`text-sm ${errors.password ? 'border-red-500' : ''}`}
                disabled={isSubmitting}
                {...register('password')}
              />
              {errors.password && (
                <p className="text-[11px] text-red-500 font-medium">{errors.password.message}</p>
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
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 text-xs shadow-md shadow-indigo-500/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Mendaftarkan...
                </>
              ) : (
                <>
                  <UserPlus className="h-3.5 w-3.5" />
                  Daftarkan Karyawan
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
