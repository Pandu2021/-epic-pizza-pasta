import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = { email: email.trim().toLowerCase(), password, name };
      const { data } = await api.post('/auth/register', payload);
      if (data?.id) {
        // auto-login after register
        try { await api.post('/auth/login', { email: payload.email, password }); } catch {}
        navigate('/profile', { replace: true });
      } else {
        setError('Register failed');
      }
    } catch (e: any) {
      const msg = e?.response?.status === 409
        ? 'Email already in use'
        : (e?.response?.data?.message || 'Register failed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold">Create account</h1>
      <p className="text-slate-600 mt-1">Sign up to track orders and save your favorites.</p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="text-sm" htmlFor="name">Name</label>
          <input id="name" className="input w-full mt-1" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-sm" htmlFor="email">Email</label>
          <input id="email" className="input w-full mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="text-sm" htmlFor="password">Password</label>
          <input id="password" className="input w-full mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button className="btn-primary w-full" disabled={loading} type="submit">{loading ? 'Creating account...' : 'Create account'}</button>
      </form>
      <div className="mt-4 text-sm text-slate-600">
        Already have an account? <Link to="/login" className="text-primary underline">Login</Link>
      </div>
    </section>
  );
}
