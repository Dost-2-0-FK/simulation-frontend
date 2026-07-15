// Minimal stand-in for the credit-exchanger service, for local frontend testing
// when the real service isn't running. Accepts every call the backend makes
// (see ../../simulation/src/services/credit_exchange_service/mod.rs) and
// always succeeds, so base/trust creation, financing and hourly income reads
// don't 500.
//
// Run with: node scripts/mock-credit-exchanger.js
// Listens on http://127.0.0.1:18080 to match simulation.toml's credit_exchange_url.

const http = require('node:http')

const PORT = 18080

function readBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => resolve(data ? JSON.parse(data) : null))
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const body = await readBody(req)
  console.log(`${req.method} ${url.pathname}`, body ?? '')

  // GET /api/users/:id/credits -> hourly income lookup
  if (req.method === 'GET' && /^\/api\/users\/[^/]+\/credits$/.test(url.pathname)) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ credits: [{ creditType: 'money', hourly: 0 }] }))
    return
  }

  // POST /api/users, /api/users/:id/bookings, /api/users/:id/subscriptions
  // PATCH /api/users/:id
  if (
    (req.method === 'POST' && /^\/api\/users(\/[^/]+\/(bookings|subscriptions))?$/.test(url.pathname)) ||
    (req.method === 'PATCH' && /^\/api\/users\/[^/]+$/.test(url.pathname))
  ) {
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
