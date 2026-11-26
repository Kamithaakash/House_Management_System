import { memo, useState } from 'react'
import useAction from '../hooks/useAction'
import useOnlineStatus from '../hooks/useOnlineStatus'
import { centsToText, formatCents, rupeesToCents } from '../utils/money'
import { ErrorText } from './ui'

// Lightweight inline Lucide-style icons (Flyweight: zero extra bundle dependencies)
function Icon({ children, className = 'size-4' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  )
}

const ChevronDownIcon = ({ className }) => (
  <Icon className={className}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
)

const ClockIcon = ({ className }) => (
  <Icon className={className}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </Icon>
)

const ReceiptIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
    <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
    <path d="M12 17.5v-11" />
  </Icon>
)

const BanknoteIcon = ({ className }) => (
  <Icon className={className}>
    <rect width="20" height="12" x="2" y="6" rx="2" />
    <circle cx="12" cy="12" r="2" />
    <path d="M6 12h.01M18 12h.01" />
  </Icon>
)

const ArrowRightLeftIcon = ({ className }) => (
  <Icon className={className}>
    <path d="m16 3 4 4-4 4" />
    <path d="M20 7H4" />
    <path d="m8 21-4-4 4-4" />
    <path d="M4 17h16" />
  </Icon>
)

const FoodIcon = ({ className }) => (
  <Icon className={className}>
    <path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8" />
    <path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7" />
    <path d="m2.1 21.8 6.4-6.3" />
    <path d="m19 5-7 7" />
  </Icon>
)

const ZapIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
  </Icon>
)

const DropletsIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" />
    <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" />
  </Icon>
)

const PackageIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
    <path d="M12 22V12" />
    <path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7" />
  </Icon>
)

function getItemVisual(item) {
  if (item.kind === 'settlement') {
    return { IconComp: BanknoteIcon, tint: 'bg-emerald-50 text-emerald-700' }
  }
  if (item.kind === 'redirect') {
    return { IconComp: ArrowRightLeftIcon, tint: 'bg-indigo-50 text-indigo-700' }
  }
  const sub = (item.subtitle || '').toLowerCase()
  if (sub.includes('(food)')) {
    return { IconComp: FoodIcon, tint: 'bg-amber-50 text-amber-700' }
  }
  if (sub.includes('electric')) {
    return { IconComp: ZapIcon, tint: 'bg-indigo-50 text-indigo-700' }
  }
  if (sub.includes('water')) {
    return { IconComp: DropletsIcon, tint: 'bg-sky-50 text-sky-700' }
  }
  return { IconComp: PackageIcon, tint: 'bg-slate-200/70 text-slate-700' }
}

