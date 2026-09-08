import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/guards/ProtectedRoute'
import { AppLayout } from './layouts/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { OwnerSetupPage } from './pages/OwnerSetupPage'
import { DashboardPage } from './pages/DashboardPage'
import { MembersPage } from './pages/MembersPage'
import { MemberDetailPage } from './pages/MemberDetailPage'
import { MembershipPlansPage } from './pages/MembershipPlansPage'
import { PaymentsPage } from './pages/PaymentsPage'
import { RemindersPage } from './pages/RemindersPage'
import { ReportsPage } from './pages/ReportsPage'
import { ComingSoonPage } from './pages/ComingSoonPage'

const futureRoutes = [
  '/renewals',
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
            <Route path="/members" element={<MembersPage />} />
            <Route path="/members/:id" element={<MemberDetailPage />} />
            <Route path="/membership-plans" element={<MembershipPlansPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/reminders" element={<RemindersPage />} />
            <Route path="/reports" element={<ReportsPage />} />
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
