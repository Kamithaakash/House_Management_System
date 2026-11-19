---
name: seo-architecture
description: SEO, crawlability, social-preview and PWA-metadata rules for the Boarding Management System. Use whenever creating or changing any page, route, index.html, robots.txt, sitemap.xml, manifest, or deployment headers.
---

# SEO Architecture Skill

Principle: **public pages are discoverable; private pages are never indexed.** `robots.txt` and `noindex` only control search engines. They are NOT security. Real protection is authentication (see `.agent/rules/10-security.md`).

## 1. Route classification

| Route | Type | Indexed? |
|---|---|---|
| `/` landing, `/features`, `/login` | Public | Yes (login: optional, `index,follow` is fine) |
| `/dashboard`, `/my-bill`, `/balances`, `/chores`, `/admin`, `/api/*` | Private | NO (`noindex, nofollow`, `Disallow`) |

Every new route must be added to this table and handled accordingly.

## 2. Files to maintain (`frontend/public/`)

`robots.txt`
```
User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /my-bill
Disallow: /balances
Disallow: /chores
Disallow: /admin
Disallow: /api/
Sitemap: https://YOUR-DOMAIN/sitemap.xml
```

`sitemap.xml` lists ONLY public URLs (`/`, `/features`, `/login`) with `<lastmod>`. Never list private routes.

## 3. Metadata (`index.html` + per-route)
- Unique `<title>` (50-60 chars) and `<meta name="description">` (120-160 chars) per public page.
- `<html lang="en">`, `<meta charset>`, `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- `<link rel="canonical" href="https://YOUR-DOMAIN/...">` on public pages.
- Open Graph + Twitter: `og:title`, `og:description`, `og:image` (1200x630, absolute HTTPS URL), `og:url`, `og:type=website`, `twitter:card=summary_large_image`. This gives clean WhatsApp link previews.
- `theme-color`, `apple-touch-icon`, favicon.
- Private pages must set `<meta name="robots" content="noindex, nofollow">`.
- Because this is a React SPA, update head per route (e.g. `react-helmet-async`, or a tiny `usePageMeta(title, description, {noindex})` hook). The private-route wrapper (`ProtectedRoute`) must always apply `noindex`.
- Also send `X-Robots-Tag: noindex, nofollow` header for private paths in `vercel.json` (defense in depth, includes `/api/*`).

## 4. Semantic HTML & accessibility (helps SEO)
- Exactly one `<h1>` per page; logical `h2`/`h3` order.
- Use `<header> <nav> <main> <section> <footer>`; buttons for actions, anchors (`<a href>`) for navigation.
- Descriptive link/button text (no "click here"). Every `<img>` has meaningful `alt` (empty `alt=""` if decorative) and explicit `width`/`height`.
- Form inputs have `<label>`; sufficient color contrast; touch targets >= 44px.

## 5. Performance = SEO (Core Web Vitals)
- Targets: LCP < 2.5s, INP < 200ms, CLS < 0.1 on mobile.
- Code-split private routes (`React.lazy`); keep landing page bundle small.
- Optimize images (WebP/AVIF, `loading="lazy"` below the fold, preload hero image).
- Self-host or `font-display: swap`; avoid layout shifts (reserve space).
- Cache static assets with long `Cache-Control: immutable` + hashed filenames (Vite does this).

## 6. Crawlability for the SPA
- Public pages must render meaningful content (headings, text) without requiring login or API calls.
- Add a `<noscript>` message with basic description/link.
- Client-side 404 route for unknown paths and proper `vercel.json` rewrite to `index.html`. Prefer returning real 404 status where possible.
- No duplicate content: one canonical URL (no trailing-slash/`www` duplicates; redirect in Vercel).
- Use clean, readable, lowercase, hyphenated URLs.
- Future: if public marketing pages grow (SaaS Phase 5), migrate public routes to Next.js SSR/SSG (see SRS 4.1).

## 7. Structured data (optional, public pages only)
JSON-LD `WebApplication` / `SoftwareApplication` with `name`, `description`, `applicationCategory`. Never include personal or boarding-house member data.

## 8. SEO + security interaction
- Never expose private data on public pages or in meta tags/OG previews.
- Don't leak private route names in `sitemap.xml`; `robots.txt` is public, so it reveals the Disallow paths. This is acceptable only because those routes require authentication.
- Don't put user names, amounts or phone numbers in URLs (they end up in logs, history, referrers). Use opaque IDs and fetch data after authentication.

## 9. Verification checklist (before finishing a page)
- [ ] Route classified public/private; private has `noindex` meta and `X-Robots-Tag`.
- [ ] Title, description, canonical, OG tags present (public).
- [ ] One `<h1>`, semantic landmarks, all images have `alt`.
- [ ] `robots.txt` and `sitemap.xml` updated.
- [ ] Lighthouse mobile run: Performance, Accessibility, SEO, Best Practices >= 90.
- [ ] Share link in WhatsApp shows a correct preview card.
- [ ] Test "SEO Privacy Guard" from SRS section 6 passes (`robots.txt` disallow + `noindex` on `/dashboard`).
