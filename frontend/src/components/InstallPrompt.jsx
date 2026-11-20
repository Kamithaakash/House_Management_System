import { useEffect, useState } from 'react'

// Shows an "Install app" button (Android/Chrome) or a sleek tip for iPhone.
export default function InstallPrompt({ dark = false }) {
  const [installEvent, setInstallEvent] = useState(null)

  useEffect(() => {
    const handler = (event) => {
      event.preventDefault()
      setInstallEvent(event)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const alreadyInstalled =
    window.matchMedia('(display-mode: standalone)').matches || navigator.standalone
  if (alreadyInstalled) return null

  if (installEvent) {
    return (
      <button
        onClick={async () => {
          installEvent.prompt()
          await installEvent.userChoice
          setInstallEvent(null)
        }}
        className={
          dark
            ? 'min-h-12 w-full rounded-xl border border-white/30 bg-white/15 px-4 font-semibold text-white backdrop-blur-md transition hover:bg-white/25'
            : 'min-h-12 w-full rounded-xl bg-emerald-600 px-4 font-semibold text-white shadow-sm hover:bg-emerald-700'
        }
      >
        Install app on this phone
      </button>
    )
  }

  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    return (
      <p
        className={
          dark
            ? 'rounded-xl border border-white/20 bg-white/15 px-4 py-2.5 text-xs text-white/90 backdrop-blur-md'
            : 'rounded-xl bg-slate-100 px-4 py-2.5 text-xs text-slate-600'
        }
      >
        On iPhone: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
      </p>
    )
  }
  return null
}
