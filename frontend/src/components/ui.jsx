import useOnlineStatus from '../hooks/useOnlineStatus'

// Shared style strings (Flyweight): defined once, reused on every screen.
// text-base (16px) on inputs stops phones from zooming in when you tap a field.
export const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-base'
export const labelClass = 'block text-sm font-medium text-slate-700'
export const cardClass = 'rounded-xl bg-white p-4 shadow-sm'

const COLORS = {
  primary: 'bg-indigo-600 text-white',
  danger: 'bg-red-600 text-white',
  light: 'border border-slate-300 bg-white text-slate-800',
}

// Big touch-friendly button. Locks while busy or offline.
export function Button({ busy = false, variant = 'primary', children, className = '', ...props }) {
  const online = useOnlineStatus()
  return (
    <button
      type="button"
      {...props}
      disabled={busy || !online || props.disabled}
      className={`min-h-12 w-full rounded-lg px-4 font-medium disabled:opacity-50 ${COLORS[variant]} ${className}`}
    >
      {busy ? 'Please wait...' : children}
    </button>
  )
}

export function ErrorText({ text }) {
  return text ? (
    <p role="alert" className="mt-2 text-sm text-red-600">
      {text}
    </p>
  ) : null
}

export function Page({ title, children }) {
  return (
    <>
      <h1 className="mb-4 text-xl font-bold">{title}</h1>
      <div className="space-y-4">{children}</div>
    </>
  )
}
