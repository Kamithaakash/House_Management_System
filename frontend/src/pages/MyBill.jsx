import { useState } from 'react'
import { Link } from 'react-router-dom'
import PersonBillCard from '../components/PersonBillCard'
import { ErrorText, Page } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import useAction from '../hooks/useAction'
import useLoad from '../hooks/useLoad'
import useOnlineStatus from '../hooks/useOnlineStatus'
import usePageMeta from '../hooks/usePageMeta'
import { api } from '../services/api'
import { centsToText, formatCents, rupeesToCents } from '../utils/money'

function getInitials(name) {
  const parts = String(name || '?').trim().split(/\s+/)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return (parts[0][0] || '?').toUpperCase()
}

function HeroSummaryCard({ youOweCents, owedToYouCents, online }) {
  const netCents = owedToYouCents - youOweCents
  const settled = youOweCents === 0 && owedToYouCents === 0
  const total = youOweCents + owedToYouCents
  const owePct = total > 0 ? Math.round((youOweCents / total) * 100) : 50

  return (
    <section
      aria-label="Your financial position"
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-100/90 via-slate-100 to-emerald-100/80 shadow-sm ring-1 ring-slate-200/80"
    >
      {/* Subtle ambient glow behind the frosted glass so transparency & blur are clearly visible */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-8 -top-8 size-36 rounded-full bg-indigo-400/25 blur-2xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-10 -right-8 size-40 rounded-full bg-emerald-400/25 blur-2xl" />

      {/* Frosted white glass layer */}
      <div className="relative z-10 rounded-2xl border border-white/70 bg-white/35 p-5 text-slate-900 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
          <span>Net balance</span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-slate-700">
            <span className={`size-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {online ? 'Up to date' : 'Offline'}
          </span>
        </div>

        {settled ? (
          <div className="mt-3 flex items-center gap-2.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-7 text-emerald-600" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round" />
              <path d="m9 11 3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-[26px] font-semibold leading-tight tracking-tight text-slate-900">All settled up</p>
          </div>
        ) : (
          <div className="mt-2">
            <p
              className={`font-mono text-[30px] font-semibold leading-tight tracking-tight tabular-nums ${
                netCents >= 0 ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              {netCents >= 0 ? '+' : '−'} {formatCents(Math.abs(netCents))}
            </p>
            <p className="mt-0.5 text-sm text-slate-600">
              {netCents > 0
                ? 'Net to receive after everyone settles'
                : netCents < 0
                  ? 'Net to pay after everyone settles'
                  : 'You break even'}
            </p>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/75 bg-white/40 px-3 py-2.5 backdrop-blur-md">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-red-50/90 px-2 py-0.5 text-[11px] font-semibold text-red-700">
              <span className="size-1.5 rounded-full bg-red-500" />
              You Owe
            </span>
            <p className="mt-1.5 whitespace-nowrap font-mono text-[15px] font-semibold tabular-nums text-slate-900">
              {formatCents(youOweCents)}
            </p>
          </div>

          <div className="rounded-xl border border-white/75 bg-white/40 px-3 py-2.5 backdrop-blur-md">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-50/90 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Owed to You
            </span>
            <p className="mt-1.5 whitespace-nowrap font-mono text-[15px] font-semibold tabular-nums text-slate-900">
              {formatCents(owedToYouCents)}
            </p>
          </div>
        </div>

        <div className="mt-4" aria-hidden="true">
          {settled ? (
            <div className="h-1.5 rounded-full bg-slate-900/10" />
          ) : (
            <div className="flex h-1.5 gap-1">
              {youOweCents > 0 && (
                <div className="rounded-full bg-red-500" style={{ width: `${owePct}%` }} />
              )}
              {owedToYouCents > 0 && (
                <div className="flex-1 rounded-full bg-emerald-500" />
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function ConfirmSettlementAlert({ settlement, busy, online, onConfirm, onReject }) {
  return (
    <article
      role="alert"
      aria-label="Payment waiting for your confirmation"
      className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-xs"
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <span className="grid size-10 place-items-center rounded-full bg-slate-900 text-[13px] font-semibold text-white">
            {getInitials(settlement.from_name)}
          </span>
          <span className="absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-amber-600 ring-2 ring-amber-50">
            <span className="text-[10px] font-bold text-white">!</span>
          </span>
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[15px] leading-snug text-slate-900">
            <span className="font-semibold">{settlement.from_name}</span> marked a cash payment of{' '}
            <span className="whitespace-nowrap font-mono font-semibold tabular-nums">
              {formatCents(settlement.amount_cents)}
            </span>{' '}
            to you.
          </p>
          <p className="mt-1 text-xs text-amber-800">
            {settlement.created_at.slice(0, 10)} · Needs your confirmation
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy || !online}
          onClick={onConfirm}
          className="inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
        >
          Confirm Received
        </button>
        <button
          type="button"
          disabled={busy || !online}
          onClick={onReject}
          className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-xl bg-white px-3 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
        >
          Dispute / Reject
        </button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-amber-800">
        Debts do not clear until you confirm receipt.
      </p>
    </article>
  )
}

function SmartRedirectCard({ fromCard, toCard, online, onRedirect }) {
  const maxCents = Math.min(fromCard.net_cents, toCard.net_cents)
  const fromFirst = fromCard.other_user_name.split(' ')[0]
  const toFirst = toCard.other_user_name.split(' ')[0]

  const [expanded, setExpanded] = useState(false)
  const [amount, setAmount] = useState(centsToText(maxCents))
  const { busy, error, run } = useAction()

  const typedCents = rupeesToCents(amount)
  const invalid = typedCents !== null && typedCents > maxCents

  async function submit() {
    if (!typedCents || typedCents <= 0 || typedCents > maxCents) {
      return run(async () => {
        throw new Error(`Enter an amount up to ${formatCents(maxCents)}`)
      })
    }
    await run(() => onRedirect(fromCard.other_user_id, toCard.other_user_id, typedCents))
  }

  return (
    <article className="rounded-2xl border border-indigo-200 bg-white p-4 shadow-xs">
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5" aria-hidden="true">
          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
        </svg>
        Smart Debt Optimization
      </span>

      {/* Flow diagram: Debtor -> You (Skipped) -> Creditor */}
      <div className="mt-4 grid grid-cols-[1fr_auto_auto_auto_1fr] items-center gap-1.5 text-center">
        <div className="flex min-w-0 flex-col items-center gap-1">
          <span className="grid size-10 place-items-center rounded-full bg-emerald-50 text-[13px] font-semibold text-emerald-700">
            {getInitials(fromCard.other_user_name)}
          </span>
          <span className="truncate text-[13px] font-semibold text-slate-900">{fromFirst}</span>
          <span className="text-[11px] leading-none text-slate-500">Owes you</span>
          <span className="whitespace-nowrap font-mono text-xs font-semibold tabular-nums text-emerald-700">
            {formatCents(fromCard.net_cents)}
          </span>
        </div>

        <span className="text-slate-400" aria-hidden="true">→</span>

        <div className="flex flex-col items-center gap-1 px-1">
          <span className="grid size-10 place-items-center rounded-full bg-slate-900 text-[13px] font-semibold text-white">
            You
          </span>
          <span className="text-[11px] text-slate-500">Skipped</span>
        </div>

        <span className="text-slate-400" aria-hidden="true">→</span>

        <div className="flex min-w-0 flex-col items-center gap-1">
          <span className="grid size-10 place-items-center rounded-full bg-red-50 text-[13px] font-semibold text-red-700">
            {getInitials(toCard.other_user_name)}
          </span>
          <span className="truncate text-[13px] font-semibold text-slate-900">{toFirst}</span>
          <span className="text-[11px] leading-none text-slate-500">You owe</span>
          <span className="whitespace-nowrap font-mono text-xs font-semibold tabular-nums text-red-700">
            {formatCents(toCard.net_cents)}
          </span>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-slate-700">
        Skip the middleman: let {fromFirst} pay {toFirst}{' '}
        <span className="whitespace-nowrap font-mono font-semibold tabular-nums text-slate-900">
          {formatCents(maxCents)}
        </span>{' '}
        directly.
      </p>

      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-indigo-50 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
        >
          Review redirect ▾
        </button>
      ) : (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor={`redir-${fromCard.other_user_id}-${toCard.other_user_id}`}
              className="text-xs font-medium text-slate-600"
            >
              Amount {fromFirst} pays {toFirst}
            </label>
            <button
              type="button"
              onClick={() => setAmount(centsToText(maxCents))}
              className="inline-flex h-7 items-center whitespace-nowrap rounded-full bg-slate-100 px-2.5 font-mono text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
            >
              Max {formatCents(maxCents)}
            </button>
          </div>

          <div
            className={`mt-2 flex h-12 items-center rounded-xl border bg-white px-3 focus-within:ring-2 ${
              invalid
                ? 'border-red-500 focus-within:ring-red-100'
                : 'border-slate-300 focus-within:border-indigo-600 focus-within:ring-indigo-100'
            }`}
          >
            <span className="font-mono text-sm text-slate-500">Rs.</span>
            <input
              id={`redir-${fromCard.other_user_id}-${toCard.other_user_id}`}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="ml-2 min-w-0 flex-1 bg-transparent font-mono text-base font-semibold tabular-nums text-slate-900 outline-none"
            />
          </div>

          {!invalid && typedCents > 0 && (
            <p className="mt-1.5 text-xs text-slate-500">
              After: {fromFirst} owes you {formatCents(fromCard.net_cents - typedCents)} · you owe {toFirst}{' '}
              {formatCents(toCard.net_cents - typedCents)}
            </p>
          )}
          {invalid && (
            <p className="mt-1.5 text-xs text-red-600">Can’t be more than {formatCents(maxCents)}.</p>
          )}
          <ErrorText text={error} />

          <button
            type="button"
            disabled={busy || !online || !typedCents || typedCents <= 0 || invalid}
            onClick={submit}
            className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-indigo-700 text-sm font-semibold text-white transition hover:bg-indigo-800 active:scale-[0.99] disabled:opacity-50"
          >
            {busy ? 'Redirecting…' : 'Approve Redirect'}
          </button>
        </div>
      )}
    </article>
  )
}

function SettledEmptyState() {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-10 text-center shadow-xs">
      <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald-50 ring-1 ring-inset ring-emerald-200">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="size-8 text-emerald-600" aria-hidden="true">
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      </div>
      <h2 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">You’re all squared away!</h2>
      <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-slate-500">
        No open balances with your housemates. New shared expenses will show up here.
      </p>
      <div className="mx-auto mt-6 grid max-w-xs grid-cols-2 gap-2">
        <Link
          to="/add-expense"
          className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-xl bg-indigo-700 px-4 text-sm font-semibold text-white transition hover:bg-indigo-800"
        >
          + Add Expense
        </Link>
        <Link
          to="/history"
          className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
        >
          View History
        </Link>
      </div>
    </div>
  )
}

export default function MyBill() {
  usePageMeta('My Bill | Vimana', '', true) // private: noindex

  const { user } = useAuth()
  const online = useOnlineStatus()
  const { data, error, reload } = useLoad('/bill/breakdown')
  const { busy, error: actionError, run } = useAction()
  const [activeTab, setActiveTab] = useState('all')

  if (error) return <ErrorText text={error} />
  if (!data) return <p className="py-6 text-center text-sm text-slate-500">Loading...</p>

  const youOweCards = data.person_cards.filter((c) => c.direction === 'you_owe')
  const owesYouCards = data.person_cards.filter((c) => c.direction === 'owes_you')
  const waitingForMe = data.pending_settlements.filter((s) => s.to_user === user.id)
  const sentByMe = data.pending_settlements.filter((s) => s.from_user === user.id)

  const incomingByUser = {}
  for (const s of waitingForMe) {
    incomingByUser[s.from_user] = (incomingByUser[s.from_user] || 0) + s.amount_cents
  }

  const redirectPairs = owesYouCards.flatMap((fromCard) =>
    youOweCards
      .filter((toCard) => toCard.other_user_id !== fromCard.other_user_id)
      .map((toCard) => ({ fromCard, toCard })),
  )

  const isFullySettled = data.person_cards.length === 0
  const post = (path, body) => api(path, { method: 'POST', body }).then(reload)

  const visibleCards =
    activeTab === 'owe' ? youOweCards : activeTab === 'owed' ? owesYouCards : data.person_cards

  const tabs = [
    ['all', 'All People', data.person_cards.length],
    ['owe', 'You Owe', youOweCards.length],
    ['owed', 'Owed to You', owesYouCards.length],
  ]

  return (
    <Page title="My Bill & Payments">
      <ErrorText text={actionError} />

      <HeroSummaryCard
        youOweCents={data.total_you_owe_cents}
        owedToYouCents={data.total_owed_to_you_cents}
        online={online}
      />

      {/* Incoming payments needing your confirmation */}
      {waitingForMe.length > 0 && (
        <section className="space-y-2.5">
          {waitingForMe.map((s) => (
            <ConfirmSettlementAlert
              key={s.id}
              settlement={s}
              busy={busy}
              online={online}
              onConfirm={() => run(() => post(`/settlements/${s.id}/confirm`))}
              onReject={() => run(() => post(`/settlements/${s.id}/reject`))}
            />
          ))}
        </section>
      )}

      {/* Outgoing pending confirmation banner */}
      {sentByMe.map((s) => (
        <p key={s.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">
          Pending confirmation: your {formatCents(s.amount_cents)} payment to {s.to_name}
        </p>
      ))}

      {/* Smart Debt Optimization (Middleman B redirects A -> C) */}
      {redirectPairs.length > 0 && (
        <section className="space-y-2.5">
          {redirectPairs.map(({ fromCard, toCard }) => (
            <SmartRedirectCard
              key={`${fromCard.other_user_id}-${toCard.other_user_id}-${Math.min(fromCard.net_cents, toCard.net_cents)}`}
              fromCard={fromCard}
              toCard={toCard}
              online={online}
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

      {/* Balances by housemate */}
      <section className="space-y-3" aria-labelledby="people-heading">
        <div className="flex items-baseline justify-between">
          <h2 id="people-heading" className="text-[15px] font-semibold tracking-tight text-slate-900">
            Balances by housemate
          </h2>
          {!isFullySettled && <span className="text-xs text-slate-500">Open items only</span>}
        </div>

        {isFullySettled ? (
          <SettledEmptyState />
        ) : (
          <>
            <div role="tablist" aria-label="Filter balances" className="grid grid-cols-3 gap-1 rounded-xl bg-slate-200/70 p-1">
              {tabs.map(([key, label, count]) => {
                const active = activeTab === key
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(key)}
                    className={`flex h-10 items-center justify-center whitespace-nowrap rounded-[10px] px-1.5 text-[12px] font-semibold transition ${
                      active ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {label}{' '}
                    <span className={`ml-1 font-mono text-[11px] tabular-nums ${active ? 'text-slate-500' : 'text-slate-400'}`}>
                      ({count})
                    </span>
                  </button>
                )
              })}
            </div>

            {visibleCards.length === 0 ? (
              <p className="rounded-2xl border border-slate-200/80 bg-white py-8 text-center text-sm text-slate-500">
                No housemates in this filter.
              </p>
            ) : (
              <div className="space-y-2.5">
                {visibleCards.map((card) => (
                  <PersonBillCard
                    key={card.other_user_id}
                    card={card}
                    incomingClaimCents={incomingByUser[card.other_user_id] || 0}
                    onPay={(toUser, cents) => post('/settlements', { to_user: toUser, amount_cents: cents })}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </Page>
  )
}
