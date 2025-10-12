import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api',
  withCredentials: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-CSRF-Token',
  // Treat 304 (Not Modified) as a successful response so callers can handle cached data
  validateStatus: (status) => {
    if (status === 304) return true; // resolve instead of reject
    return status >= 200 && status < 300;
  }
});

function getCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : undefined;
}

// Ensure CSRF cookie exists before unsafe requests
api.interceptors.request.use(async (config) => {
  if ((config.method || 'get').toLowerCase() !== 'get') {
    // lazy-call csrf endpoint once per session if header missing
    if (!document.cookie.includes('XSRF-TOKEN')) {
      try { await api.get('/auth/csrf'); } catch {}
    }
    // axios won't auto-attach xsrf header across different ports; set it manually
    const token = getCookie('XSRF-TOKEN');
    if (token) {
      (config.headers = config.headers || {})['X-CSRF-Token'] = token;
    }
  }
  return config;
});

// Proactively fetch CSRF token on app start (best effort)
(async () => {
  try {
    if (!document.cookie.includes('XSRF-TOKEN')) {
      await api.get('/auth/csrf');
    }
  } catch {
    // ignore; will be retried on first non-GET via request interceptor
  }
})();

// Auto-retry once on CSRF failure by refreshing token
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { response, config } = error || {};
    const status = response?.status;
    const msg: string = (response?.data?.message || '').toString().toLowerCase();
    const isCsrf = status === 403 && msg.includes('csrf');
    if (isCsrf && config && !(config as any)._retryCsrf) {
      try {
        await api.get('/auth/csrf');
        (config as any)._retryCsrf = true;
        return api.request(config);
      } catch {
        // fall through to reject
      }
    }
    return Promise.reject(error);
  }
);

// Example endpoints
export const endpoints = {
  menu: () => api.get('/menu'),
  searchMenu: (q: string) => api.get(`/menu/search`, { params: { q } }),
  createOrder: (payload: unknown) => api.post('/orders', payload),
  paymentStatus: (orderId: string) => api.get(`/payments/${orderId}/status`),
  getOrder: (orderId: string) => api.get(`/orders/${orderId}`),
  myOrders: () => api.get('/orders/my'),
  reprint: (orderId: string) => api.post(`/orders/${orderId}/print`),
  createPromptPay: (body: { orderId: string; amount: number }) => api.post('/payments/promptpay/create', body),
  createOmisePromptPay: (body: { orderId: string; amount: number; description?: string }) => api.post('/payments/omise/promptpay', body),
  omiseCharge: (body: { orderId: string; amount: number; token: string; description?: string }) => api.post('/payments/omise/charge', body),
  paymentConfig: () => api.get('/payments/config'),
  me: () => api.get('/auth/me'),
  login: (body: { email: string; password: string }) => api.post('/auth/login', body),
  logout: () => api.post('/auth/logout'),
  forgotPassword: (body: { email: string; channel?: 'email' | 'whatsapp' | 'line' }) => api.post('/auth/forgot-password', body),
  resetPassword: (body: { token: string; password: string }) => api.post('/auth/reset-password', body),
  contact: (body: { name?: string; email?: string; message: string }) => api.post('/contact', body),
};
