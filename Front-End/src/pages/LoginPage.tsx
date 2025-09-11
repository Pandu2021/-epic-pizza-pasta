import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    } catch (e: any) {
      setError('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold">Login</h1>
      <p className="text-slate-600 mt-1">Please sign in to continue.</p>
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
      <div className="mt-4 text-sm text-slate-600">
        Don't have an account? <Link to="/register" className="text-primary underline">Register</Link>
      </div>
    </section>
  );
}
