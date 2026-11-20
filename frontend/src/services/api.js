// API client (Facade): every request goes through here.
// Cookies (short access_token + 30-day refresh_token) are sent automatically.

let refreshInFlight = null

async function tryRefresh() {
  if (!refreshInFlight) {
    refreshInFlight = fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

export async function api(path, { method = 'GET', body } = {}, allowRetry = true) {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  // If the 30-min access cookie expired, silently renew using the 30-day refresh cookie
  if (
    response.status === 401 &&
    allowRetry &&
    path !== '/auth/login' &&
    path !== '/auth/logout' &&
    path !== '/auth/refresh'
  ) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      return api(path, { method, body }, false)
    }
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    // Only kick back to /login if refresh also failed
    if (response.status === 401 && path !== '/auth/login' && path !== '/auth/me') {
      window.dispatchEvent(new Event('auth:expired'))
    }
    const detail = Array.isArray(data.detail)
      ? data.detail.map((d) => d.msg).join(', ')
      : data.detail
    const error = new Error(detail || 'Something went wrong')
    error.status = response.status
    throw error
  }
  return data
}
