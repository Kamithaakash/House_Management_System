import { useState } from 'react'
import { Button, ErrorText, Page, cardClass, inputClass, labelClass } from '../components/ui'
import useAction from '../hooks/useAction'
import useLoad from '../hooks/useLoad'
import usePageMeta from '../hooks/usePageMeta'
import { api } from '../services/api'
import { formatCents, rupeesToCents } from '../utils/money'

function Field({ id, label, ...props }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <input id={id} {...props} className={inputClass} />
    </div>
  )
}

function AddMember() {
  const empty = { name: '', email: '', phone: '', password: '' }
  const [form, setForm] = useState(empty)
  const [done, setDone] = useState('')
  const { busy, error, run } = useAction()
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  async function save() {
    setDone('')
    const body = { ...form, phone: form.phone || null, role: 'member' }
    const ok = await run(() => api('/admin/members', { method: 'POST', body }))
    if (ok) {
      setDone(`${form.name} added`)
      setForm(empty)
    }
  }

  return (
    <section className={`${cardClass} space-y-3`}>
      <h2 className="font-semibold">Add member</h2>
      <Field id="mname" label="Name" value={form.name} onChange={set('name')} />
      <Field id="memail" label="Email" type="email" value={form.email} onChange={set('email')} />
      <Field id="mphone" label="WhatsApp number (94771234567)" inputMode="numeric" value={form.phone} onChange={set('phone')} />
      <Field id="mpass" label="Password (10+ characters)" type="password" value={form.password} onChange={set('password')} />
      <ErrorText text={error} />
      {done && <p className="text-sm text-emerald-700">{done}</p>}
      <Button busy={busy} onClick={save}>Add member</Button>
    </section>
  )
}

function CleaningSetup({ members }) {
  const [name, setName] = useState('')
  const [order, setOrder] = useState('')
  const [picked, setPicked] = useState(new Set())
  const [done, setDone] = useState('')
  const { busy, error, run } = useAction()

  function toggle(id) {
    const next = new Set(picked)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setPicked(next)
  }

  async function createGroup() {
    setDone('')
    const body = { name, rotation_order: Number(order), member_ids: [...picked] }
    const ok = await run(() => api('/admin/cleaning/groups', { method: 'POST', body }))
    if (ok) {
      setDone(`${name} created`)
      setName('')
      setOrder('')
      setPicked(new Set())
    }
  }

  async function start() {
    setDone('')
    const ok = await run(() => api('/admin/cleaning/start', { method: 'POST' }))
    if (ok) setDone('Cleaning queue started')
  }

  return (
    <section className={`${cardClass} space-y-3`}>
      <h2 className="font-semibold">Cleaning groups</h2>
      <Field id="gname" label="Group name" value={name} onChange={(e) => setName(e.target.value)} />
      <Field id="gorder" label="Rotation order (1, 2, 3...)" inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value)} />
      <fieldset>
        <legend className={labelClass}>Members</legend>
        {members.map((m) => (
          <div key={m.id} className="flex min-h-12 items-center gap-3">
            <input id={`g${m.id}`} type="checkbox" className="h-6 w-6" checked={picked.has(m.id)} onChange={() => toggle(m.id)} />
            <label htmlFor={`g${m.id}`}>{m.name}</label>
          </div>
        ))}
      </fieldset>
      <ErrorText text={error} />
      {done && <p className="text-sm text-emerald-700">{done}</p>}
      <Button busy={busy} onClick={createGroup}>Create group</Button>
      <Button variant="light" busy={busy} onClick={start}>Start cleaning queue</Button>
    </section>
  )
}

