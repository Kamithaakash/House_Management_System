// Shared money helpers (Flyweight: ONE formatter reused everywhere).
// Money stays in integer cents. We only divide by 100 for DISPLAY.
const formatter = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
})

export function formatCents(cents) {
  return formatter.format(cents / 100)
}

// 45050 -> "450.50" (no floats)
export function centsToText(cents) {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

// "450.50" typed by the user -> 45050 (no floats). Returns null if invalid.
export function rupeesToCents(text) {
  const clean = String(text).trim()
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null
  const [rupees, decimals = ''] = clean.split('.')
  return Number(rupees) * 100 + Number(decimals.padEnd(2, '0'))
}

// Same rule as the backend: extra cents go to the first users (sorted by id).
export function splitEqually(totalCents, ids) {
  const sorted = [...ids].sort((a, b) => a - b)
  const base = Math.floor(totalCents / sorted.length)
  const remainder = totalCents % sorted.length
  const shares = {}
  sorted.forEach((id, index) => {
    shares[id] = base + (index < remainder ? 1 : 0)
  })
  return shares
}
