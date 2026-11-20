import { Link } from 'react-router-dom'
import PublicFooter from '../components/PublicFooter'
import usePageMeta from '../hooks/usePageMeta'

export default function Privacy() {
  usePageMeta(
    'Privacy & Security | Vimana Boarding House',
    'How Vimana protects boarding house member privacy, bills, phone numbers, and login sessions using Argon2 encryption and HttpOnly cookies.',
  )

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <header className="mb-4 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 font-bold text-indigo-700">
          <img
            src="/main-logo.png"
            alt="Vimana logo"
            width="36"
            height="36"
            className="h-9 w-9 object-contain"
          />
          <span>Vimana</span>
        </Link>
      </header>

      <h1 className="text-2xl font-bold text-indigo-700">Privacy &amp; Security</h1>

      <section className="mt-4 space-y-3 rounded-xl bg-white p-5 text-sm text-slate-600 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Private Invite-Only Access</h2>
        <p>
          Vimana is built exclusively for our boarding house. Only accounts created by the house
          Admin can sign in, and no public self-registration is allowed.
        </p>

        <h2 className="pt-2 text-base font-semibold text-slate-900">Personal Bill Privacy</h2>
        <p>
          Each member&apos;s <strong>My Bill</strong> view only displays expenses they paid for or
          participated in. Phone numbers are visible only to the Admin for WhatsApp reminders.
        </p>

        <h2 className="pt-2 text-base font-semibold text-slate-900">Account &amp; Data Protection</h2>
        <p>
          Passwords are protected with Argon2id hashing, sessions use secure HttpOnly cookies over
          HTTPS, and all private routes are strictly blocked from search engine indexing.
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
