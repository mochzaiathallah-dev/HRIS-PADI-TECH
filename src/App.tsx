import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ProtectedRoute, PublicOnlyRoute } from '@/components/auth/ProtectedRoute'
import { LoginPage } from '@/pages/Login'
import { DashboardPage } from '@/pages/Dashboard'
import { InputLaporanPage } from '@/pages/InputLaporan'

// Root redirector based on authenticated user role
function RootRedirect() {
  const { isAuthenticated, role, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="h-10 w-10 rounded-full border-4 border-blue-500/20 border-t-blue-600 animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (role === 'owner') {
    return <Navigate to="/dashboard" replace />
  }

  return <Navigate to="/input-laporan" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication Route */}
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />

          {/* Owner Dashboard Route (Protected - Owner Role Only) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Employee Report Input Route (Protected - Tutor & Host & Owner) */}
          <Route
            path="/input-laporan"
            element={
              <ProtectedRoute allowedRoles={['tutor', 'host', 'owner']}>
                <InputLaporanPage />
              </ProtectedRoute>
            }
          />

          {/* Root & Catch-all Fallback */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
