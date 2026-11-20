import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  ['/dashboard', '🏠', 'Home'],
  ['/add-expense', '➕', 'Add'],
  ['/my-bill', '🧾', 'Bill'],
  ['/balances', '💸', 'Pay'],
  ['/chores', '🧹', 'Chores'],
]

// Mobile layout: sticky top brand bar, content in the middle, thumb-friendly tab bar at the bottom.
// Suspense lives INSIDE Layout so the header and bottom tab bar never vanish while switching tabs.
export default function Layout() {
  return (
    <div className="mx-auto min-h-screen max-w-md bg-slate-50">
      <header className="sticky top-0 z-10 flex items-center gap-2.5 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-md">
        <img
          src="/main-logo.png"
          alt="Vimana logo"
          width="32"
          height="32"
          className="h-8 w-8 object-contain"
        />
        <span className="text-base font-bold tracking-tight text-slate-900">Vimana</span>
      </header>

      <main className="p-4 pb-28">
        <Suspense fallback={<p className="py-8 text-center text-sm text-slate-500">Loading...</p>}>
          <Outlet />
        </Suspense>
      </main>

      <nav
        aria-label="Main menu"
        className="fixed bottom-0 left-1/2 z-10 grid w-full max-w-md -translate-x-1/2 grid-cols-5 border-t border-slate-200/80 bg-white/95 px-1 py-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))] backdrop-blur-md"
      >
        {TABS.map(([path, icon, label]) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex min-h-13 flex-col items-center justify-center rounded-xl text-xs transition ${
                isActive ? 'bg-rose-50 font-bold text-rose-800' : 'text-slate-500 hover:text-slate-800'
              }`
            }
          >
            <span aria-hidden="true" className="text-lg">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
