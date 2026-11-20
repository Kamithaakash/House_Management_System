import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, ErrorText, Page, cardClass, inputClass, labelClass } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import useAction from '../hooks/useAction'
import useLoad from '../hooks/useLoad'
import usePageMeta from '../hooks/usePageMeta'
import { api } from '../services/api'
import { formatCents, rupeesToCents, splitEqually } from '../utils/money'

const SECTIONS = [
  ['food', 'Food'],
  ['boarding_fee', 'Monthly boarding fee'],
  ['electric_bill', 'Electricity bill'],
  ['water_bill', 'Water bill'],
  ['material', 'Other item'],
]
const FOODS = [
  ['rice_curry', 'Rice & Curry'],
  ['fried_rice', 'Fried Rice'],
  ['kottu', 'Kottu'],
  ['other', 'Other'],
]
const CURRIES = [
  ['veg', 'Veg'],
  ['egg', 'Egg'],
  ['fish', 'Fish'],
  ['meat', 'Meat'],
]

function Select({ id, label, value, onChange, options }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        {options.map(([val, text]) => (
          <option key={val} value={val}>{text}</option>
        ))}
      </select>
    </div>
  )
}

export default function AddExpense() {
  usePageMeta('Add Expense | Vimana', '', true) // private: noindex

  const { user } = useAuth()
  const navigate = useNavigate()
  const members = useLoad('/members').data || []
  const { busy, error, run } = useAction()

  const [section, setSection] = useState('food')
  const [itemName, setItemName] = useState('')
  const [foodType, setFoodType] = useState('rice_curry')
  const [curryType, setCurryType] = useState('veg')
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'))
  const [paidBy, setPaidBy] = useState(String(user.id))
  const [mode, setMode] = useState('equal')
  const [total, setTotal] = useState('')
  const [amounts, setAmounts] = useState({})
  const [excluded, setExcluded] = useState(new Set()) // everyone is included by default

  const includedIds = members.filter((m) => !excluded.has(m.id)).map((m) => m.id)

  function toggleMember(id) {
    const next = new Set(excluded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExcluded(next)
  }

  // Live preview of every person's exact share
  const preview = useMemo(() => {
    if (includedIds.length === 0) return { error: 'Pick at least one member' }

    if (mode === 'equal') {
      const totalCents = rupeesToCents(total)
      if (!totalCents) return { error: 'Enter a valid total amount' }
      return { totalCents, shares: splitEqually(totalCents, includedIds) }
    }

    const shares = {}
    let totalCents = 0
    for (const id of includedIds) {
      const cents = rupeesToCents(amounts[id] ?? '')
      if (cents === null) return { error: 'Enter an amount for every selected member' }
      shares[id] = cents
      totalCents += cents
    }
    if (totalCents === 0) return { error: 'Total must be more than 0' }
    return { totalCents, shares }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, total, amounts, excluded, members])

  const sectionLabel = SECTIONS.find(([v]) => v === section)[1]
  const foodLabel = FOODS.find(([v]) => v === foodType)[1]
  const nameToSend =
    itemName.trim() ||
    (section === 'food' ? foodLabel : section === 'material' ? '' : sectionLabel)

  async function save() {
    if (preview.error || !nameToSend) return
    const body = {
      paid_by: Number(paidBy),
      section,
      item_name: nameToSend,
      expense_date: date,
      split_mode: mode,
    }
    if (section === 'food') {
      body.food_type = foodType
      if (foodType === 'rice_curry') body.curry_type = curryType
    }
    if (mode === 'equal') {
      body.total_cents = preview.totalCents
      body.participant_ids = includedIds
    } else {
      body.per_person_cents = preview.shares
    }

    const ok = await run(() => api('/expenses', { method: 'POST', body }))
    if (ok) navigate('/my-bill')
  }

  const nameOf = (id) => members.find((m) => m.id === id)?.name ?? id

  return (
    <Page title="Add Expense">
      <section className={`${cardClass} space-y-3`}>
        <Select id="section" label="What is it for?" value={section} onChange={setSection} options={SECTIONS} />

        {section === 'food' && (
          <>
            <Select id="food" label="Food type" value={foodType} onChange={setFoodType} options={FOODS} />
            {foodType === 'rice_curry' && (
              <Select id="curry" label="Curry" value={curryType} onChange={setCurryType} options={CURRIES} />
            )}
          </>
        )}

        <div>
          <label htmlFor="item" className={labelClass}>
            {section === 'food' ? 'Note (optional)' : 'Description (e.g. March electricity)'}
          </label>
          <input id="item" maxLength={150} value={itemName} onChange={(e) => setItemName(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label htmlFor="date" className={labelClass}>Date</label>
          <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>

        <Select
          id="paidBy" label="Who paid?" value={paidBy} onChange={setPaidBy}
          options={members.map((m) => [String(m.id), m.name])}
        />
      </section>

      <section className={`${cardClass} space-y-3`}>
        <div className="grid grid-cols-2 gap-2">
          <Button variant={mode === 'equal' ? 'primary' : 'light'} onClick={() => setMode('equal')}>Split equally</Button>
          <Button variant={mode === 'per_person' ? 'primary' : 'light'} onClick={() => setMode('per_person')}>Per person</Button>
        </div>

        {mode === 'equal' && (
          <div>
            <label htmlFor="total" className={labelClass}>Total amount (Rs.)</label>
            <input id="total" inputMode="decimal" placeholder="0.00" value={total} onChange={(e) => setTotal(e.target.value)} className={inputClass} />
          </div>
        )}

        <fieldset>
          <legend className={labelClass}>Who is included?</legend>
          {members.map((m) => (
            <div key={m.id} className="flex min-h-12 items-center gap-3 border-b border-slate-100">
              <input
                id={`m${m.id}`} type="checkbox" className="h-6 w-6"
                checked={!excluded.has(m.id)} onChange={() => toggleMember(m.id)}
              />
              <label htmlFor={`m${m.id}`} className="flex-1">{m.name}</label>
              {mode === 'per_person' && !excluded.has(m.id) && (
                <input
                  aria-label={`Amount for ${m.name}`} inputMode="decimal" placeholder="0.00"
                  value={amounts[m.id] ?? ''} onChange={(e) => setAmounts({ ...amounts, [m.id]: e.target.value })}
                  className="w-28 rounded-lg border border-slate-300 p-2 text-base"
                />
              )}
            </div>
          ))}
        </fieldset>
      </section>

      <section className={cardClass} aria-live="polite">
        <h2 className="font-semibold">Preview</h2>
        {preview.error ? (
          <p className="text-sm text-slate-500">{preview.error}</p>
        ) : (
          <>
            {Object.entries(preview.shares).map(([id, cents]) => (
              <p key={id} className="flex justify-between text-sm">
                <span>{nameOf(Number(id))}</span><strong>{formatCents(cents)}</strong>
              </p>
            ))}
            <p className="mt-2 flex justify-between border-t pt-2 font-semibold">
              <span>Total</span><span>{formatCents(preview.totalCents)}</span>
            </p>
          </>
        )}
      </section>

      <ErrorText text={error} />
      {!nameToSend && <p className="text-sm text-amber-700">Enter an item description to save.</p>}
      <Button busy={busy} disabled={!!preview.error || !nameToSend} onClick={save}>Save expense</Button>
    </Page>
  )
}