function Penalties({ members }) {
  const obligations = useLoad('/admin/penalties/obligations')
  const [userId, setUserId] = useState('')
  const [points, setPoints] = useState('1')
  const [reason, setReason] = useState('')
  const [materials, setMaterials] = useState({})
  const [done, setDone] = useState('')
  const { busy, error, run } = useAction()

  async function addPoints() {
    setDone('')
    const body = { user_id: Number(userId), points: Number(points), reason }
    let result
    const ok = await run(async () => {
      result = await api('/admin/penalties', { method: 'POST', body })
    })
    if (ok) {
      setDone(`Now ${result.active_points} / ${result.threshold} points`)
      setReason('')
      obligations.reload()
    }
  }

  const fulfill = (id, type) =>
    run(async () => {
      const body = { redemption_type: type, material_name: type === 'material' ? materials[id] || 'Cleaning material' : null }
      await api(`/admin/penalties/obligations/${id}/fulfill`, { method: 'POST', body })
      obligations.reload()
    })

  return (
    <section className={`${cardClass} space-y-3`}>
      <h2 className="font-semibold">Penalties</h2>
      <div>
        <label htmlFor="puser" className={labelClass}>Member</label>
        <select id="puser" value={userId} onChange={(e) => setUserId(e.target.value)} className={inputClass}>
          <option value="">Choose...</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <Field id="ppoints" label="Points" inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value)} />
      <Field id="preason" label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      <ErrorText text={error} />
      {done && <p className="text-sm text-emerald-700">{done}</p>}
      <Button busy={busy} disabled={!userId || reason.length < 2} onClick={addPoints}>Add penalty points</Button>

      {obligations.data?.map((o) => (
        <div key={o.id} className="rounded-lg bg-red-50 p-3">
          <p className="text-sm">
            <strong>{o.user_name}</strong> must pay {formatCents(o.amount_cents)} or bring materials
          </p>
          <input
            aria-label="Material name" placeholder="Material (e.g. Harpic)" className={inputClass}
            value={materials[o.id] ?? ''} onChange={(e) => setMaterials({ ...materials, [o.id]: e.target.value })}
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button busy={busy} onClick={() => fulfill(o.id, 'cash')}>Cash received</Button>
            <Button variant="light" busy={busy} onClick={() => fulfill(o.id, 'material')}>Material received</Button>
          </div>
        </div>
      ))}
    </section>
  )
}

function Settings() {
  const [threshold, setThreshold] = useState('3')
  const [fine, setFine] = useState('500.00')
  const [done, setDone] = useState('')
  const { busy, error, run } = useAction()

  async function save() {
    setDone('')
    const fineCents = rupeesToCents(fine)
    if (!fineCents) return run(async () => { throw new Error('Enter a valid fine amount') })
    const body = { penalty_threshold: Number(threshold), default_fine_cents: fineCents }
    const ok = await run(() => api('/admin/settings', { method: 'PUT', body }))
    if (ok) setDone('Saved')
  }

  return (
    <section className={`${cardClass} space-y-3`}>
      <h2 className="font-semibold">Penalty rules</h2>
      <Field id="threshold" label="Points before a fine" inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
      <Field id="fine" label="Fine (Rs.)" inputMode="decimal" value={fine} onChange={(e) => setFine(e.target.value)} />
      <ErrorText text={error} />
      {done && <p className="text-sm text-emerald-700">{done}</p>}
      <Button busy={busy} onClick={save}>Save rules</Button>
    </section>
  )
}

function Reminders() {
  const [list, setList] = useState(null)
  const [clicked, setClicked] = useState(new Set())
  const { busy, error, run } = useAction()

  const generate = () => run(async () => {
    setList(await api('/admin/reminders'))
    setClicked(new Set())
  })

  return (
    <section className={`${cardClass} space-y-3`}>
      <h2 className="font-semibold">WhatsApp reminders</h2>
      <ErrorText text={error} />
      <Button busy={busy} onClick={generate}>Generate reminders</Button>
      {list && list.length === 0 && <p className="text-sm text-slate-500">Nobody needs a reminder.</p>}
      {list?.map((r) => (
        <div key={r.user_id} className="rounded-lg bg-slate-50 p-3">
          <p className="font-medium">{r.name}</p>
          <p className="whitespace-pre-line text-sm text-slate-600">{r.message}</p>
          {/* Only open real WhatsApp links */}
          {r.wa_me_url?.startsWith('https://wa.me/') ? (
            <a
              href={r.wa_me_url} target="_blank" rel="noopener noreferrer"
              onClick={() => setClicked(new Set(clicked).add(r.user_id))}
              className="mt-2 flex min-h-12 items-center justify-center rounded-lg bg-emerald-600 font-medium text-white"
            >
              {clicked.has(r.user_id) ? 'Sent ✓ (send again)' : 'Send via WhatsApp'}
            </a>
          ) : (
            <p className="mt-2 text-sm text-red-600">No phone number saved.</p>
          )}
        </div>
      ))}
    </section>
  )
}

export default function Admin() {
  usePageMeta('Admin | Boarding Management System', '', true) // private: noindex

  const members = useLoad('/members').data || []

  return (
    <Page title="Admin panel">
      <Reminders />
      <Penalties members={members} />
      <CleaningSetup members={members} />
      <Settings />
      <AddMember />
    </Page>
  )
}
