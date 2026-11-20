import { Button, ErrorText, Page, cardClass } from '../components/ui'
import useAction from '../hooks/useAction'
import useLoad from '../hooks/useLoad'
import usePageMeta from '../hooks/usePageMeta'
import { api } from '../services/api'
import { formatCents } from '../utils/money'

export default function MyBill() {
  usePageMeta('My Bill | Vimana', '', true) // private: noindex

  const { data: bill, error: loadError, reload } = useLoad('/expenses/my-bill')
  const { busy, error, run } = useAction()

  async function remove(id) {
    if (!window.confirm('Delete this expense?')) return
    await run(async () => {
      await api(`/expenses/${id}`, { method: 'DELETE' })
      reload()
    })
  }

  if (loadError) return <ErrorText text={loadError} />
  if (!bill) return <p>Loading...</p>

  return (
    <Page title="My Bill">
      <ErrorText text={error} />

      {bill.rows.length === 0 && <p className="text-slate-500">No transactions yet.</p>}

      {bill.rows.map((row) => (
        <article key={row.expense_id} className={cardClass}>
          <div className="flex justify-between gap-2">
            <h2 className="font-semibold">{row.item_name}</h2>
            <span className="text-sm text-slate-500">{row.expense_date}</span>
          </div>
          <p className="text-sm text-slate-600">Paid by {row.paid_by_name}</p>
          <div className="mt-2 flex justify-between text-sm">
            <span>Total {formatCents(row.total_cents)}</span>
            <strong>Your share {formatCents(row.your_share_cents)}</strong>
          </div>
          {row.can_delete && (
            <Button variant="light" busy={busy} onClick={() => remove(row.expense_id)} className="mt-3">
              Delete
            </Button>
          )}
        </article>
      ))}

      <section className={`${cardClass} space-y-1`}>
        <p>You owe: <strong>{formatCents(bill.total_you_owe_cents)}</strong></p>
        <p>Owed to you: <strong>{formatCents(bill.total_owed_to_you_cents)}</strong></p>
        <p className="pt-2 text-lg">
          Net: <strong>{formatCents(Math.abs(bill.net_cents))}</strong>{' '}
          {bill.net_cents === 0 ? 'all settled' : bill.net_cents > 0 ? 'to receive' : 'to pay'}
        </p>
      </section>
    </Page>
  )
}
