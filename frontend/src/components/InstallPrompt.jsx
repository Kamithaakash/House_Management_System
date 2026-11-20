import { useEffect, useState } from 'react'

// Shows an "Install app" button (Android/Chrome) or a tip for iPhone.
export default function InstallPrompt() {
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
        className="min-h-12 w-full rounded-lg bg-emerald-600 px-4 font-medium text-white"
      >
        Install app on this phone
      </button>
    )
  }

  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    return (
      <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
        To install on iPhone: tap the Share button, then &quot;Add to Home Screen&quot;.
      </p>
    )
  }
  return null
}
