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
  // CSRF
  const csrf = await requestRaw(base + '/auth/csrf', { method: 'GET', headers: { 'Accept': 'application/json' } });
  const csrfJson = JSON.parse(csrf.body || '{}');
  const token = csrfJson.csrfToken;
  const cookies = parseSetCookie(csrf.headers['set-cookie']);
  console.log('CSRF token:', token);

  // Create order (will trigger Sheets append in background if configured)
  const bodyOrder = JSON.stringify({
    customer: { name: 'Sheets Test', phone: '+66801235555', address: '99 Sheet St' },
    items: [{ id: 'pizza-margherita', name: 'Margherita', qty: 1, price: 359 }],
    delivery: { type: 'pickup', fee: 0 },
    paymentMethod: 'cod',
  });
  const order = await requestRaw(base + '/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Cookie': cookies.join('; '),
      'X-CSRF-Token': token || '',
      'Accept-Encoding': 'identity',
      'Content-Length': Buffer.byteLength(bodyOrder),
    },
  }, bodyOrder);
  console.log('POST /orders =>', order.status, order.body);
  // Note: Verification of sheet append relies on server logs or checking the sheet.
})();
