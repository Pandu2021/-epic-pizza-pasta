import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/authStore';
import { adminDefaultRoute } from '../../config/appConfig';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? adminDefaultRoute;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    const ok = await login(email.trim().toLowerCase(), password);
    if (ok) {
      navigate(from, { replace: true });
    } else {
      setLocalError('Invalid credentials or insufficient role access.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">Epic Pizza Admin</h1>
          <p className="text-sm text-slate-500">Sign in with an operator account to continue.</p>
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="admin-email" className="block text-sm font-medium text-slate-600">Email</label>
            <input
              id="admin-email"
              type="email"
              className="input mt-1"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="admin-password" className="block text-sm font-medium text-slate-600">Password</label>
            <input
              id="admin-password"
              type="password"
              className="input mt-1"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {(error || localError) && <div className="text-sm text-red-600" role="alert">{error || localError}</div>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="text-xs text-slate-400 text-center">Need access? Ask an admin to create an operator account via Users & Roles.</p>
      </div>
    </div>
  );
}
