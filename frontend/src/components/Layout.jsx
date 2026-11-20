import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  ['/dashboard', '🏠', 'Home'],
  ['/add-expense', '➕', 'Add'],
  ['/my-bill', '🧾', 'Bill'],
  ['/balances', '💸', 'Pay'],
  ['/chores', '🧹', 'Chores'],
]

// Mobile layout: content on top, thumb-friendly tab bar at the bottom.
// Suspense lives INSIDE Layout so the bottom tab bar never vanishes while switching tabs.
export default function Layout() {
  return (
    <div className="mx-auto min-h-screen max-w-md">
      <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <img
          src="/main-logo.png"
          alt="Vimana logo"
          width="32"
          height="32"
          className="h-8 w-8 object-contain"
        />
        <span className="text-base font-bold text-indigo-700">Vimana</span>
      </header>

      <main className="p-4 pb-28">
        <Suspense fallback={<p className="py-8 text-center text-sm text-slate-500">Loading...</p>}>
          <Outlet />
        </Suspense>
      </main>

      <nav
        aria-label="Main menu"
        className="fixed bottom-0 left-1/2 grid w-full max-w-md -translate-x-1/2 grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
      >
        {TABS.map(([path, icon, label]) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex min-h-14 flex-col items-center justify-center text-xs ${
                isActive ? 'font-bold text-indigo-700' : 'text-slate-500'
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
