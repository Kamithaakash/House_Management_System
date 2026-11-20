import { Link } from 'react-router-dom'
import PublicFooter from '../components/PublicFooter'
import usePageMeta from '../hooks/usePageMeta'

export default function Features() {
  usePageMeta(
    'Features | Vimana Boarding House',
    'Explore Vimana (Vike Pamana) features: fair food & utility bill splitting, two-step payment confirmation, manual debt redirects, weekly cleaning rotation, and mobile PWA install.',
  )

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold text-indigo-700">Features of Vimana</h1>
      <p className="mt-2 text-sm text-slate-600">
        Built to remove calculation errors, missing members, and disputes over shared expenses and
        cleaning duties.
      </p>

      <section className="mt-6 space-y-3">
        <article className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Exact Food &amp; Bill Splitting</h2>
          <p className="mt-1 text-sm text-slate-600">
            Split Rice &amp; Curry, Fried Rice, Kottu, Monthly Boarding Fees, Electricity, Water, and
            shared household items using integer-cent math with zero rounding loss.
          </p>
        </article>
        <article className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Two-Party Settlement &amp; Manual Debt Redirects</h2>
          <p className="mt-1 text-sm text-slate-600">
            Cash payments clear only after the receiver confirms. When A owes B and B owes C, B can
            manually redirect the payment with clear notices shown to everyone.
          </p>
        </article>
        <article className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Blocking Cleaning Queue &amp; Penalties</h2>
          <p className="mt-1 text-sm text-slate-600">
            Weekly group turns require approval from the next group or admin before moving forward,
            backed by penalty point tracking and WhatsApp reminders.
          </p>
        </article>
        <article className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Installable Mobile Web App (PWA)</h2>
          <p className="mt-1 text-sm text-slate-600">
            Install Vimana directly to your Android or iPhone home screen with persistent login and
            offline write protection.
          </p>
        </article>
      </section>

      <Link
        to="/login"
        className="mt-6 flex min-h-12 items-center justify-center rounded-lg bg-indigo-600 font-medium text-white"
      >
        Log in to Vimana
      </Link>

      <PublicFooter />
    </main>
  )
}
