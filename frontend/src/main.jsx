import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Auto-reload once if Vite hits a stale CSS/JS chunk right after a new Vercel deployment
window.addEventListener('vite:preloadError', () => {
  const key = 'vimana_preload_reloaded'
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, '1')
    window.location.reload()
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
