import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { ComingSoonPage } from './pages/ComingSoonPage'
const futureRoutes = ['/members','/membership-plans','/payments','/renewals','/reminders','/reports','/trainers','/settings']
export default function App() { return <Routes><Route path="/login" element={<LoginPage/>}/><Route element={<AppLayout/>}><Route path="/dashboard" element={<DashboardPage/>}/>{futureRoutes.map(path => <Route key={path} path={path} element={<ComingSoonPage/>}/>)}</Route><Route path="*" element={<Navigate to="/login" replace/>}/></Routes> }
