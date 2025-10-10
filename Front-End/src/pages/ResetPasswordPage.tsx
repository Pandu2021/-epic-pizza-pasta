import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import {
  LockClosedIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import { endpoints } from '../services/api';

function meetsPasswordRequirements(value: string) {
  return {
    length: value.length >= 8,
    letter: /[A-Za-z]/.test(value),
    number: /\d/.test(value),
  };
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const initialToken = (searchParams.get('token') || '').trim();
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success'>('idle');
  const [error, setError] = useState<string | null>(null);

  const requirements = useMemo(() => {
    const state = meetsPasswordRequirements(password);
    return [
      { id: 'length', label: 'At least 8 characters', passed: state.length },
      { id: 'letter', label: 'Contains a letter', passed: state.letter },
      { id: 'number', label: 'Contains a number', passed: state.number },
    ];
  }, [password]);

  const allPassed = requirements.every((req) => req.passed);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!token) {
      setError('Reset token is required.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!allPassed) {
      setError('Please meet the password requirements.');
      return;
    }

    setLoading(true);
    try {
      await endpoints.resetPassword({ token, password });
      setStatus('success');
    } catch (err) {
      if (isAxiosError(err)) {
        setError(err.response?.data?.message || 'Unable to reset the password. The link might have expired.');
      } else {
        setError('Unable to reset the password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-xl py-10">
      <div className="card border border-slate-200 p-8 shadow-sm">
        {status === 'success' ? (
          <div className="space-y-6 text-center">
            <CheckCircleIcon className="mx-auto h-12 w-12 text-emerald-500" />
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-slate-900">Password updated</h1>
              <p className="text-slate-600">Your password has been changed. You can sign in with your new credentials right away.</p>
            </div>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link to="/login" className="btn-primary">Go to login</Link>
              <Link to="/" className="btn-outline">Back to home</Link>
            </div>
          </div>
        ) : (
          <form className="space-y-6" onSubmit={handleSubmit}>
            <header className="space-y-2">
              <div className="flex items-center gap-3">
                <LockClosedIcon className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm uppercase tracking-wide text-primary/80 font-semibold">Reset password</p>
                  <h1 className="text-3xl font-bold text-slate-900">Choose a new password</h1>
                </div>
              </div>
              <p className="text-sm text-slate-600">Paste the reset token you received via email and set a strong password you haven’t used before.</p>
            </header>

            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Reset token</span>
                <input
                  type="text"
                  className="input mt-1 w-full"
                  value={token}
                  onChange={(e) => setToken(e.target.value.trim())}
                  placeholder="Paste the token from your email"
                  required
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">New password</span>
                <input
                  type="password"
                  className="input mt-1 w-full"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  required
                  autoComplete="new-password"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Confirm new password</span>
                <input
                  type="password"
                  className="input mt-1 w-full"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                  autoComplete="new-password"
                />
              </label>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Password checklist</p>
              <ul className="mt-3 space-y-2 text-sm">
                {requirements.map((req) => (
                  <li key={req.id} className={`flex items-center gap-2 ${req.passed ? 'text-emerald-600' : 'text-slate-600'}`}>
                    {req.passed ? (
                      <CheckCircleIcon className="h-4 w-4" />
                    ) : (
                      <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
                    )}
                    {req.label}
                  </li>
                ))}
              </ul>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                <ExclamationTriangleIcon className="mt-0.5 h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Updating…' : 'Update password'}
            </button>

            <div className="flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <Link to="/forgot-password" className="inline-flex items-center gap-1 text-primary">
                <ArrowLeftIcon className="h-4 w-4" />
                Request a new link
              </Link>
              <a href="mailto:epicpizzaandpasta@gmail.com" className="text-primary underline">Need help? Email support</a>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
