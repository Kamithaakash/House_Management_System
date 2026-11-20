import { formatCents } from '../utils/money'

// Clear, transparent card showing how a manual debt redirect happened (who redirected, from whom -> to whom).
export default function RedirectNoticeCard({ notice, currentUserId }) {
  const amount = formatCents(notice.amount_cents)
  let detail

  if (notice.from_debtor === currentUserId) {
    detail = `${notice.via_middleman_name} owed ${notice.to_creditor_name}, and you owed ${notice.via_middleman_name}. Please pay ${amount} directly to ${notice.to_creditor_name}.`
  } else if (notice.to_creditor === currentUserId) {
    detail = `${notice.from_debtor_name} owed ${notice.via_middleman_name}, and ${notice.via_middleman_name} owed you. ${notice.from_debtor_name} will pay you ${amount} directly.`
  } else if (notice.via_middleman === currentUserId) {
    detail = `You redirected ${amount} so ${notice.from_debtor_name} pays ${notice.to_creditor_name} directly.`
  } else {
    detail = `${notice.via_middleman_name} redirected ${amount} from ${notice.from_debtor_name} to ${notice.to_creditor_name}.`
  }

  return (
    <article className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-950">
      <div className="flex items-center justify-between gap-2 font-semibold">
        <span>
          {notice.from_debtor_name} &rarr; {notice.to_creditor_name}
        </span>
        <span>{amount}</span>
      </div>
      <p className="mt-1 text-xs font-medium text-indigo-700">
        Redirected by {notice.via_middleman_name}
      </p>
      <p className="mt-1 text-xs text-slate-700">{detail}</p>
    </article>
  )
}
