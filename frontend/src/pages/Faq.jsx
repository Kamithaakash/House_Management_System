import { Link } from 'react-router-dom'
import PublicFooter from '../components/PublicFooter'
import usePageMeta from '../hooks/usePageMeta'

const FAQS = [
  [
    'How do I install Vike Pamana (Vimana) on my phone?',
    'Open vimana.site in Chrome on Android and tap "Install app on this phone". On iPhone Safari, tap Share and choose "Add to Home Screen".',
  ],
  [
    'How does bill splitting avoid missing cents?',
    'All amounts are calculated in exact integer cents. Any remainder cents are distributed 1 cent at a time so the shares always equal the exact total.',
  ],
  [
    'What is a manual payment redirect?',
    'If Person A owes Person B and Person B owes Person C, Person B can manually redirect the payment from the Pay tab so A pays C directly, with clear notices shown to A and C.',
  ],
  [
    'How do weekly cleaning turns work?',
    'Only one cleaning group is active at a time. When finished, a member taps Mark as done, and either the Admin or a member of the next group approves it to unlock the next turn.',
  ],
  [
    'Can outsiders see our house bills?',
    'No. Only accounts created by the house Admin can log in, and all private pages are blocked from Google indexing.',
  ],
]

export default function Faq() {
  usePageMeta(
    'Frequently Asked Questions | Vike Pamana — Vimana',
    'Frequently asked questions about Vike Pamana (Vimana): installing the phone app, bill splitting, payment confirmation, debt redirects, and cleaning turns.',
  )

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold text-indigo-700">Frequently Asked Questions</h1>
      <p className="mt-2 text-sm text-slate-600">
        Quick answers on how to use <strong>Vike Pamana</strong> (<strong>Vimana</strong>) at
        vimana.site.
      </p>

      <section className="mt-6 space-y-3">
        {FAQS.map(([q, a]) => (
          <article key={q} className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-slate-900">{q}</h2>
            <p className="mt-1 text-sm text-slate-600">{a}</p>
          </article>
        ))}
      </section>

      <Link
        to="/login"
        className="mt-6 flex min-h-12 items-center justify-center rounded-lg bg-indigo-600 font-medium text-white"
      >
        Log in to Vike Pamana
      </Link>

      <PublicFooter />
    </main>
  )
}
