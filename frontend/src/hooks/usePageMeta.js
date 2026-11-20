import { useEffect } from 'react'

// Sets the page title, description and robots tag for each page.
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
  }, [title, description, noindex])
}
