import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button, ErrorText, inputClass, labelClass } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import useAction from '../hooks/useAction'
import usePageMeta from '../hooks/usePageMeta'

export default function Login() {
  usePageMeta('Log in | Vike Pamana — Vimana', 'Log in to your Vike Pamana (Vimana) boarding house account.')

  const { user, login } = useAuth()
  const navigate = useNavigate()
  const { busy, error, run } = useAction()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  if (user) return <Navigate to="/dashboard" replace />

  async function handleSubmit(event) {
    event.preventDefault()
    const ok = await run(() => login(email.trim(), password))
    if (ok) navigate('/dashboard')
  }

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold">Log in</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-xl bg-white p-5 shadow-sm">
        <div>
          <label htmlFor="email" className={labelClass}>Email</label>
          <input
            id="email" type="email" required autoComplete="username" inputMode="email"
            value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="password" className={labelClass}>Password</label>
          <input
            id="password" type="password" required autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass}
          />
        </div>
        <ErrorText text={error} />
        <Button type="submit" busy={busy}>Log in</Button>
      </form>
    </main>
  )
}
