import { Link, Navigate } from 'react-router-dom'
import InstallPrompt from '../components/InstallPrompt'
import PublicFooter from '../components/PublicFooter'
import { useAuth } from '../context/AuthContext'
import usePageMeta from '../hooks/usePageMeta'

export default function VikePamana() {
  usePageMeta(
    'Vike Pamana — Vimana Boarding House',
    'Vike Pamana boarding house portal on Vimana (vimana.site) for fair expense splitting, payment confirmation, and weekly cleaning rotation.',
  )

  const { user } = useAuth()
  if (user) return <Navigate to="/dashboard" replace />

  return (
    <main className="mx-auto max-w-md px-4 py-10 text-center">
      <img
        src="/main-logo.png"
        alt="Vimana logo"
        width="80"
        height="80"
        className="mx-auto mb-2 h-20 w-20 object-contain"
      />
      <h1 className="text-3xl font-bold text-indigo-700">Vike Pamana — Vimana</h1>
      <p className="mt-2 text-sm text-slate-600">
        Official boarding house portal for <strong>Vike Pamana</strong> on{' '}
        <strong>Vimana</strong> (vimana.site). Split food, electricity, water, and monthly bills
        fairly, confirm cash payments, and manage weekly cleaning turns.
      </p>

      <div className="mt-8 space-y-3">
        <Link
          to="/login"
          className="flex min-h-12 items-center justify-center rounded-lg bg-indigo-600 font-medium text-white"
        >
          Log in to Vimana
        </Link>
        <InstallPrompt />
      </div>

      <PublicFooter />
    </main>
  )
}
