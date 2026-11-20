import { useState } from 'react'
import PersonBillCard from '../components/PersonBillCard'
import { Button, ErrorText, Page, cardClass, inputClass, labelClass } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import useAction from '../hooks/useAction'
import useLoad from '../hooks/useLoad'
import usePageMeta from '../hooks/usePageMeta'
import { api } from '../services/api'
import { centsToText, formatCents, rupeesToCents } from '../utils/money'

function RedirectBox({ fromCard, toCard, onRedirect }) {
  const maxCents = Math.min(fromCard.net_cents, toCard.net_cents)
  const [amount, setAmount] = useState(centsToText(maxCents))
  const { busy, error, run } = useAction()

  async function submit() {
    const cents = rupeesToCents(amount)
    if (!cents || cents > maxCents) {
      return run(async () => {
        throw new Error(`Enter an amount up to ${formatCents(maxCents)}`)
      })
    }
    await run(() => onRedirect(fromCard.other_user_id, toCard.other_user_id, cents))
  }

  return (
    <article className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4">
      <h3 className="font-semibold text-indigo-950">
        Let {fromCard.other_user_name} pay {toCard.other_user_name}
      </h3>
      <p className="mt-1 text-xs text-slate-700">
        {fromCard.other_user_name} owes you {formatCents(fromCard.net_cents)} and you owe{' '}
        {toCard.other_user_name} {formatCents(toCard.net_cents)}. Redirect up to{' '}
        <strong>{formatCents(maxCents)}</strong> directly.
      </p>
      <label htmlFor={`redir-${fromCard.other_user_id}-${toCard.other_user_id}`} className={`${labelClass} mt-2`}>
        Amount (Rs.)
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id={`redir-${fromCard.other_user_id}-${toCard.other_user_id}`}
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={`${inputClass} !mt-0 flex-1`}
        />
        <Button busy={busy} onClick={submit} className="!w-auto shrink-0 px-4">
          Redirect
        </Button>
      </div>
      <ErrorText text={error} />
    </article>
  )
}

export default function MyBill() {
  usePageMeta('My Bill | Vimana', '', true) // private: noindex

  const { user } = useAuth()
  const { data, error, reload } = useLoad('/bill/breakdown')
  const { busy, error: actionError, run } = useAction()
  const [showRedirects, setShowRedirects] = useState(false)

  if (error) return <ErrorText text={error} />
  if (!data) return <p className="py-6 text-center text-sm text-slate-500">Loading...</p>

  const youOweCards = data.person_cards.filter((c) => c.direction === 'you_owe')
  const owesYouCards = data.person_cards.filter((c) => c.direction === 'owes_you')
  const waitingForMe = data.pending_settlements.filter((s) => s.to_user === user.id)
  const sentByMe = data.pending_settlements.filter((s) => s.from_user === user.id)

  const redirectPairs = owesYouCards.flatMap((fromCard) =>
    youOweCards
      .filter((toCard) => toCard.other_user_id !== fromCard.other_user_id)
      .map((toCard) => ({ fromCard, toCard })),
  )

  const isFullySettled = data.total_you_owe_cents === 0 && data.total_owed_to_you_cents === 0
  const post = (path, body) => api(path, { method: 'POST', body }).then(reload)

  return (
    <Page title="Bill & Remaining Payments">
      <ErrorText text={actionError} />

      {/* Summary card */}
      <section className={cardClass}>
        {isFullySettled ? (
          <div className="text-center">
            <p className="text-xs font-medium text-slate-500">Current status</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{formatCents(0)}</p>
            <p className="text-sm text-emerald-700">All settled — no remaining payments</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 divide-x divide-slate-200 text-center">
            <div className="pr-3">
              <p className="text-xs font-medium text-slate-500">Total you owe</p>
              <p className="mt-1 text-lg font-bold text-red-600">
                {formatCents(data.total_you_owe_cents)}
              </p>
            </div>
            <div className="pl-3">
              <p className="text-xs font-medium text-slate-500">Owed to you</p>
              <p className="mt-1 text-lg font-bold text-emerald-700">
                {formatCents(data.total_owed_to_you_cents)}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Incoming payments needing your confirmation */}
      {waitingForMe.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="text-sm font-semibold text-amber-900">Confirm payments received</h2>
          {waitingForMe.map((s) => (
            <article key={s.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-950">
                <strong>{s.from_name}</strong> marked a payment of{' '}
                <strong>{formatCents(s.amount_cents)}</strong> to you.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button busy={busy} onClick={() => run(() => post(`/settlements/${s.id}/confirm`))}>
                  Confirm received
                </Button>
                <Button variant="light" busy={busy} onClick={() => run(() => post(`/settlements/${s.id}/reject`))}>
                  Reject
                </Button>
              </div>
            </article>
          ))}
        </section>
      )}

      {/* Outgoing pending confirmation banner */}
      {sentByMe.map((s) => (
        <p key={s.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">
          Pending confirmation: your {formatCents(s.amount_cents)} payment to {s.to_name}
        </p>
      ))}

      {/* Redirect option when B both owes and is owed */}
      {redirectPairs.length > 0 && (
        <section className="space-y-2.5">
          <button
            type="button"
            onClick={() => setShowRedirects((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-left text-sm font-semibold text-indigo-900"
          >
            <span>Redirect a payment ({redirectPairs.length} option{redirectPairs.length > 1 ? 's' : ''})</span>
            <span>{showRedirects ? '▴' : '▾'}</span>
          </button>
          {showRedirects &&
            redirectPairs.map(({ fromCard, toCard }) => (
              <RedirectBox
                key={`${fromCard.other_user_id}-${toCard.other_user_id}-${Math.min(fromCard.net_cents, toCard.net_cents)}`}
                fromCard={fromCard}
                toCard={toCard}
                onRedirect={(fromDebtor, toCreditor, cents) =>
                  post('/settlements/redirect', {
                    from_debtor: fromDebtor,
                    to_creditor: toCreditor,
                    amount_cents: cents,
                  })
                }
              />
            ))}
        </section>
      )}

      {/* Person-wise boxes: People you owe */}
      {youOweCards.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="text-sm font-semibold text-slate-700">People you owe</h2>
          {youOweCards.map((card) => (
            <PersonBillCard
              key={card.other_user_id}
              card={card}
              onPay={(toUser, cents) => post('/settlements', { to_user: toUser, amount_cents: cents })}
            />
          ))}
        </section>
      )}

      {/* Person-wise boxes: People who owe you */}
      {owesYouCards.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="text-sm font-semibold text-slate-700">People who owe you</h2>
          {owesYouCards.map((card) => (
            <PersonBillCard key={card.other_user_id} card={card} onPay={() => {}} />
          ))}
        </section>
      )}
    </Page>
  )
}
