import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Button, ErrorText } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import useAction from '../hooks/useAction'
import usePageMeta from '../hooks/usePageMeta'

export default function Login() {
  usePageMeta('Log in | Vimana', 'Log in to your Vimana (Vike Pamana) boarding house account.')

  const { user, login } = useAuth()
  const navigate = useNavigate()
  const { busy, error, run } = useAction()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  if (user) return <Navigate to="/dashboard" replace />

  async function handleSubmit(event) {
    event.preventDefault()
    const ok = await run(() => login(email.trim(), password))
    if (ok) navigate('/dashboard')
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* Blurred full-screen boarding house background */}
      <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <img
          src="/login-bg.webp"
          alt=""
          className="h-full w-full scale-105 object-cover object-center blur-[3px]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/25 via-slate-900/20 to-slate-950/45" />
      </div>

      <main className="w-full max-w-sm">
        {/* Transparent frosted-glass login panel (no outline, background photo shines through) */}
        <div className="rounded-3xl bg-slate-950/20 p-6 shadow-2xl backdrop-blur-md">
          <div className="text-center">
            <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-2xl bg-white/85 p-2 shadow-md">
              <img
                src="/main-logo.png"
                alt="Vimana logo"
                width="56"
                height="56"
                className="h-14 w-14 object-contain"
              />
            </div>
            <h1 className="font-brand mt-3 text-3xl font-bold tracking-wide text-white drop-shadow-sm">
              Vimana
            </h1>
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-amber-200/90">
              Member Sign In
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white/90">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                inputMode="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl bg-white/85 p-3 text-base text-slate-900 placeholder:text-slate-400 shadow-inner transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white/90">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl bg-white/85 p-3 pr-16 text-base text-slate-900 placeholder:text-slate-400 shadow-inner transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/70"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <ErrorText text={error} />

            <Button type="submit" busy={busy} className="mt-2 shadow-lg">
              Log in
            </Button>
          </form>
        </div>

        <p className="mt-5 text-center">
          <Link
            to="/"
            className="inline-block rounded-full bg-black/35 px-4 py-1.5 text-xs font-medium text-white/95 backdrop-blur-sm hover:bg-black/50"
          >
            &larr; Back to Vimana Home
          </Link>
        </p>
      </main>
    </div>
  )
}
