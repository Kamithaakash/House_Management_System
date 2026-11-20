import useOnlineStatus from '../hooks/useOnlineStatus'

export default function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null

  return (
    <div role="alert" className="bg-red-600 px-4 py-2 text-center text-sm text-white">
      No internet connection. You can view pages, but saving is disabled.
    </div>
  )
}
