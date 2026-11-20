import { useEffect, useState } from 'react'
import { Button, ErrorText, Page, cardClass, inputClass, labelClass } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import useAction from '../hooks/useAction'
import useLoad from '../hooks/useLoad'
import usePageMeta from '../hooks/usePageMeta'
import { api } from '../services/api'
import { centsToText, formatCents, rupeesToCents } from '../utils/money'

// One small card: type an amount and press a button.
function AmountAction({ title, subtitle, maxCents, buttonText, onSubmit }) {
  const [amount, setAmount] = useState(centsToText(maxCents))
  const { busy, error, run } = useAction()

  useEffect(() => {
    setAmount(centsToText(maxCents))
  }, [maxCents])

  async function submit() {
    const cents = rupeesToCents(amount)
    if (!cents || cents > maxCents) return run(async () => { throw new Error('Enter a valid amount') })
    await run(() => onSubmit(cents))
  }

  return (
    <article className={cardClass}>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-slate-600">{subtitle}</p>
      <label htmlFor={title} className={`${labelClass} mt-2`}>Amount (Rs.)</label>
      <input id={title} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
      <ErrorText text={error} />
      <Button busy={busy} onClick={submit} className="mt-3">{buttonText}</Button>
    </article>
  )
}

export default function Balances() {
  usePageMeta('Balances & Payments | Boarding Management System', '', true) // private: noindex

  const { user } = useAuth()
  const { data, error, reload } = useLoad('/balances')
  const { busy, error: actionError, run } = useAction()

  if (error) return <ErrorText text={error} />
  if (!data) return <p>Loading...</p>

  const iOwe = data.debts.filter((d) => d.from_user === user.id)
  const owedToMe = data.debts.filter((d) => d.to_user === user.id)
  const others = data.debts.filter((d) => d.from_user !== user.id && d.to_user !== user.id)
  const waiting = data.pending_settlements.filter((s) => s.to_user === user.id)
  const sent = data.pending_settlements.filter((s) => s.from_user === user.id)

  const post = (path, body) => api(path, { method: 'POST', body }).then(reload)

  return (
    <Page title="Balances & Payments">
      <ErrorText text={actionError} />

      {waiting.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Confirm payments you received</h2>
          {waiting.map((s) => (
            <article key={s.id} className={cardClass}>
              <p>{s.from_name} says they paid you <strong>{formatCents(s.amount_cents)}</strong></p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button busy={busy} onClick={() => run(() => post(`/settlements/${s.id}/confirm`))}>Confirm received</Button>
                <Button variant="light" busy={busy} onClick={() => run(() => post(`/settlements/${s.id}/reject`))}>Reject</Button>
              </div>
            </article>
          ))}
        </section>
      )}

      {sent.map((s) => (
        <p key={s.id} className="rounded-xl bg-amber-100 p-3 text-sm text-amber-900">
          Pending confirmation: your {formatCents(s.amount_cents)} payment to {s.to_name}
        </p>
      ))}

      <section className="space-y-3">
        <h2 className="font-semibold">You owe</h2>
        {iOwe.length === 0 && <p className="text-sm text-slate-500">You owe nobody.</p>}
        {iOwe.map((d) => (
          <AmountAction
            key={d.to_user} title={`Pay ${d.to_name}`} subtitle={`You owe ${formatCents(d.amount_cents)}`}
            maxCents={d.amount_cents} buttonText="I paid"
            onSubmit={(cents) => post('/settlements', { to_user: d.to_user, amount_cents: cents })}
          />
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Owed to you</h2>
        {owedToMe.length === 0 && <p className="text-sm text-slate-500">Nobody owes you.</p>}
        {owedToMe.map((d) => (
          <p key={d.from_user} className={cardClass}>{d.from_name} owes you <strong>{formatCents(d.amount_cents)}</strong></p>
        ))}
      </section>

      {/* Manual redirect: someone owes me, and I owe a third person */}
      {owedToMe.flatMap((a) =>
        iOwe
          .filter((c) => c.to_user !== a.from_user)
          .map((c) => (
            <AmountAction
              key={`${a.from_user}-${c.to_user}`}
              title={`Let ${a.from_name} pay ${c.to_name}`}
              subtitle={`${a.from_name} owes you and you owe ${c.to_name}. Send their payment straight to ${c.to_name}.`}
              maxCents={Math.min(a.amount_cents, c.amount_cents)}
              buttonText="Redirect payment"
              onSubmit={(cents) => post('/settlements/redirect', { from_debtor: a.from_user, to_creditor: c.to_user, amount_cents: cents })}
            />
          )),
      )}

      {data.redirect_notices.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Redirect notices</h2>
          {data.redirect_notices.map((n) => (
            <p key={n.id} className="rounded-xl bg-indigo-50 p-3 text-sm">{n.message}</p>
          ))}
        </section>
      )}

      {others.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Other house balances</h2>
          {others.map((d) => (
            <p key={`${d.from_user}-${d.to_user}`} className="text-sm text-slate-600">
              {d.from_name} owes {d.to_name} {formatCents(d.amount_cents)}
            </p>
          ))}
        </section>
      )}
    </Page>
  )
}
