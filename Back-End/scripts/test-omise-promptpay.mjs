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
  // 1) CSRF
  const csrf = await requestRaw(base + '/auth/csrf', { method: 'GET', headers: { 'Accept': 'application/json' } });
  const csrfJson = JSON.parse(csrf.body || '{}');
  const token = csrfJson.csrfToken;
  const cookies = parseSetCookie(csrf.headers['set-cookie']);
  console.log('CSRF token:', token);

  // 2) Create order (PromptPay)
  const bodyOrder = JSON.stringify({
    customer: { name: 'Tester', phone: '+66801234567', address: '123 Test St' },
    items: [{ id: 'pizza-margherita', name: 'Margherita', qty: 1, price: 359 }],
    delivery: { type: 'delivery', fee: 39 },
    paymentMethod: 'promptpay',
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
  if (!orderId) throw new Error('No orderId from /orders');

  // 3) Call Omise PromptPay endpoint
  const bodyQr = JSON.stringify({ orderId, amount: orderJson.amountTotal || 398 });
  const qr = await requestRaw(base + '/payments/omise/promptpay', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Cookie': cookies.join('; '),
      'X-CSRF-Token': token || '',
      'Accept-Encoding': 'identity',
      'Content-Length': Buffer.byteLength(bodyQr),
    },
  }, bodyQr);
  console.log('POST /payments/omise/promptpay =>', qr.status, qr.body);
  const qrJson = JSON.parse(qr.body || '{}');
  console.log('QR Image URL:', qrJson.qrImageUrl, 'QR Payload:', (qrJson.qrPayload ? '[present]' : null));

  // 4) Read payment status
  const stat = await requestRaw(base + `/payments/${orderId}/status`, { method: 'GET', headers: { 'Accept': 'application/json' } });
  console.log('GET /payments/:orderId/status =>', stat.status, stat.body);
})();