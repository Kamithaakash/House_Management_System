import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Hides pages from logged-out users. (The server ALSO checks every request.)
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth()

  if (loading) return <p className="p-6">Loading...</p>
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />

  return children
}
