import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

function requestRaw(url, opts = {}, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.request({
      method: opts.method || 'GET',
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + (u.search || ''),
      headers: opts.headers || {},
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({ status: res.statusCode || 0, headers: res.headers, body: buf.toString('utf8') });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function parseSetCookie(setCookie) {
  const cookies = [];
  const arr = Array.isArray(setCookie) ? setCookie : (setCookie ? [setCookie] : []);
  for (const c of arr) {
    const semi = c.split(';')[0];
    if (semi) cookies.push(semi.trim());
  }
  return cookies;
}

(async () => {
  const base = process.env.BASE_URL || 'http://localhost:4000/api';
  // 1) Get CSRF
  const r1 = await requestRaw(base + '/auth/csrf', { method: 'GET', headers: { 'Accept': 'application/json' } });
  const r1json = JSON.parse(r1.body || '{}');
  const token = r1json.csrfToken;
  const cookies = parseSetCookie(r1.headers['set-cookie']);
  console.log('CSRF token:', token);
  console.log('Cookies:', cookies.join('; '));

  // 2) Post order
  const payload = {
    customer: { name: 'Test User', phone: '+66801234567', address: '123 Test St' },
    items: [{ id: 'pizza-margherita', name: 'Margherita', qty: 1, price: 359 }],
    delivery: { type: 'delivery', fee: 39 },
    paymentMethod: 'promptpay',
  };
  const body = JSON.stringify(payload);
  const r2 = await requestRaw(base + '/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Encoding': 'identity',
      'Cookie': cookies.join('; '),
      'X-CSRF-Token': token || '',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);
  console.log('POST /orders status =', r2.status);
  console.log('Response headers:', r2.headers);
  console.log('Response body:', r2.body);
})().catch((e) => { console.error('Script error:', e); process.exit(1); });
