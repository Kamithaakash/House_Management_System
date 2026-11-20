import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

const STATIC_ROUTES = [
  {
    route: 'features',
    title: 'Features | Vimana Boarding House',
    description:
      'Explore Vimana (Vike Pamana) features: fair food & utility bill splitting, two-step payment confirmation, manual debt redirects, weekly cleaning rotation, and mobile PWA install.',
  },
  {
    route: 'install',
    title: 'Install App | Vimana Boarding House',
    description:
      'How to install the Vimana boarding house web app (PWA) on Android and iPhone home screens for fast access without app stores.',
  },
  {
    route: 'about',
    title: 'About | Vimana Boarding House',
    description:
      'About Vimana (Vike Pamana), the boarding house expense sharing and cleaning rotation web app for residents near the University of Moratuwa.',
  },
  {
    route: 'privacy',
    title: 'Privacy & Security | Vimana Boarding House',
    description:
      'How Vimana protects boarding house member privacy, bills, phone numbers, and login sessions using Argon2 encryption and HttpOnly cookies.',
  },
  {
    route: 'vike-pamana',
    title: 'Vike Pamana — Vimana Boarding House',
    description:
      'Vike Pamana boarding house portal on Vimana (vimana.site) for fair expense splitting, payment confirmation, and weekly cleaning rotation.',
  },
  {
    route: 'login',
    title: 'Log in | Vimana',
    description: 'Log in to your Vimana (Vike Pamana) boarding house account.',
  },
  { route: 'dashboard', title: 'Home | Vimana', noindex: true },
  { route: 'add-expense', title: 'Add Expense | Vimana', noindex: true },
  { route: 'my-bill', title: 'My Bill | Vimana', noindex: true },
  { route: 'history', title: 'History | Vimana', noindex: true },
  { route: 'balances', title: 'Balances & Payments | Vimana', noindex: true },
  { route: 'chores', title: 'Cleaning Turns | Vimana', noindex: true },
  { route: 'admin', title: 'Admin | Vimana', noindex: true },
]

// Emits clean route HTML files into dist/ so Vercel Services serves every route with 200 OK
// and exact per-page SEO title, description, canonical URL, or noindex tag before JS runs.
function staticRouteHtmlPlugin() {
  return {
    name: 'static-route-html',
    closeBundle() {
      const distDir = path.resolve('dist')
      const baseHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8')

      for (const item of STATIC_ROUTES) {
        const url = `https://vimana.site/${item.route}`
        let html = baseHtml.replace(/<title>[\s\S]*?<\/title>/, `<title>${item.title}</title>`)

        if (item.description) {
          html = html.replace(
            /<meta\s+name="description"[\s\S]*?\/>/,
            `<meta name="description" content="${item.description}" />`,
          )
          html = html.replace(
            /<meta\s+property="og:description"[\s\S]*?\/>/,
            `<meta property="og:description" content="${item.description}" />`,
          )
        }

        html = html
          .replace(/<meta\s+property="og:title"[\s\S]*?\/>/, `<meta property="og:title" content="${item.title}" />`)
          .replace(/<meta\s+property="og:url"[\s\S]*?\/>/, `<meta property="og:url" content="${url}" />`)

        if (item.noindex) {
          html = html.replace(
            /<link\s+rel="canonical"[\s\S]*?\/>/,
            '<meta name="robots" content="noindex, nofollow" />',
          )
        } else {
          html = html.replace(
            /<link\s+rel="canonical"[\s\S]*?\/>/,
            `<link rel="canonical" href="${url}" />`,
          )
        }

        fs.writeFileSync(path.join(distDir, `${item.route}.html`), html, 'utf-8')
      }
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Vimana — Boarding Manager',
        short_name: 'Vimana',
        description: 'Vimana helps boarding houses share expenses, settle payments and manage cleaning turns.',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        theme_color: '#1e293b',
        background_color: '#ffffff',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // Cache only the static app shell. Clean up old chunks immediately on new deploys.
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,svg,png,webp,ico}', 'index.html'],
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
    staticRouteHtmlPlugin(),
  ],
  server: {
    // Calls to /api/... go to the FastAPI backend (no CORS headaches in dev)
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
})
