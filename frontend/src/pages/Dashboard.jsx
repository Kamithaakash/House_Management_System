import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import usePageMeta from '../hooks/usePageMeta'

export default function Dashboard() {
  usePageMeta('Dashboard | Boarding Management System', '', true) // private: noindex

  const { user, logout } = useAuth()

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Hello, {user.name}</h1>
        <button onClick={logout} className="rounded border border-slate-300 px-3 py-2 text-sm">
          Log out
        </button>
      </header>

      <nav className="mt-6 grid gap-3 sm:grid-cols-2" aria-label="Main menu">
        <Link to="/my-bill" className="rounded-lg bg-white p-4 shadow hover:bg-indigo-50">
          My Bill
        </Link>
      </nav>
    </main>
  )
}
