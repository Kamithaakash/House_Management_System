import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import OfflineBanner from './components/OfflineBanner'
import ProtectedRoute from './components/ProtectedRoute'
import Landing from './pages/Landing'
import Login from './pages/Login'

// Private pages load only when needed (Lazy Loading = faster first load)
const Dashboard = lazy(() => import('./pages/Dashboard'))
const MyBill = lazy(() => import('./pages/MyBill'))

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OfflineBanner />
        <Suspense fallback={<p className="p-6">Loading...</p>}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/my-bill" element={<ProtectedRoute><MyBill /></ProtectedRoute>} />
            <Route path="*" element={<p className="p-6">Page not found.</p>} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
