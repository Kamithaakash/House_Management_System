import { Link } from 'react-router-dom'
import InstallPrompt from '../components/InstallPrompt'
import RedirectNoticeCard from '../components/RedirectNoticeCard'
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

  const myRedirects = balances.data
    ? balances.data.redirect_notices.filter(
        (n) => n.from_debtor === user.id || n.via_middleman === user.id || n.to_creditor === user.id,
      )
    : []

  const hasRedirectOption = balances.data
    ? balances.data.debts.some((d) => d.to_user === user.id) &&
      balances.data.debts.some((d) => d.from_user === user.id)
    : false

  const isFullySettled =
    bill.data && bill.data.total_you_owe_cents === 0 && bill.data.total_owed_to_you_cents === 0

  return (
    <Page title={`Hello, ${user.name}`}>
      <section className={cardClass}>
        <h2 className="text-sm text-slate-500">Your current balance</h2>
        {bill.error ? (
          <ErrorText text={bill.error} />
        ) : !bill.data ? (
          <p className="mt-1 text-slate-500">Loading...</p>
        ) : isFullySettled ? (
          <p className="mt-1 text-2xl font-bold text-emerald-700">
            {formatCents(0)}{' '}
            <span className="text-base font-normal text-slate-500">all settled</span>
          </p>
        ) : (
          <div className="mt-2 space-y-1">
            {bill.data.total_you_owe_cents > 0 && (
              <p className="flex justify-between text-base">
                <span className="text-slate-600">You owe</span>
                <strong className="text-red-600">{formatCents(bill.data.total_you_owe_cents)}</strong>
              </p>
            )}
            {bill.data.total_owed_to_you_cents > 0 && (
              <p className="flex justify-between text-base">
                <span className="text-slate-600">Owed to you</span>
                <strong className="text-emerald-700">{formatCents(bill.data.total_owed_to_you_cents)}</strong>
              </p>
            )}
          </div>
        )}
      </section>

      {hasRedirectOption && (
        <Link to="/my-bill" className="block rounded-xl bg-indigo-100 p-4 text-sm font-medium text-indigo-900">
          Someone owes you and you owe someone else. Open the <strong>Bill</strong> tab to redirect your payment!
        </Link>
      )}

      {toConfirm > 0 && (
        <Link to="/my-bill" className="block rounded-xl bg-amber-100 p-4 font-medium text-amber-900">
          {toConfirm} payment(s) waiting for your confirmation
        </Link>
      )}

      {myRedirects.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">Recent payment redirects</h2>
          {myRedirects.slice(0, 3).map((n) => (
            <RedirectNoticeCard key={n.id} notice={n} currentUserId={user.id} />
          ))}
        </section>
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
