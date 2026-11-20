import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  ['/dashboard', '🏠', 'Home'],
  ['/add-expense', '➕', 'Add'],
  ['/my-bill', '🧾', 'Bill'],
  ['/balances', '💸', 'Pay'],
  ['/chores', '🧹', 'Chores'],
]

// Mobile layout: content on top, thumb-friendly tab bar at the bottom.
export default function Layout() {
  return (
    <div className="mx-auto min-h-screen max-w-md">
      <main className="p-4 pb-28">
        <Outlet />
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
