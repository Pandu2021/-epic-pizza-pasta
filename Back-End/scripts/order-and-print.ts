import 'dotenv/config'
import http from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'
import { generateA6ReceiptPdf, OrderReceipt } from '../src/utils/receipt'
import { printPdfTo } from '../src/utils/printer-pdf'
import { printPdfViaShell } from '../src/utils/printer-win'

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`)
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1]
  return undefined
}

function requestRaw(url: string, opts: any = {}, body?: string) {
  return new Promise<{ status: number; headers: any; body: string }>((resolve, reject) => {
    const u = new URL(url)
    const mod = u.protocol === 'https:' ? https : http
    const req = mod.request({
      method: opts.method || 'GET',
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + (u.search || ''),
      headers: opts.headers || {}
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
      res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }))
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

function parseSetCookie(setCookie: any) {
  const cookies: string[] = []
  const arr = Array.isArray(setCookie) ? setCookie : (setCookie ? [setCookie] : [])
  for (const c of arr) {
    const semi = String(c).split(';')[0]
    if (semi) cookies.push(semi.trim())
  }
  return cookies
}

async function main() {
  const base = process.env.BASE_URL || 'http://localhost:4000/api'
  const printerName = getArg('printer') || process.env.WINDOWS_PRINTER_NAME
  const pay = (getArg('pay') || 'cod').toLowerCase() // cod | promptpay | card

  // Prepare a sample payload
  const payload = {
    customer: { name: 'Kitchen Test', phone: '+66801230000', address: '123 Order Line' },
    items: [
      { id: 'pizza-margherita', name: 'Margherita', qty: 1, price: 359 },
      { id: 'pasta-spag-bolognese', name: 'Spag. Bolognese', qty: 1, price: 199 }
    ],
    delivery: { type: 'delivery', fee: 39 },
    paymentMethod: pay,
  }
  let orderId = `id-${Date.now()}`
  try {
    // 1) CSRF
    const r1 = await requestRaw(base + '/auth/csrf', { method: 'GET', headers: { 'Accept': 'application/json' } })
    const r1json = JSON.parse(r1.body || '{}')
    const token = r1json.csrfToken || ''
    const cookies = parseSetCookie(r1.headers['set-cookie'])

    // 2) Order
    const body = JSON.stringify(payload)
    const r2 = await requestRaw(base + '/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'identity',
        'Cookie': cookies.join('; '),
        'X-CSRF-Token': token,
        'Content-Length': Buffer.byteLength(body)
      }
    }, body)

    if (r2.status >= 200 && r2.status < 300) {
      const orderResp = JSON.parse(r2.body)
      orderId = orderResp?.id || orderResp?.order?.id || orderId
      console.log('[order] created id =', orderId)
    } else {
      console.warn('[order] API responded non-2xx; simulating order. Status:', r2.status)
    }
  } catch (e) {
    console.warn('[order] API unreachable; simulating order flow.')
  }

  // 3) Build receipt (A6) and print via Windows
  const receipt: OrderReceipt = {
    id: orderId,
    dateISO: new Date().toISOString(),
    customer: payload.customer,
    items: payload.items,
    delivery: payload.delivery as any,
    paymentMethod: payload.paymentMethod,
  }
  const pdf = await generateA6ReceiptPdf(receipt)
  console.log('[print] A6 receipt generated:', pdf)

  try {
    await printPdfTo(printerName, pdf)
  } catch (e) {
    console.warn('[print] pdf-to-printer failed, trying PowerShell...')
    await printPdfViaShell(printerName, pdf)
  }

  console.log('[print] done')
}

main().catch((e) => { console.error('order-and-print failed:', e?.message || e); process.exit(1) })
