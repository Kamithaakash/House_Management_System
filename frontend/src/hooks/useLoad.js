import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

// Loads data from the API and lets the page reload it after an action.
export default function useLoad(path) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const reload = useCallback(() => {
    api(path)
      .then((result) => {
        setData(result)
        setError('')
      })
      .catch((err) => setError(err.message))
  }, [path])

  useEffect(() => {
    reload()
  }, [reload])

  return { data, error, reload }
}
