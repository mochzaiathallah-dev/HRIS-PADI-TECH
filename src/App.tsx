import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ProtectedRoute, PublicOnlyRoute, getDashboardPathForRole } from '@/components/auth/ProtectedRoute'
import { LoginPage } from '@/pages/Login'
import { DashboardPage } from '@/pages/Dashboard'
import { DashboardTutorPage } from '@/pages/DashboardTutor'
import { DashboardHostPage } from '@/pages/DashboardHost'

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

  return <Navigate to={getDashboardPathForRole(role)} replace />
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

          {/* 1. Owner Dashboard (Executive, Realtime KPIs, Charts, Reports, Employee Management & Password Reset) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          {/* 2. Tutor Bimbel Dashboard (Student Selection, Subject Pills, Session Notes & History) */}
          <Route
            path="/dashboard-tutor"
            element={
              <ProtectedRoute allowedRoles={['tutor', 'owner']}>
                <DashboardTutorPage />
              </ProtectedRoute>
            }
          />

          {/* 3. Host TikTok Live Dashboard (Live Metrics, Duration, GMV IDR, Auto WebP Proof Compression) */}
          <Route
            path="/dashboard-host"
            element={
              <ProtectedRoute allowedRoles={['host', 'owner']}>
                <DashboardHostPage />
              </ProtectedRoute>
            }
          />

          {/* Legacy / Helper Redirects */}
          <Route
            path="/input-laporan"
            element={<RootRedirect />}
          />

          {/* Root & Catch-all Fallback */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
