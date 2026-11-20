import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/Layout'
import OfflineBanner from './components/OfflineBanner'
import ProtectedRoute from './components/ProtectedRoute'
import Landing from './pages/Landing'
import Login from './pages/Login'

// Private pages load only when needed (Lazy Loading = faster first load on mobile data)
const Dashboard = lazy(() => import('./pages/Dashboard'))
const AddExpense = lazy(() => import('./pages/AddExpense'))
const MyBill = lazy(() => import('./pages/MyBill'))
const Balances = lazy(() => import('./pages/Balances'))
const Chores = lazy(() => import('./pages/Chores'))
const Admin = lazy(() => import('./pages/Admin'))

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OfflineBanner />
        <Suspense fallback={<p className="p-6">Loading...</p>}>
          <Routes>
            {/* Public pages (indexed by search engines) */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />

            {/* Private pages (login needed, noindex) */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/add-expense" element={<AddExpense />} />
              <Route path="/my-bill" element={<MyBill />} />
              <Route path="/balances" element={<Balances />} />
              <Route path="/chores" element={<Chores />} />
              <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
            </Route>

            <Route path="*" element={<p className="p-6">Page not found.</p>} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
