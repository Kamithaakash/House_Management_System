import { Link } from 'react-router-dom'

const CURRENT_YEAR = new Date().getFullYear()

export default function PublicFooter() {
  return (
    <footer className="mt-10 border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
      <nav aria-label="Public pages" className="flex flex-wrap justify-center gap-4 font-medium text-indigo-700">
        <Link to="/">Home</Link>
        <Link to="/features">Features</Link>
        <Link to="/about">About</Link>
        <Link to="/login">Log in</Link>
      </nav>
      <p className="mt-3 text-slate-400">© {CURRENT_YEAR} Vike Pamana • Vimana • vimana.site</p>
    </footer>
  )
}