function getInitials(name) {
  const parts = String(name || '?').trim().split(/\s+/)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return (parts[0][0] || '?').toUpperCase()
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-10 items-center whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-150 ${
        active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      }`}
    >
      {children}
    </button>
  )
}

function PayInline({ otherName, owedCents, pendingCents, onPay }) {
  const remaining = Math.max(0, owedCents - pendingCents)
  const firstName = otherName.split(' ')[0]
  const [mode, setMode] = useState('full')
  const [amount, setAmount] = useState(centsToText(remaining))
  const { busy, error, run } = useAction()
  const online = useOnlineStatus()

  if (remaining === 0) {
    return (
      <div className="flex items-start gap-2.5 border-t border-slate-200/80 px-4 py-3.5">
        <ClockIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <p className="text-sm text-slate-700">
          You’ve marked the full <span className="font-mono font-semibold tabular-nums">{formatCents(owedCents)}</span>{' '}
          as paid. It clears when {firstName} confirms.
        </p>
      </div>
    )
  }

  const typedCents = rupeesToCents(amount)
  const tooMuch = typedCents !== null && typedCents > remaining

  async function submit(e) {
    e.preventDefault()
    if (busy || !online) return
    if (!typedCents || typedCents <= 0 || typedCents > remaining) {
      return run(async () => {
        throw new Error(`Enter an amount up to ${formatCents(remaining)}`)
      })
    }
    await run(() => onPay(typedCents))
  }

  return (
    <form onSubmit={submit} className="border-t border-slate-200/80 px-4 pb-4 pt-3.5">
      <p className="text-sm font-semibold text-slate-900">Settle up with {firstName}</p>
      {pendingCents > 0 && (
        <p className="mt-0.5 text-xs text-slate-500">
          <span className="font-mono tabular-nums">{formatCents(pendingCents)}</span> already waiting on {firstName}’s confirmation.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Chip
          active={mode === 'full'}
          onClick={() => {
            setMode('full')
            setAmount(centsToText(remaining))
          }}
        >
          Pay full (<span className="ml-1 font-mono tabular-nums">{formatCents(remaining)}</span>)
        </Chip>
        <Chip
          active={mode === 'custom'}
          onClick={() => {
            setMode('custom')
            setAmount('')
          }}
        >
          Custom amount
        </Chip>
      </div>

      <label htmlFor={`pay-${otherName}`} className="sr-only">
        Amount paid in cash to {otherName}
      </label>
      <div
        className={`mt-3 flex h-12 items-center rounded-xl border bg-white px-3 focus-within:ring-2 ${
          tooMuch
            ? 'border-red-500 focus-within:ring-red-100'
            : 'border-slate-300 focus-within:border-indigo-600 focus-within:ring-indigo-100'
        }`}
      >
        <span className="font-mono text-sm text-slate-500">Rs.</span>
        <input
          id={`pay-${otherName}`}
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => {
            setMode('custom')
            setAmount(e.target.value)
          }}
          className="ml-2 min-w-0 flex-1 bg-transparent font-mono text-base font-semibold tabular-nums text-slate-900 outline-none placeholder:text-slate-400"
        />
      </div>

      {tooMuch && (
        <p className="mt-1.5 text-xs text-red-600">
          That’s more than the {formatCents(remaining)} you still owe.
        </p>
      )}
      <ErrorText text={error} />

      <button
        type="submit"
        disabled={busy || !online || !typedCents || typedCents <= 0 || tooMuch}
        className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-slate-900 text-[15px] font-semibold text-white transition hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <BanknoteIcon className="size-4" />
        {busy ? 'Recording payment…' : 'I Paid Cash'}
      </button>
      <p className="mt-2 text-center text-xs text-slate-500">
        {!online ? 'Reconnect to internet to submit payment.' : `${firstName} gets a request to confirm it.`}
      </p>
    </form>
  )
}

// Expandable person-to-person bill box (Progressive Disclosure + Itemized Receipt design).
const PersonBillCard = memo(function PersonBillCard({ card, incomingClaimCents = 0, onPay }) {
  const [open, setOpen] = useState(false)
  const isOwe = card.direction === 'you_owe'
  const firstName = (card.other_user_name || '?').split(' ')[0]
  const initials = getInitials(card.other_user_name)
  const openItemsCount = card.items.length

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-900/12 bg-white/15 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-white/25"
      >
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold ${
            isOwe ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {initials}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-slate-900">{card.other_user_name}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {openItemsCount} unsettled {openItemsCount === 1 ? 'item' : 'items'} · {open ? 'Tap to close' : 'Tap to inspect'}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="whitespace-nowrap font-mono text-[16px] font-bold tracking-tight tabular-nums text-slate-900">
            {formatCents(card.net_cents)}
          </span>
          <span
            className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              isOwe ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {isOwe ? 'You owe' : 'Owes you'}
          </span>
        </div>

        <ChevronDownIcon
          className={`size-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {(card.pending_sent_cents > 0 || incomingClaimCents > 0) && (
        <div className="-mt-1 flex flex-wrap gap-1.5 px-4 pb-3 pl-[72px]">
          {card.pending_sent_cents > 0 && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
              <ClockIcon className="size-3" />
              Pending confirm: <span className="font-mono tabular-nums">{formatCents(card.pending_sent_cents)}</span>
            </span>
          )}
          {incomingClaimCents > 0 && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
              <ClockIcon className="size-3" />
              Claims <span className="font-mono tabular-nums">{formatCents(incomingClaimCents)}</span> paid
            </span>
          )}
        </div>
      )}

      {open && (
        <div className="border-t border-slate-900/10 pt-3">
          {/* Itemized digital receipt */}
          <div className="mx-3 mb-3 rounded-xl border border-slate-900/10 bg-transparent">
            <div className="flex items-center justify-between gap-2 border-b border-dashed border-slate-200 px-3 py-2.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <ReceiptIcon className="size-3.5" />
                Open items with {firstName}
              </span>
              <span className="text-[11px] text-slate-500">+ owes you · − you owe</span>
            </div>

            <ul className="divide-y divide-slate-200/70 px-3">
              {card.items.map((item, idx) => {
                const positive = item.signed_cents > 0
                const { IconComp, tint } = getItemVisual(item)
                return (
                  <li key={`${item.kind}-${item.item_date}-${idx}`} className="flex items-start gap-3 py-3">
                    <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg ${tint}`}>
                      <IconComp className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 text-sm font-semibold leading-snug text-slate-900">{item.title}</p>
                        <span
                          className={`shrink-0 whitespace-nowrap font-mono text-sm font-semibold tabular-nums ${
                            positive ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {positive ? '+' : '−'} {formatCents(Math.abs(item.signed_cents))}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.subtitle}</p>
                      <span className="mt-1.5 inline-block rounded-md bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
                        {item.item_date}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>

            <div className="border-t-2 border-double border-slate-200 px-3 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-slate-900">Net balance</span>
                <span
                  className={`whitespace-nowrap font-mono text-base font-bold tabular-nums ${
                    isOwe ? 'text-red-600' : 'text-emerald-700'
                  }`}
                >
                  {isOwe ? '−' : '+'} {formatCents(card.net_cents)}
                </span>
              </div>
              <p className="mt-0.5 text-right text-xs text-slate-500">
                {isOwe ? `You owe ${firstName}` : `${firstName} owes you`} · {card.items.length} item(s) add up exactly
              </p>
            </div>
          </div>

          {isOwe ? (
            <PayInline
              key={`${card.other_user_id}-${Math.max(0, card.net_cents - card.pending_sent_cents)}`}
              otherName={card.other_user_name}
              owedCents={card.net_cents}
              pendingCents={card.pending_sent_cents}
              onPay={(cents) => onPay(card.other_user_id, cents)}
            />
          ) : (
            <div className="flex items-center justify-between gap-3 border-t border-slate-200/80 px-4 py-3">
              <p className="min-w-0 text-xs text-slate-500">
                {incomingClaimCents > 0
                  ? `${firstName} marked a payment. Confirm it in the alert at the top.`
                  : `${firstName} pays you; you confirm when it arrives.`}
              </p>
            </div>
          )}
        </div>
      )}
    </article>
  )
})

export default PersonBillCard
