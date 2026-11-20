import { Link, Navigate } from 'react-router-dom'
import InstallPrompt from '../components/InstallPrompt'
import { useAuth } from '../context/AuthContext'
import usePageMeta from '../hooks/usePageMeta'

const CURRENT_YEAR = new Date().getFullYear()

export default function Landing() {
  usePageMeta(
    'Vimana — Boarding House Expense & Cleaning Manager',
    'Vimana (Vike Pamana) is a boarding house web app to split food, electricity, water, and monthly bills fairly, confirm payments, and manage cleaning turns.',
  )

  const { user } = useAuth()
  // If already logged in via saved cookie, jump straight into the app when opening from phone home screen
  if (user) return <Navigate to="/dashboard" replace />

  return (
    <div className="relative flex min-h-screen flex-col justify-between overflow-hidden px-5 py-10 text-center text-white">
      {/* Full-screen softly blurred boarding house background */}
      <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <img
          src="/login-bg.webp"
          alt=""
          className="h-full w-full scale-105 object-cover object-center blur-[2px]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/10 via-transparent to-slate-950/35" />
      </div>

      <div aria-hidden="true" />

      <main className="mx-auto w-full max-w-sm">
        <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-3xl bg-white/95 p-3 shadow-2xl">
          <img
            src="/landing-logo.png"
            alt="Vimana logo"
            width="88"
            height="88"
            className="h-22 w-22 object-contain"
          />
        </div>

        <h1 className="font-brand mt-5 text-5xl font-bold tracking-wide drop-shadow">
          Vimana
        </h1>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/95 drop-shadow-sm">
          Boarding House Portal
        </p>
        <p className="mx-auto mt-3 max-w-xs text-sm font-normal leading-relaxed text-white/85 drop-shadow-sm">
          Simple bills, clear balances &amp; fair weekly turns.
        </p>

        <div className="mt-8 space-y-3">
          <Link
            to="/login"
            className="flex min-h-12 items-center justify-center rounded-xl bg-indigo-700 font-semibold text-white shadow-lg transition hover:bg-indigo-800 active:scale-[0.99]"
          >
            Log in
          </Link>
          <InstallPrompt dark />
        </div>
      </main>

      <footer className="mx-auto mt-10 w-full max-w-sm text-xs text-white/75">
        <nav aria-label="Public pages" className="flex flex-wrap justify-center gap-4 font-medium text-white/90">
          <Link to="/features" className="hover:underline">Features</Link>
          <Link to="/install" className="hover:underline">Install</Link>
          <Link to="/about" className="hover:underline">About</Link>
          <Link to="/privacy" className="hover:underline">Privacy</Link>
          <Link to="/login" className="hover:underline">Log in</Link>
        </nav>
        <p className="mt-3 text-white/60">© {CURRENT_YEAR} Vimana • vimana.site</p>
      </footer>
    </div>
  )
}
