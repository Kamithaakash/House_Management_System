import { Link } from 'react-router-dom'
import InstallPrompt from '../components/InstallPrompt'
import usePageMeta from '../hooks/usePageMeta'

export default function Landing() {
  usePageMeta(
    'Boarding Management System | Share Expenses & Cleaning Turns',
    'A simple app for boarding houses to split food and bills fairly, confirm payments and rotate cleaning duties.',
  )

  return (
    <main className="mx-auto max-w-md px-4 py-10 text-center">
      <h1 className="text-3xl font-bold text-indigo-700">Boarding Management System</h1>
      <p className="mt-3 text-slate-600">
        Split food and bills fairly, confirm payments, and keep the house clean with a fair
        cleaning rotation.
      </p>

      <section className="mt-8 space-y-3 text-left">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Fair expense splits</h2>
          <p className="mt-1 text-sm text-slate-600">Choose who shares each bill. No cent is lost.</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Two-step payments</h2>
          <p className="mt-1 text-sm text-slate-600">A payment counts only after it is confirmed.</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Cleaning rotation</h2>
          <p className="mt-1 text-sm text-slate-600">Group turns with approval and penalties.</p>
        </div>
      </section>

      <div className="mt-8 space-y-3">
        <Link
          to="/login"
          className="flex min-h-12 items-center justify-center rounded-lg bg-indigo-600 font-medium text-white"
        >
          Log in
        </Link>
        <InstallPrompt />
      </div>
    </main>
  )
}
