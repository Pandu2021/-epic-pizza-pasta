import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useTranslation } from 'react-i18next';

export default function RegisterPage() {
  const { t } = useTranslation();
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
        setError(t('register.error_failed'));
      }
    } catch (e: any) {
      const msg = e?.response?.status === 409
        ? t('register.error_email_in_use')
        : (e?.response?.data?.message || t('register.error_failed'));
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold">{t('register.title')}</h1>
      <p className="text-slate-600 mt-1">{t('register.subtitle')}</p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="text-sm" htmlFor="name">{t('register.name')}</label>
          <input id="name" className="input w-full mt-1" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-sm" htmlFor="email">{t('register.email')}</label>
          <input id="email" className="input w-full mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="text-sm" htmlFor="password">{t('register.password')}</label>
          <input id="password" className="input w-full mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button className="btn-primary w-full" disabled={loading} type="submit">{loading ? t('register.submitting') : t('register.submit')}</button>
      </form>
      <div className="mt-4 text-sm text-slate-600">
        {t('register.have_account')} <Link to="/login" className="text-primary underline">{t('register.login')}</Link>
      </div>
    </section>
  );
}
