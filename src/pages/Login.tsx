import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Lock, Mail, Eye, EyeOff, Loader2, ShieldCheck, Zap, AlertCircle } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().min(1, 'Email wajib diisi').email('Format email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export const LoginPage: React.FC = () => {
  const { signInWithPassword } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (values: LoginFormValues) => {
    setErrorMessage(null)
    setIsSubmitting(true)
    try {
      const { error } = await signInWithPassword(values.email, values.password)
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErrorMessage('Email atau kata sandi tidak sesuai. Silakan periksa kembali.')
        } else if (error.message.includes('Email not confirmed')) {
          setErrorMessage('Email belum dikonfirmasi. Silakan periksa kotak masuk email Anda.')
        } else {
          setErrorMessage(error.message)
        }
      }
    } catch {
      setErrorMessage('Terjadi kesalahan jaringan saat mencoba login.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4 sm:p-6">
      {/* Brand Header */}
      <div className="w-full max-w-md mb-6 text-center space-y-2">
        <div className="inline-flex h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/25">
          HP
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          HRIS PADI TECH
        </h1>
        <p className="text-xs text-muted-foreground">
          Sistem Operasional Bimbel & Live Commerce TikTok
        </p>
      </div>

      {/* Login Card */}
      <Card className="w-full max-w-md shadow-xl border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur">
        <CardHeader className="space-y-1 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold">Masuk ke Akun</CardTitle>
            <Badge variant="outline" className="text-[11px] gap-1 font-normal border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
              <Zap className="h-3 w-3 text-blue-500" /> Client Auth
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Gunakan email dan password yang terdaftar untuk mengakses sistem.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {/* Error Alert */}
            {errorMessage && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs animate-in fade-in-50">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="nama@paditech.com"
                  className={`pl-9 text-sm ${errors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  autoComplete="email"
                  disabled={isSubmitting}
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="text-[11px] text-red-500 font-medium">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold">
                  Kata Sandi
                </Label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className={`pl-9 pr-10 text-sm ${errors.password ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-[11px] text-red-500 font-medium">{errors.password.message}</p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-3 pt-2">
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md shadow-blue-500/20"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                'Masuk ke Sistem'
              )}
            </Button>

            <div className="w-full flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground text-center">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span>Proteksi Sesi Terenkripsi Supabase Auth</span>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
