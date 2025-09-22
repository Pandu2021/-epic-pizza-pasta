const baseURL = process.env.API || 'http://localhost:4000/api';

const jar = new Map();
const getSetCookie = (res) => (typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []);
const updateCookies = (res) => {
  const cookies = getSetCookie(res);
  for (const c of cookies) {
    const [nv] = c.split(';');
    const [name, value] = nv.split('=');
    if (name && value !== undefined) jar.set(name.trim(), value.trim());
  }
};
const cookieHeader = () => Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
const xsrf = () => jar.get('XSRF-TOKEN');

async function request(path, method = 'GET', body) {
  const headers = { 'content-type': 'application/json' };
  if (method !== 'GET') headers['X-CSRF-Token'] = xsrf() || '';
  const res = await fetch(baseURL + path, {
    method,
    headers: { ...headers, cookie: cookieHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  updateCookies(res);
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : undefined; } catch { data = text; }
  if (!res.ok) {
    throw new Error(`${res.status}: ${JSON.stringify(data)}`);
  }
  return { res, data };
}

(async () => {
  try {
    // CSRF
    await request('/auth/csrf');

    // Register or login
    const email = `test${Math.random().toString(36).slice(2)}@example.com`;
    const password = 'Test12345';
    await request('/auth/register', 'POST', { email, password, name: 'Tester', phone: '0812345678' }).catch(() => {});
    const login = await request('/auth/login', 'POST', { email, password });
    if (!login.data?.ok) {
      console.error('Login failed');
      process.exit(1);
    }

    // Create an order (cod)
    const orderRes = await request('/orders', 'POST', {
      customer: { name: 'Tester', phone: '0812345678', address: '123 Test St' },
      items: [ { id: 'demo', name: 'Test Pizza', qty: 1, price: 199 } ],
      delivery: { type: 'delivery', fee: 39 },
      paymentMethod: 'cod'
    });
    console.log('Created order', orderRes.data);

    // Fetch my orders
    const my = await request('/orders/my', 'GET');
    console.log('My orders count:', Array.isArray(my.data) ? my.data.length : my.data);
  } catch (e) {
    console.error('Error', e?.message || e);
    process.exit(1);
  }
})();
