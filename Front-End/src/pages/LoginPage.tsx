import { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { api } from '../services/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialSuccessEmail = (location.state as { registeredEmail?: string } | null)?.registeredEmail || '';
  const [successEmail] = useState(initialSuccessEmail);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSuccessEmail) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [initialSuccessEmail, navigate, location.pathname]);

  const onSubmit = async (_event: React.FormEvent) => {
    _event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = { email: email.trim().toLowerCase(), password };
      const { data } = await api.post('/auth/login', payload);
      if (data?.ok) {
        navigate('/profile', { replace: true });
      } else {
        setError('Invalid email or password');
      }
    } catch {
      setError('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold">Login</h1>
      <p className="text-slate-600 mt-1">Please sign in to continue.</p>
      {successEmail && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          Account <span className="font-medium">{successEmail}</span> is ready. You can sign in right away.
        </div>
      )}
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="text-sm" htmlFor="email">Email</label>
          <input id="email" className="input w-full mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="text-sm" htmlFor="password">Password</label>
          <input id="password" className="input w-full mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div className="mt-1 text-right">
          <Link to="/forgot-password" className="text-sm text-primary underline">Forgot password?</Link>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button className="btn-primary w-full" disabled={loading} type="submit">{loading ? 'Signing in...' : 'Sign in'}</button>
      </form>
      <div className="my-4 flex items-center gap-3 text-slate-400">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-sm">or</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>
      <div className="grid grid-cols-1 gap-3">
        <button
          type="button"
          className="btn-outline w-full flex items-center justify-center gap-3"
          onClick={() => {
            const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:4000/api';
            const redirect = encodeURIComponent(window.location.origin + '/profile');
            window.location.href = `${apiBase}/auth/line?redirect=${redirect}`;
          }}
        >
          <span className="flex items-center justify-center h-8 w-8 rounded-full shadow-sm bg-[#06C755]">
            <svg className="h-5 w-5 text-white" viewBox="0 0 40 40" fill="currentColor" aria-hidden="true">
              <path d="M20 4C10.611 4 4 10.046 4 17.84c0 4.783 3.099 8.97 7.7 11.248-.339 1.263-1.215 4.526-1.393 5.243-.217.889.326.878.688.639.283-.187 4.48-3.032 6.307-4.273.863.127 1.753.196 2.697.196 9.389 0 16-6.046 16-13.84C36 10.046 29.389 4 20 4zm-5.313 17.004h-1.996v-6.632h1.996v6.632zm6.45 0h-1.996v-3.297l-1.471 2.642h-.069l-1.471-2.642v3.297h-1.996v-6.632h1.996l1.471 2.642 1.471-2.642h1.996v6.632zm6.385-4.636h-2.153v1.273h2.065v1.769h-2.065v1.593h2.153v1.769h-4.149v-6.632h4.149v1.728zm4.401 4.636h-1.996v-2.51l-2.153 2.51h-1.674v-6.632h1.996v2.51l2.154-2.51h1.673v6.632z" />
            </svg>
          </span>
          <span className="font-medium">Continue with LINE</span>
        </button>
      </div>
      <div className="mt-4 text-sm text-slate-600">
        Don't have an account? <Link to="/register" className="text-primary underline">Register</Link>
      </div>
    </section>
  );
}
