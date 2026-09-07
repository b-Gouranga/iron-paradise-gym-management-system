import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/guards/ProtectedRoute'
import { AppLayout } from './layouts/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { OwnerSetupPage } from './pages/OwnerSetupPage'
import { DashboardPage } from './pages/DashboardPage'
import { ComingSoonPage } from './pages/ComingSoonPage'

const futureRoutes = [
  '/members',
  '/membership-plans',
  '/payments',
  '/renewals',
  '/reminders',
  '/reports',
  '/trainers',
  '/settings',
]

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<OwnerSetupPage />} />

        {/* Protected routes — require authentication */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            {futureRoutes.map((path) => (
              <Route key={path} path={path} element={<ComingSoonPage />} />
            ))}
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}
