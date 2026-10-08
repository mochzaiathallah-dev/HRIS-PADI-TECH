import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { UserRole } from '@/types'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { isAuthenticated, isLoading, role } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative flex items-center justify-center">
            <div className="h-12 w-12 rounded-full border-4 border-blue-500/20 border-t-blue-600 animate-spin" />
            <Loader2 className="h-6 w-6 text-blue-600 absolute animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse font-medium">
            Memverifikasi otentikasi & hak akses...
          </p>
        </div>
      </div>
    )
  }

  // 1. Jika belum login, redirect ke halaman login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // 2. Jika ada pembatasan role tertentu (allowedRoles)
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // Arahkan ke halaman default sesuai peran masing-masing
    if (role === 'owner') {
      return <Navigate to="/dashboard" replace />
    } else {
      return <Navigate to="/input-laporan" replace />
    }
  }

  return <>{children}</>
}

// Redirect wrapper untuk user yang sudah login saat mengakses /login atau /
export const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated, isLoading, role } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  if (isAuthenticated) {
    if (role === 'owner') {
      return <Navigate to="/dashboard" replace />
    }
    return <Navigate to="/input-laporan" replace />
  }

  return <>{children}</>
}
