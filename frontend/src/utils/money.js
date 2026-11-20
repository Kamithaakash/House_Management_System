// Shared money helpers (Flyweight: ONE formatter reused everywhere).
// Money stays in integer cents. We only divide by 100 for DISPLAY.
const formatter = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
})

export function formatCents(cents) {
  return formatter.format(cents / 100)
}

// Turn "450.50" typed by the user into integer cents (45050) without floats.
export function rupeesToCents(text) {
  const clean = String(text).trim()
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null
  const [rupees, decimals = ''] = clean.split('.')
  return Number(rupees) * 100 + Number(decimals.padEnd(2, '0'))
}
