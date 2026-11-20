import { Link } from 'react-router-dom'
import InstallPrompt from '../components/InstallPrompt'
import { ErrorText, Page, cardClass } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import useLoad from '../hooks/useLoad'
import usePageMeta from '../hooks/usePageMeta'
import { formatCents } from '../utils/money'

export default function Dashboard() {
  usePageMeta('Home | Vimana', '', true) // private: noindex

  const { user, logout } = useAuth()
  const bill = useLoad('/expenses/my-bill')
  const balances = useLoad('/balances')

  const toConfirm = balances.data
    ? balances.data.pending_settlements.filter((s) => s.to_user === user.id).length
    : 0

  return (
    <Page title={`Hello, ${user.name}`}>
      <section className={cardClass}>
        <h2 className="text-sm text-slate-500">Your net balance</h2>
        {bill.error ? (
          <ErrorText text={bill.error} />
        ) : bill.data ? (
          <p className="mt-1 text-2xl font-bold">
            {formatCents(Math.abs(bill.data.net_cents))}{' '}
            <span className="text-base font-normal text-slate-500">
              {bill.data.net_cents === 0
                ? 'all settled'
                : bill.data.net_cents > 0
                  ? 'to receive'
                  : 'to pay'}
            </span>
          </p>
        ) : (
          <p className="mt-1 text-slate-500">Loading...</p>
        )}
      </section>

      {toConfirm > 0 && (
        <Link to="/balances" className="block rounded-xl bg-amber-100 p-4 font-medium text-amber-900">
          {toConfirm} payment(s) waiting for your confirmation
        </Link>
      )}

      {user.role === 'admin' && (
        <Link to="/admin" className={`${cardClass} block font-medium`}>
          ⚙️ Admin panel
        </Link>
      )}

      <InstallPrompt />

      <button onClick={logout} className="min-h-12 w-full rounded-lg border border-slate-300 bg-white">
        Log out
      </button>
    </Page>
  )
}
