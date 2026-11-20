import useOnlineStatus from '../hooks/useOnlineStatus'

// Shared style strings (Flyweight): defined once, reused on every screen.
// Semantic FinTech palette: Indigo = app actions, Red = you owe/danger, Green = owed to you/settled.
// text-base (16px) on inputs stops phones from zooming in when you tap a field.
export const inputClass =
  'mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-base transition focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100'
export const labelClass = 'block text-sm font-medium text-slate-700'
export const cardClass = 'rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm'

const COLORS = {
  primary: 'bg-indigo-700 text-white shadow-sm hover:bg-indigo-800',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
  light: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
}

// Big touch-friendly button. Locks while busy or offline.
export function Button({ busy = false, variant = 'primary', children, className = '', ...props }) {
  const online = useOnlineStatus()
  return (
    <button
      type="button"
      {...props}
      disabled={busy || !online || props.disabled}
      className={`min-h-12 w-full rounded-xl px-4 font-semibold transition active:scale-[0.99] disabled:opacity-50 ${COLORS[variant]} ${className}`}
    >
      {busy ? 'Please wait...' : children}
    </button>
  )
}

export function ErrorText({ text }) {
  return text ? (
    <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {text}
    </p>
  ) : null
}

export function Page({ title, children }) {
  return (
    <>
      <h1 className="mb-4 text-xl font-bold tracking-tight text-slate-900">{title}</h1>
      <div className="space-y-4">{children}</div>
    </>
  )
}
