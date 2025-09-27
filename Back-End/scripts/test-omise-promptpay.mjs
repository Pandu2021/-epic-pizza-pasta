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

function jarToHeader(jar) {
  // Convert Map name->value to standard Cookie header string
  return Array.from(jar, ([k, v]) => `${k}=${v}`).join('; ');
}

(async () => {
  const base = process.env.BASE_URL || 'http://localhost:4000/api';
  // Auth: CSRF -> register -> login (to get access_token cookie)
  const csrf = await requestRaw(base + '/auth/csrf', { method: 'GET', headers: { 'Accept': 'application/json' } });
  const csrfJson = JSON.parse(csrf.body || '{}');
  const token = csrfJson.csrfToken;
  const cookieArr = parseSetCookie(csrf.headers['set-cookie']);
  const jar = new Map(cookieArr.map((c) => {
    const [nv] = c.split(';'); const [n, v] = nv.split('='); return [n, v];
  }));
  console.log('CSRF token:', token);

  const email = `omise_pp_${Math.random().toString(36).slice(2)}@example.com`;
  const password = 'Test12345';
  const regBody = JSON.stringify({ email, password, name: 'PP Tester', phone: '0812345678' });
  await requestRaw(base + '/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', 'Accept': 'application/json', 'Cookie': jarToHeader(jar), 'X-CSRF-Token': token, 'Accept-Encoding': 'identity', 'Content-Length': Buffer.byteLength(regBody)
    },
  }, regBody).catch(() => ({}));

  // new csrf for login (fresh token)
  const csrf2 = await requestRaw(base + '/auth/csrf', { method: 'GET', headers: { 'Accept': 'application/json', 'Cookie': jarToHeader(jar) } });
  const t2 = JSON.parse(csrf2.body || '{}').csrfToken;
  const set2 = parseSetCookie(csrf2.headers['set-cookie']);
  for (const c of set2) { const [nv] = c.split(';'); const [n, v] = nv.split('='); jar.set(n, v); }
  const loginBody = JSON.stringify({ email, password });
  const login = await requestRaw(base + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Cookie': jarToHeader(jar), 'X-CSRF-Token': t2, 'Accept-Encoding': 'identity', 'Content-Length': Buffer.byteLength(loginBody) },
  }, loginBody);
  const set3 = parseSetCookie(login.headers['set-cookie']);
  for (const c of set3) { const [nv] = c.split(';'); const [n, v] = nv.split('='); jar.set(n, v); }

  // Fetch fresh CSRF token AFTER login (token is derived from current secret cookie)
  const csrf3 = await requestRaw(base + '/auth/csrf', { method: 'GET', headers: { 'Accept': 'application/json', 'Cookie': jarToHeader(jar) } });
  const t3 = JSON.parse(csrf3.body || '{}').csrfToken;
  const set4 = parseSetCookie(csrf3.headers['set-cookie']);
  for (const c of set4) { const [nv] = c.split(';'); const [n, v] = nv.split('='); jar.set(n, v); }

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
      'Cookie': jarToHeader(jar),
      'X-CSRF-Token': t3 || t2 || token || '',
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
      'Cookie': jarToHeader(jar),
      'X-CSRF-Token': t3 || t2 || token || '',
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