import { useMemo, useState } from 'react'
import RedirectNoticeCard from '../components/RedirectNoticeCard'
import { Button, ErrorText, Page, cardClass } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import useAction from '../hooks/useAction'
import useLoad from '../hooks/useLoad'
import usePageMeta from '../hooks/usePageMeta'
import { api } from '../services/api'
import { formatCents } from '../utils/money'

const EMPTY = []

const FILTERS = [
  ['all', 'All'],
  ['expenses', 'Expenses'],
  ['payments', 'Payments'],
  ['redirects', 'Redirects'],
]

const STATUS_BADGE = {
  confirmed: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-800',
  rejected: 'bg-red-100 text-red-700',
}

export default function History() {
  usePageMeta('History | Vimana', '', true) // private: noindex

  const { user } = useAuth()
  const bill = useLoad('/expenses/my-bill')
  const breakdown = useLoad('/bill/breakdown')
  const { busy, error: actionError, run } = useAction()
  const [filter, setFilter] = useState('all')

  const expenses = bill.data?.rows ?? EMPTY
  const settlements = breakdown.data?.history_settlements ?? EMPTY
  const redirects = breakdown.data?.redirect_notices ?? EMPTY
  const otherDebts = breakdown.data?.other_debts ?? EMPTY

  // Memoized combined timeline sorted newest first (date desc, then exact timestamp desc, then id desc)
  const timeline = useMemo(() => {
    const toMs = (iso, fallbackDate) => {
      const parsed = iso ? Date.parse(iso) : NaN
      if (!Number.isNaN(parsed)) return parsed
      return fallbackDate ? Date.parse(`${fallbackDate}T00:00:00Z`) || 0 : 0
    }

    const list = []
    if (filter === 'all' || filter === 'expenses') {
      for (const row of expenses) {
        list.push({
          key: `exp-${row.expense_id}`,
          kind: 'expense',
          sortDate: row.expense_date,
          sortTs: toMs(row.created_at, row.expense_date),
          sortId: row.expense_id,
          data: row,
        })
      }
    }
    if (filter === 'all' || filter === 'payments') {
      for (const s of settlements) {
        const day = s.created_at.slice(0, 10)
        list.push({
          key: `set-${s.id}`,
          kind: 'settlement',
          sortDate: day,
          sortTs: toMs(s.created_at, day),
          sortId: s.id,
          data: s,
        })
      }
    }
    if (filter === 'all' || filter === 'redirects') {
      for (const n of redirects) {
        const day = n.created_at.slice(0, 10)
        list.push({
          key: `red-${n.id}`,
          kind: 'redirect',
          sortDate: day,
          sortTs: toMs(n.created_at, day),
          sortId: n.id,
          data: n,
        })
      }
    }
    return list.sort(
      (a, b) => b.sortDate.localeCompare(a.sortDate) || b.sortTs - a.sortTs || b.sortId - a.sortId,
    )
  }, [filter, expenses, settlements, redirects])

  async function removeExpense(id) {
    if (!window.confirm('Delete this expense?')) return
    await run(async () => {
      await api(`/expenses/${id}`, { method: 'DELETE' })
      bill.reload()
      breakdown.reload()
    })
  }

  if (bill.error) return <ErrorText text={bill.error} />
  if (breakdown.error) return <ErrorText text={breakdown.error} />
  if (!bill.data || !breakdown.data) {
    return <p className="py-6 text-center text-sm text-slate-500">Loading history...</p>
  }

  return (
    <Page title="Payment & Bill History">
      <ErrorText text={actionError} />

      {/* Filter pills */}
      <div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-slate-200/70 p-1">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`min-h-10 rounded-xl text-xs font-semibold transition ${
              filter === key ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {timeline.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-500">No history records yet.</p>
      )}

      <div className="space-y-3">
        {timeline.map((entry) => {
          if (entry.kind === 'redirect') {
            return <RedirectNoticeCard key={entry.key} notice={entry.data} currentUserId={user.id} />
          }

          if (entry.kind === 'settlement') {
            const s = entry.data
            const iPaid = s.from_user === user.id
            return (
              <article key={entry.key} className={cardClass}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold text-slate-900">
                      {iPaid ? `You paid ${s.to_name}` : `${s.from_name} paid you`}
                    </h2>
                    <p className="text-xs text-slate-500">{s.created_at.slice(0, 10)}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                      STATUS_BADGE[s.status] || 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
                <p className="mt-2 text-base font-bold text-slate-900">
                  {formatCents(s.amount_cents)}
                </p>
              </article>
            )
          }

          const row = entry.data
          return (
            <article key={entry.key} className={cardClass}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-slate-900">{row.item_name}</h2>
                  <p className="text-xs text-slate-500">
                    {row.expense_date} • Paid by {row.paid_by_name}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium capitalize text-slate-600">
                  {row.section.replace('_', ' ')}
                </span>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-slate-600">Total {formatCents(row.total_cents)}</span>
                <strong className={row.you_paid ? 'text-emerald-700' : 'text-red-600'}>
                  Your share {formatCents(row.your_share_cents)}
                </strong>
              </div>
              {row.can_delete && (
                <Button
                  variant="light"
                  busy={busy}
                  onClick={() => removeExpense(row.expense_id)}
                  className="mt-3 !min-h-10 text-sm"
                >
                  Delete expense
                </Button>
              )}
            </article>
          )
        })}
      </div>

      {otherDebts.length > 0 && (
        <section className={`${cardClass} space-y-1.5`}>
          <h2 className="text-sm font-semibold text-slate-700">Other house balances</h2>
          {otherDebts.map((d) => (
            <p key={`${d.from_user}-${d.to_user}`} className="text-xs text-slate-600">
              {d.from_name} owes {d.to_name} <strong>{formatCents(d.amount_cents)}</strong>
            </p>
          ))}
        </section>
      )}
    </Page>
  )
}
