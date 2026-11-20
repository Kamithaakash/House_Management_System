import { useEffect } from 'react'

// Sets the page title, description, canonical link, and robots tag for each route.
// Private pages must pass noindex = true.
export default function usePageMeta(title, description, noindex = false) {
  useEffect(() => {
    document.title = title

    const setMeta = (name, content) => {
      let tag = document.querySelector(`meta[name="${name}"]`)
      if (!tag) {
        tag = document.createElement('meta')
        tag.setAttribute('name', name)
        document.head.appendChild(tag)
      }
      tag.setAttribute('content', content)
    }

    if (description) setMeta('description', description)
    setMeta('robots', noindex ? 'noindex, nofollow' : 'index, follow')

    // Keep canonical URL accurate for every public page
    if (!noindex) {
      let canonical = document.querySelector('link[rel="canonical"]')
      if (!canonical) {
        canonical = document.createElement('link')
        canonical.setAttribute('rel', 'canonical')
        document.head.appendChild(canonical)
      }
      const path = window.location.pathname === '/' ? '/' : window.location.pathname
      canonical.setAttribute('href', `https://vimana.site${path}`)
    }
  }, [title, description, noindex])
}
