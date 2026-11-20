import { Link, Navigate } from 'react-router-dom'
import InstallPrompt from '../components/InstallPrompt'
import { useAuth } from '../context/AuthContext'
import usePageMeta from '../hooks/usePageMeta'

const CURRENT_YEAR = new Date().getFullYear()

export default function Landing() {
  usePageMeta(
    'Vike Pamana — Vimana Boarding House Manager',
    'Vike Pamana (Vimana) is a boarding house web app to split food, electricity, water, and monthly bills fairly, confirm payments, and manage cleaning turns.',
  )

  const { user } = useAuth()
  // If already logged in via saved cookie, jump straight into the app when opening from phone home screen
  if (user) return <Navigate to="/dashboard" replace />

  return (
    <main className="mx-auto max-w-md px-4 py-10 text-center">
      <h1 className="text-3xl font-bold text-indigo-700">Vike Pamana</h1>
      <p className="mt-1 text-sm font-medium text-slate-500">
        Vimana Boarding House Expense &amp; Cleaning Manager
      </p>
      <p className="mt-3 text-slate-600">
        Vike Pamana (Vimana) helps our boarding house split food and utility bills fairly, confirm
        cash payments, and keep the house clean with a fair cleaning rotation.
      </p>

      <section className="mt-8 space-y-3 text-left" aria-label="Vike Pamana Vimana features">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Fair expense splits</h2>
          <p className="mt-1 text-sm text-slate-600">
            Choose who shares each food, electricity, water, or monthly bill. No cent is lost.
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Two-step payment confirmation</h2>
          <p className="mt-1 text-sm text-slate-600">
            A cash payment counts only after the receiver confirms it, with manual debt redirects.
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Group cleaning rotation</h2>
          <p className="mt-1 text-sm text-slate-600">
            Weekly group turns with next-group approval, penalty tracking, and WhatsApp reminders.
          </p>
        </div>
      </section>

      <div className="mt-8 space-y-3">
        <Link
          to="/login"
          className="flex min-h-12 items-center justify-center rounded-lg bg-indigo-600 font-medium text-white"
        >
          Log in to Vike Pamana
        </Link>
        <InstallPrompt />
      </div>

      <footer className="mt-10 text-xs text-slate-400">
        © {CURRENT_YEAR} Vike Pamana • Vimana • vimana.site
      </footer>
    </main>
  )
}
