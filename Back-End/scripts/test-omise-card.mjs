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
  const pk = process.env.OMISE_PUBLIC_KEY || process.env.VITE_OMISE_PUBLIC_KEY || 'pkey_test_64sc7nj3lfj5vndvqff';
  // 1) CSRF
  const csrf = await requestRaw(base + '/auth/csrf', { method: 'GET', headers: { 'Accept': 'application/json' } });
  const csrfJson = JSON.parse(csrf.body || '{}');
  const token = csrfJson.csrfToken;
  const cookies = parseSetCookie(csrf.headers['set-cookie']);
  console.log('CSRF token:', token);

  // 2) Create order (Card)
  const bodyOrder = JSON.stringify({
    customer: { name: 'Card Tester', phone: '+66801234567', address: '123 Test St' },
    items: [{ id: 'pizza-margherita', name: 'Margherita', qty: 1, price: 359 }],
    delivery: { type: 'delivery', fee: 39 },
    paymentMethod: 'card',
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
  const orderJson = JSON.parse(order.body || '{}');
  const orderId = orderJson.orderId;
  const amount = orderJson.amountTotal || 398;
  if (!orderId) throw new Error('No orderId from /orders');

  // 3) Create Omise token via vault using public key (test card 4242)
  const form = new URLSearchParams();
  form.set('card[name]', 'Tester');
  form.set('card[number]', '4242424242424242');
  form.set('card[expiration_month]', '12');
  form.set('card[expiration_year]', String(new Date().getFullYear() + 1));
  form.set('card[security_code]', '123');
  const tokenRes = await new Promise((resolve, reject) => {
    const u = new URL('https://vault.omise.co/tokens');
    const payload = form.toString();
    const auth = 'Basic ' + Buffer.from(`${pk}:`).toString('base64');
    const req = https.request({
      method: 'POST',
      hostname: u.hostname,
      path: u.pathname,
      headers: {
        Authorization: auth,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let out = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (out += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(out || '{}'));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
  console.log('Create token =>', tokenRes);
  const tokenId = tokenRes && tokenRes.id;
  if (!tokenId) throw new Error('Failed to obtain token from Omise');

  // 4) Call our backend to charge
  const bodyCharge = JSON.stringify({ orderId, amount, token: tokenId });
  const charge = await requestRaw(base + '/payments/omise/charge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Cookie': cookies.join('; '),
      'X-CSRF-Token': token || '',
      'Accept-Encoding': 'identity',
      'Content-Length': Buffer.byteLength(bodyCharge),
    },
  }, bodyCharge);
  console.log('POST /payments/omise/charge =>', charge.status, charge.body);

  // 5) Read payment status
  const stat = await requestRaw(base + `/payments/${orderId}/status`, { method: 'GET', headers: { 'Accept': 'application/json' } });
  console.log('GET /payments/:orderId/status =>', stat.status, stat.body);
})();
