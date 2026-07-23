// Minimal stand-in for the credit-exchanger service, for local frontend testing
// when the real service isn't running. Accepts every call the backend makes
// (see ../../simulation/src/services/credit_exchange_service/mod.rs) and
// always succeeds, so base/trust creation, financing and hourly income reads
// don't 500.
//
// Tracks published production (PATCH .../:id) and financing subscriptions
// (POST .../:id/subscriptions) well enough to derive real, nonzero hourly
// income for a receiver, so the backend's production-cycle -> unit-spawn loop
// actually works end to end locally. A bloc's income normally comes only from
// its own bases' accumulated combat loot (production_count), which is zero
// for a fresh world with no combat history yet, so each bloc below is also
// seeded with a starter self-subscription -- otherwise local testing would be
// stuck waiting for combat to fund the very units needed to start combat.
//
// Run with: node scripts/mock-credit-exchanger.js
// Listens on http://127.0.0.1:18080 to match simulation.toml's credit_exchange_url.

const http = require('node:http')

const PORT = 18080

// Blocs seeded with starter income so local testing doesn't require prior combat loot.
const SEEDED_BLOCS = ['h3Eg-kdoZ-G1bx-rK5W', 'r6B8-XeFz-cg6C-xMIq', 'neutral']
const SEEDED_HOURLY = { money: 5000, lsc: 50, oxygen: 150, solar_energy: 100, water: 200 }

// producerId -> creditType -> lastDayAverage (set via PATCH /api/users/:id)
const production = new Map()
// { producer, receiver, creditType, value } -- value is a 0-100 percentage share
const subscriptions = []

for (const bloc of SEEDED_BLOCS) {
  production.set(bloc, new Map(Object.entries(SEEDED_HOURLY)))
  for (const creditType of Object.keys(SEEDED_HOURLY)) {
    subscriptions.push({ producer: bloc, receiver: bloc, creditType, value: 100 })
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => resolve(data ? JSON.parse(data) : null))
  })
}

function hourlyIncomeFor(userId) {
  const totals = new Map()
  for (const sub of subscriptions) {
    if (sub.receiver !== userId) continue
    const rate = production.get(sub.producer)?.get(sub.creditType) ?? 0
    totals.set(sub.creditType, (totals.get(sub.creditType) ?? 0) + rate * (sub.value / 100))
  }
  return [...totals.entries()].map(([creditType, hourly]) => ({ creditType, hourly }))
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const body = await readBody(req)
  console.log(`${req.method} ${url.pathname}`, body ?? '')

  // GET /api/users/:id/credits -> hourly income lookup, derived from tracked
  // production + subscriptions (see hourlyIncomeFor above).
  const creditsMatch = req.method === 'GET' && url.pathname.match(/^\/api\/users\/([^/]+)\/credits$/)
  if (creditsMatch) {
    const credits = hourlyIncomeFor(decodeURIComponent(creditsMatch[1]))
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ credits: credits.length > 0 ? credits : [{ creditType: 'money', hourly: 0 }] }))
    return
  }

  // GET /api/users -> resource totals lookup (summed across every non-bank user) when
  // listing trusts. An empty list is a valid Vec<CreditUserResponse> and sums to zero.
  if (req.method === 'GET' && url.pathname === '/api/users') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end('[]')
    return
  }

  // POST /api/users/:producer/subscriptions -> records a share of the producer's
  // production credited to `receiver`, so later /credits lookups reflect it.
  const subscriptionMatch = req.method === 'POST' && url.pathname.match(/^\/api\/users\/([^/]+)\/subscriptions$/)
  if (subscriptionMatch) {
    subscriptions.push({
      producer: decodeURIComponent(subscriptionMatch[1]),
      receiver: body.receiver,
      creditType: body.creditType,
      value: body.value,
    })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end('{}')
    return
  }

  // PATCH /api/users/:id -> records the user's current production rate for a credit type.
  const patchMatch = req.method === 'PATCH' && url.pathname.match(/^\/api\/users\/([^/]+)$/)
  if (patchMatch) {
    const userId = decodeURIComponent(patchMatch[1])
    if (!production.has(userId)) production.set(userId, new Map())
    production.get(userId).set(body.creditType, body.lastDayAverage)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end('{}')
    return
  }

  // POST /api/users, /api/users/:id/bookings
  if (req.method === 'POST' && /^\/api\/users(\/[^/]+\/bookings)?$/.test(url.pathname)) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end('{}')
    return
  }

  console.warn(`unhandled ${req.method} ${url.pathname}`)
  res.writeHead(404)
  res.end()
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`mock credit-exchanger listening on http://127.0.0.1:${PORT}`)
})
