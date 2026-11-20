import { Link } from 'react-router-dom'
import InstallPrompt from '../components/InstallPrompt'
import PublicFooter from '../components/PublicFooter'
import usePageMeta from '../hooks/usePageMeta'

export default function Install() {
  usePageMeta(
    'Install App | Vimana Boarding House',
    'How to install the Vimana boarding house web app (PWA) on Android and iPhone home screens for fast access without app stores.',
  )

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <header className="mb-4 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 font-bold text-indigo-700">
          <img
            src="/main-logo.png"
            alt="Vimana logo"
            width="36"
            height="36"
            className="h-9 w-9 object-contain"
          />
          <span>Vimana</span>
        </Link>
      </header>

      <h1 className="text-2xl font-bold text-indigo-700">Install Vimana on Your Phone</h1>
      <p className="mt-2 text-sm text-slate-600">
        Vimana works as an installable Progressive Web App (PWA) on both Android and iPhone with
        automatic updates and persistent login.
      </p>

      <section className="mt-6 space-y-3">
        <article className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Android (Chrome)</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>Open <strong>vimana.site</strong> in Google Chrome.</li>
            <li>Tap <strong>Install app on this phone</strong> below (or tap the menu &#8942; &rarr; <strong>Add to Home screen</strong>).</li>
            <li>Open Vimana from your home screen and log in once.</li>
          </ol>
        </article>

        <article className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="font-semibold">iPhone (Safari)</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>Open <strong>vimana.site</strong> in Safari.</li>
            <li>Tap the <strong>Share</strong> icon at the bottom of the screen.</li>
            <li>Select <strong>Add to Home Screen</strong> and tap <strong>Add</strong>.</li>
          </ol>
        </article>
      </section>

      <div className="mt-6 space-y-3">
        <InstallPrompt />
        <Link
          to="/login"
          className="flex min-h-12 items-center justify-center rounded-lg bg-indigo-600 font-medium text-white"
        >
          Log in to Vimana
        </Link>
      </div>

      <PublicFooter />
    </main>
  )
}
