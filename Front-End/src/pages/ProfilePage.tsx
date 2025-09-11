import { UserCircleIcon, Cog6ToothIcon, GlobeAltIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import { motion } from 'framer-motion';

type MeResponse = { user?: { id: string; email: string; name?: string; role: string; phone?: string } };

const ProfilePage = () => {
  const { t, i18n } = useTranslation();
  const [me, setMe] = useState<MeResponse['user'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ name: string; phone: string }>({ name: '', phone: '' });

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get('/auth/me');
        const user = (data as MeResponse).user ?? null;
        setMe(user);
        if (user) setForm({ name: user.name ?? '', phone: user.phone ?? '' });
      } catch (e: any) {
  setMe(null);
  setError(t('profile.not_signed_in'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    // naive refresh to clear client state
    window.location.href = '/';
  };

  const saveSettings = async () => {
    if (!me) return;
    setSaving(true);
    try {
      const { data } = await api.post('/auth/update-profile', { name: form.name.trim() || null, phone: form.phone.trim() || null });
      const updated = (data?.user ?? null) as MeResponse['user'] | null;
      if (updated) setMe(updated);
      setShowSettings(false);
    } catch (e) {
      // noop minimal error handling, could add toast
    } finally {
      setSaving(false);
    }
  };

  const profileCompletion = useMemo(() => {
    if (!me) return 0;
    let score = 0;
    if (me.email) score += 50;
    if (me.name) score += 30;
    if (me.phone) score += 20;
    return score;
  }, [me]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
  {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="px-6 py-10 md:px-10 md:py-14 flex items-center gap-6">
          <UserCircleIcon className="h-16 w-16 text-white/90" />
          <div>
    <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">{t('profile.title')}</h1>
    <p className="mt-2 md:mt-3 text-white/70 md:text-lg">{t('profile.subtitle')}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {/* Left: Overview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h2 className="text-xl font-semibold">{t('profile.account')}</h2>
            {loading ? (
              <div className="mt-4 text-slate-500">{t('profile.loading')}</div>
            ) : me ? (
              <div>
                <div className="mt-4 flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-rose-400 via-orange-400 to-yellow-400 grid place-items-center text-slate-900 font-bold">
                    {(me.name?.[0] || me.email?.[0] || 'U').toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">{t('profile.display_name')}</div>
                    <div className="font-medium">{me.name || me.email}</div>
                    <div className="text-sm text-slate-500">{t('profile.role')}</div>
                    <div className="font-medium">{me.role}</div>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button className="btn-outline" onClick={() => setShowSettings(v => !v)}><Cog6ToothIcon className="h-5 w-5 mr-2" /> {t('profile.settings')}</button>
                  <button className="btn-outline" onClick={logout}><ArrowRightOnRectangleIcon className="h-5 w-5 mr-2" /> {t('profile.logout')}</button>
                </div>

                {showSettings && (
                  <div className="mt-6 border-t border-slate-200 pt-6">
                    <h3 className="font-semibold mb-3">{t('profile.edit_profile')}</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">{t('profile.name')}</label>
                        <input
                          className="input"
                          value={form.name}
                          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                          placeholder={t('profile.placeholder_name')}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">{t('profile.phone')}</label>
                        <input
                          className="input"
                          value={form.phone}
                          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                          placeholder={t('profile.placeholder_phone')}
                        />
                      </div>
                    </div>
                    <div className="mt-4 flex gap-3">
                      <button className="btn-primary" onClick={saveSettings} disabled={saving}>{saving ? t('profile.saving') : t('profile.save')}</button>
                      <button className="btn-outline" onClick={() => { setShowSettings(false); setForm({ name: me?.name ?? '', phone: me?.phone ?? '' }); }}>{t('profile.cancel')}</button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="mt-2 text-slate-600">{error || t('profile.not_signed_in')}</div>
                <div className="mt-4 flex gap-3">
                  <Link to="/login" className="btn-primary">{t('profile.login')}</Link>
                  <Link to="/register" className="btn-outline">{t('profile.register')}</Link>
                </div>
              </div>
            )}
          </div>

          <div className="card p-6">
            <h2 className="text-xl font-semibold">{t('profile.preferences')}</h2>
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-lg border border-slate-200">
                <GlobeAltIcon className="h-6 w-6 text-brand-primary" />
                <div>
                  <div className="text-sm text-slate-500">{t('profile.language')}</div>
                  <div className="font-medium uppercase">{i18n.language}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg border border-slate-200">
                <ArrowRightOnRectangleIcon className="h-6 w-6 text-slate-500" />
                <div>
                  <div className="text-sm text-slate-500">{t('profile.authentication')}</div>
                  <div className="font-medium">{me ? t('profile.signed_in') : t('profile.not_signed_in')}</div>
                </div>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-500">{t('profile.signin_note')}</p>
          </div>
        </div>

        {/* Right: Gamification & Links */}
        <div className="space-y-6">
          {me && (
            <div className="card p-6">
              <h2 className="text-xl font-semibold">{t('profile.profile_completion')}</h2>
              <div className="mt-4">
                <div className="flex justify-between text-sm font-medium mb-1">
                  <span>{t('profile.profile_complete_msg', { percent: profileCompletion })}</span>
                  <span>{profileCompletion}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5">
                  <motion.div
                    className="bg-gradient-to-r from-brand-secondary to-brand-primary h-2.5 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${profileCompletion}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
                {profileCompletion < 100 && (
                  <p className="mt-2 text-sm text-slate-500">
                    {profileCompletion < 70 ? t('profile.profile_tip_name_phone') : t('profile.profile_tip_phone')}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="card p-6">
            <h2 className="text-xl font-semibold">{t('profile.quick_links')}</h2>
            <div className="mt-4 flex flex-col gap-2 text-sm">
              <Link to="/menu" className="btn-outline">{t('profile.browse_menu')}</Link>
              <Link to="/cart" className="btn-outline">{t('profile.view_cart')}</Link>
              <Link to="/contact" className="btn-outline">{t('reach_out')}</Link>
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
};

export default ProfilePage;
