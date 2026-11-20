import { useState } from 'react'
import { Button, ErrorText } from './ui'
import useAction from '../hooks/useAction'
import { centsToText, formatCents, rupeesToCents } from '../utils/money'

function PayInline({ otherName, maxCents, onPay }) {
  const [amount, setAmount] = useState(centsToText(maxCents))
  const { busy, error, run } = useAction()

  async function submit() {
    const cents = rupeesToCents(amount)
    if (!cents || cents > maxCents) {
      return run(async () => {
        throw new Error(`Enter an amount up to ${formatCents(maxCents)}`)
      })
    }
    await run(() => onPay(cents))
  }

  return (
    <div className="mt-3 rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-700">Record cash payment to {otherName}</p>
      <div className="mt-2 flex gap-2">
        <input
          aria-label={`Amount to pay ${otherName}`}
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
        <Button busy={busy} onClick={submit} className="!w-auto shrink-0 px-5">
          I paid
        </Button>
      </div>
      <ErrorText text={error} />
    </div>
  )
}

// Expandable person-to-person bill box (Progressive Disclosure pattern).
// Collapsed = clean net total; Expanded = exact itemized reasons + inline payment.
export default function PersonBillCard({ card, onPay }) {
  const [open, setOpen] = useState(false)
  const isOwe = card.direction === 'you_owe'
  const remainingPayable = Math.max(0, card.net_cents - card.pending_sent_cents)
  const initial = (card.other_user_name || '?')[0].toUpperCase()

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-slate-50"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
              isOwe ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {initial}
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-slate-900">{card.other_user_name}</h3>
            <p className="text-xs text-slate-500">
              {open ? 'Hide details' : `${card.items.length} item(s) • Tap to inspect`}
            </p>
            {card.pending_sent_cents > 0 && (
              <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                Pending confirm: {formatCents(card.pending_sent_cents)}
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className={`text-base font-bold ${isOwe ? 'text-red-600' : 'text-emerald-700'}`}>
            {formatCents(card.net_cents)}
          </p>
          <p className="text-[11px] text-slate-500">
            {isOwe ? 'you owe' : 'owes you'} {open ? '▴' : '▾'}
          </p>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            How this net amount was calculated
          </p>

          <ul className="mt-2 divide-y divide-slate-100">
            {card.items.map((item, idx) => {
              const positive = item.signed_cents > 0
              return (
                <li key={`${item.kind}-${item.item_date}-${idx}`} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{item.title}</p>
                    <p className="text-xs text-slate-500">
                      {item.item_date} • {item.subtitle}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 font-semibold ${
                      positive ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {positive ? '+' : '-'} {formatCents(Math.abs(item.signed_cents))}
                  </span>
                </li>
              )
            })}
          </ul>

          <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2.5 text-sm font-bold">
            <span className="text-slate-700">{isOwe ? 'Net you owe' : 'Net owed to you'}</span>
            <span className={isOwe ? 'text-red-600' : 'text-emerald-700'}>
              {formatCents(card.net_cents)}
            </span>
          </div>

          {isOwe && remainingPayable > 0 && (
            <PayInline
              key={`${card.other_user_id}-${remainingPayable}`}
              otherName={card.other_user_name}
              maxCents={remainingPayable}
              onPay={(cents) => onPay(card.other_user_id, cents)}
            />
          )}

          {isOwe && remainingPayable === 0 && (
            <p className="mt-3 rounded-xl bg-amber-50 p-2.5 text-xs font-medium text-amber-800">
              Full amount is already pending confirmation from {card.other_user_name}.
            </p>
          )}
        </div>
      )}
    </article>
  )
}
