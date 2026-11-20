import { Button, ErrorText, Page, cardClass } from '../components/ui'
import useAction from '../hooks/useAction'
import useLoad from '../hooks/useLoad'
import usePageMeta from '../hooks/usePageMeta'
import { api } from '../services/api'
import { formatCents } from '../utils/money'

const STATUS = {
  active: ['Active', 'bg-emerald-100 text-emerald-800'],
  overdue: ['Overdue - next group is blocked', 'bg-red-100 text-red-800'],
  pending_approval: ['Waiting for approval', 'bg-amber-100 text-amber-800'],
}

export default function Chores() {
  usePageMeta('Cleaning Turns | Boarding Management System', '', true) // private: noindex

  const chores = useLoad('/chores')
  const penalties = useLoad('/penalties/me')
  const { busy, error, run } = useAction()

  if (chores.error) return <ErrorText text={chores.error} />
  if (!chores.data) return <p>Loading...</p>

  const turn = chores.data.current_turn
  const act = (path) =>
    run(async () => {
      await api(path, { method: 'POST' })
      chores.reload()
    })

  return (
    <Page title="Cleaning Turns">
      <ErrorText text={error} />

      {turn ? (
        <section className={cardClass}>
          <h2 className="text-lg font-semibold">{turn.group_name}</h2>
          <span className={`mt-1 inline-block rounded-full px-3 py-1 text-xs ${STATUS[turn.status][1]}`}>
            {STATUS[turn.status][0]}
          </span>
          <p className="mt-2 text-sm text-slate-600">Due: {turn.due_date}</p>

          <div className="mt-3 space-y-2">
            {(turn.status === 'active' || turn.status === 'overdue') && (
              <Button busy={busy} onClick={() => act(`/chores/${turn.id}/mark-done`)}>Mark as done</Button>
            )}
            {turn.status === 'pending_approval' && (
              <Button busy={busy} onClick={() => act(`/chores/${turn.id}/approve`)}>
                Approve (next group or admin)
              </Button>
            )}
          </div>
        </section>
      ) : (
        <p className="text-slate-500">No cleaning turn is running yet. Ask the admin to start the queue.</p>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">Groups</h2>
        {chores.data.groups.map((g) => (
          <p key={g.id} className={cardClass}>
            <strong>{g.rotation_order}. {g.name}</strong>
            <span className="block text-sm text-slate-600">{g.member_names.join(', ')}</span>
          </p>
        ))}
      </section>

      {penalties.data && (
        <section className={cardClass}>
          <h2 className="font-semibold">My penalty points</h2>
          <p className="text-2xl font-bold">{penalties.data.active_points} / {penalties.data.threshold}</p>
          {penalties.data.obligations
            .filter((o) => o.status === 'pending')
            .map((o) => (
              <p key={o.id} className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                Pay a fine of {formatCents(o.amount_cents)} or bring cleaning materials (Harpic, brush, broom, soap).
              </p>
            ))}
        </section>
      )}
    </Page>
  )
}
