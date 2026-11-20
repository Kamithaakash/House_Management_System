import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import { formatCents } from '../utils/money'
import usePageMeta from '../hooks/usePageMeta'

export default function MyBill() {
  usePageMeta('My Bill | Boarding Management System', '', true) // private: noindex

  const [bill, setBill] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/expenses/my-bill').then(setBill).catch((err) => setError(err.message))
  }, [])

  if (error) return <p role="alert" className="p-6 text-red-600">{error}</p>
  if (!bill) return <p className="p-6">Loading...</p>

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/dashboard" className="text-sm text-indigo-700">&larr; Back</Link>
      <h1 className="mt-2 text-2xl font-bold">My Bill</h1>

      <div className="mt-4 overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Item</th>
              <th className="p-3">Paid by</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-right">Your share</th>
            </tr>
          </thead>
          <tbody>
            {bill.rows.map((row) => (
              <tr key={row.expense_id} className="border-t">
                <td className="p-3">{row.expense_date}</td>
                <td className="p-3">{row.item_name}</td>
                <td className="p-3">{row.paid_by_name}</td>
                <td className="p-3 text-right">{formatCents(row.total_cents)}</td>
                <td className="p-3 text-right">{formatCents(row.your_share_cents)}</td>
              </tr>
            ))}
            {bill.rows.length === 0 && (
              <tr><td colSpan="5" className="p-3 text-slate-500">No transactions yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="mt-4 rounded-lg bg-white p-4 shadow">
        <p>Total you owe: <strong>{formatCents(bill.total_you_owe_cents)}</strong></p>
        <p>Total owed to you: <strong>{formatCents(bill.total_owed_to_you_cents)}</strong></p>
        <p className="mt-2 text-lg">
          Net: <strong>{formatCents(Math.abs(bill.net_cents))}</strong>{' '}
          {bill.net_cents >= 0 ? 'to receive' : 'to pay'}
        </p>
      </section>
    </main>
  )
}
