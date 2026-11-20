import { useState } from 'react'

// Runs a button action once at a time (double-submit guard) and keeps the error text.
export default function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(action) {
    if (busy) return false
    setBusy(true)
    setError('')
    try {
      await action()
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  return { busy, error, run }
}
