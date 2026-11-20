import { Link } from 'react-router-dom'
import PublicFooter from '../components/PublicFooter'
import usePageMeta from '../hooks/usePageMeta'

export default function About() {
  usePageMeta(
    'About | Vike Pamana — Vimana Boarding House',
    'About Vike Pamana (Vimana), the boarding house expense sharing and cleaning rotation web app for residents near the University of Moratuwa.',
  )

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold text-indigo-700">About Vike Pamana (Vimana)</h1>

      <section className="mt-4 space-y-3 rounded-xl bg-white p-5 text-sm text-slate-600 shadow-sm">
        <p>
          <strong>Vike Pamana</strong> (<strong>Vimana</strong>) is the digital management portal
          built for our boarding house near the University of Moratuwa, Sri Lanka.
        </p>
        <p>
          Instead of notebooks or messy group chats, housemates log food orders, electricity and
          water bills, confirm cash settlements, and track weekly group cleaning rotations from one
          fast mobile web app at <strong>vimana.site</strong>.
        </p>
        <h2 className="pt-2 text-base font-semibold text-slate-900">Privacy &amp; Security</h2>
        <p>
          Only approved boarding house members can sign in. All personal bills, balances, and phone
          numbers stay behind authenticated accounts and are strictly hidden from search engines.
        </p>
      </section>

      <Link
        to="/login"
        className="mt-6 flex min-h-12 items-center justify-center rounded-lg bg-indigo-600 font-medium text-white"
      >
        Member Log in
      </Link>

      <PublicFooter />
    </main>
  )
}
