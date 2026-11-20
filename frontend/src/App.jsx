import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import OfflineBanner from './components/OfflineBanner'
import ProtectedRoute from './components/ProtectedRoute'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Features from './pages/Features'
import Install from './pages/Install'
import About from './pages/About'
import Privacy from './pages/Privacy'
import VikePamana from './pages/VikePamana'

// If a lazy JS chunk fails to load after a new Vercel deploy, auto-reload once cleanly.
function lazyWithRetry(importer) {
  return lazy(async () => {
    const key = 'vimana_chunk_reloaded'
    try {
      const mod = await importer()
      sessionStorage.removeItem(key)
      return mod
    } catch (err) {
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1')
        window.location.reload()
        return new Promise(() => {})
      }
      throw err
    }
  })
}

// Private pages load only when needed (Lazy Loading = faster first load on mobile data)
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'))
const AddExpense = lazyWithRetry(() => import('./pages/AddExpense'))
const MyBill = lazyWithRetry(() => import('./pages/MyBill'))
const Balances = lazyWithRetry(() => import('./pages/Balances'))
const Chores = lazyWithRetry(() => import('./pages/Chores'))
const Admin = lazyWithRetry(() => import('./pages/Admin'))

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <OfflineBanner />
          <Suspense fallback={<p className="p-6 text-center text-sm text-slate-500">Loading...</p>}>
            <Routes>
              {/* Public pages (indexed by search engines) */}
              <Route path="/" element={<Landing />} />
              <Route path="/features" element={<Features />} />
              <Route path="/install" element={<Install />} />
              <Route path="/about" element={<About />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/vike-pamana" element={<VikePamana />} />
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
    </ErrorBoundary>
  )
}
