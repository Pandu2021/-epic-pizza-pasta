import { UserCircleIcon, Cog6ToothIcon, GlobeAltIcon, ArrowRightOnRectangleIcon, FunnelIcon, ArrowPathIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../store/cartStore';
import { useEffect, useState, useMemo, useRef } from 'react';
import { api, endpoints } from '../services/api';
import { useAuth } from '../store/authStore';
import { motion } from 'framer-motion';
import PizzaCarProgress from '../components/PizzaCarProgress';
import { computeProgress, shouldAutoConfirm } from '../utils/tracking';

type MeResponse = { user?: { id: string; email: string; name?: string; role: string; phone?: string; lineUserId?: string } };

const ProfilePage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { count, total } = useCart();
  const { user, fetchMe, logout: authLogout } = useAuth();
  const cartCount = count();
  const cartTotal = total();
  // Simple state to trigger pulse animation on change
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (cartCount > 0) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 600);
      return () => clearTimeout(t);
    }
  }, [cartCount]);
  // Local wrapper states (legacy compatibility) now driven by auth store
  const [me, setMe] = useState<MeResponse['user'] | null>(null);
  const [loading, setLoading] = useState(true); // page-level loading while fetching me & orders
  const [showSettings, setShowSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ name: string; phone: string; lineUserId: string }>({ name: '', phone: '', lineUserId: '' });
  const [orders, setOrders] = useState<Array<{ id: string; createdAt: string; total: number; status: string; deliveryType?: string; payment?: { status: string; method: string } }>>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  // Active delivery tracking
  const [activeOrder, setActiveOrder] = useState<any | null>(null);
  const [eta, setEta] = useState<{ readyMinutes?: number; deliveryMinutes?: number; expectedDeliveryAt?: number } | null>(null);
  const [progressRatio, setProgressRatio] = useState(0);
  const [delivered, setDelivered] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [autoConfirmed, setAutoConfirmed] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  // New: pagination & filters
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // default 10 per request
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all'); // all | received | preparing | completed | cancelled
  const [filterMethod, setFilterMethod] = useState<string>('all'); // all | promptpay | card | cod

  // Fetch auth user via store on mount
  useEffect(() => { fetchMe(); }, [fetchMe]);

  // Sync local me + form when auth store user changes
  useEffect(() => {
    // Normalize role to non-optional string for local state expectations
    const normalized = user ? { ...user, role: user.role || 'customer' } as MeResponse['user'] : null;
    setMe(normalized);
    if (user) {
  setForm({ name: user.name ?? '', phone: user.phone ?? '', lineUserId: user.lineUserId ?? '' });
      // fetch orders only when user present
      (async () => {
        setOrdersLoading(true);
        try {
          const { data: list } = await endpoints.myOrders();
          const arr = Array.isArray(list) ? list : [];
          setOrders(arr);
        } catch {}
        setOrdersLoading(false);
        setLoading(false);
      })();
    } else {
      setOrders([]);
      setLoading(false);
    }
  }, [user]);

  const logout = async () => {
    await authLogout();
    navigate('/');
  };

  const saveSettings = async () => {
    if (!me) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim() || null,
        phone: form.phone.trim() || null,
        lineUserId: form.lineUserId.trim() || null,
      };
      const { data } = await api.post('/auth/update-profile', payload);
      const updated = (data?.user ?? null) as MeResponse['user'] | null;
      if (updated) setMe(updated);
      setShowSettings(false);
    } catch {
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

  // Derived filtered + paginated
  // De-duplicate orders by id (prefer the most recent createdAt if duplicates exist)
  const dedupedOrders = useMemo(() => {
    const byId = new Map<string, { id: string; createdAt: string; total: number; status: string; deliveryType?: string; payment?: { status: string; method: string } }>();
    for (const o of orders) {
      const prev = byId.get(o.id);
      if (!prev) { byId.set(o.id, o); continue; }
      // pick the newer createdAt entry
      const currTs = Date.parse(o.createdAt || '');
      const prevTs = Date.parse(prev.createdAt || '');
      if (isFinite(currTs) && isFinite(prevTs) && currTs >= prevTs) byId.set(o.id, o);
    }
    // return in createdAt desc order
    return Array.from(byId.values()).sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let arr = dedupedOrders;
    // Avoid duplicate visual entries: if we show an Active Order card, exclude it from the list below
    if (activeOrder) arr = arr.filter(o => o.id !== activeOrder.id);
    if (filterStatus !== 'all') arr = arr.filter(o => (o.status || '').toLowerCase() === filterStatus);
    if (filterMethod !== 'all') arr = arr.filter(o => (o.payment?.method || '').toLowerCase() === filterMethod);
    return arr;
  }, [dedupedOrders, filterStatus, filterMethod, activeOrder?.id]);

  // Determine latest in-flight order (received|preparing|completed but not delivered/cancelled) preferring most recent
  useEffect(() => {
    const candidate = [...orders]
      .filter(o => !['delivered', 'cancelled'].includes(o.status.toLowerCase()))
      .sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
    setActiveOrder(candidate || null);
  }, [orders]);

  // Fetch ETA + open SSE for active order
  useEffect(() => {
    if (!activeOrder) { setEta(null); setProgressRatio(0); setDelivered(false); setCancelled(false); if (esRef.current) { try { esRef.current.close(); } catch {} } return; }
    let ignore = false;
    (async () => {
      try {
        const etaRes = await api.get(`/orders/${activeOrder.id}/eta`);
        if (!ignore && etaRes.data) {
          setEta({
            readyMinutes: etaRes.data.readyMinutes,
            deliveryMinutes: etaRes.data.deliveryMinutes,
            expectedDeliveryAt: etaRes.data.expectedDeliveryAt ? Date.parse(etaRes.data.expectedDeliveryAt) : undefined
          });
        }
      } catch {}
      try {
        const base = api.defaults.baseURL || '';
        const url = base.replace(/\/$/, '') + `/orders/${activeOrder.id}/stream`;
        const es = new EventSource(url);
        esRef.current = es;
        es.onmessage = ev => {
          try {
            const data = JSON.parse(ev.data || '{}');
            if (data?.type === 'order.status') {
              const st = data.payload?.status;
              if (!st) return;
              // update local orders list status
              setOrders(prev => prev.map(o => o.id === activeOrder.id ? { ...o, status: st } : o));
              if (st === 'delivered') setDelivered(true);
              if (st === 'cancelled') setCancelled(true);
            }
          } catch {}
        };
        es.onerror = () => {
          try {
            es.close();
          } catch {
            // ignore close errors
          }
        };
      } catch {}
    })();
    return () => {
      ignore = true;
      if (esRef.current) {
        try {
          esRef.current.close();
        } catch {
          // ignore close errors
        }
      }
    };
  }, [activeOrder]);

  // Progress loop
  useEffect(() => {
    if (!activeOrder || !eta?.expectedDeliveryAt || cancelled || delivered) return;
    const orderedAt = Date.parse(activeOrder.createdAt || new Date().toISOString());
    const expected = eta.expectedDeliveryAt;
    const update = () => {
      const { ratio } = computeProgress({ orderedAt, expectedDeliveryAt: expected });
      setProgressRatio(ratio);
      if (ratio >= 1 && shouldAutoConfirm(delivered, expected)) {
        handleAutoConfirm();
      }
    };
    update();
    progressTimerRef.current = window.setInterval(update, 5000);
    return () => { if (progressTimerRef.current) window.clearInterval(progressTimerRef.current); };
  }, [activeOrder, eta?.expectedDeliveryAt, cancelled, delivered]);

  const handleConfirm = async () => {
    if (!activeOrder) return;
    try { await api.post(`/orders/${activeOrder.id}/confirm-delivered`); setDelivered(true); } catch {}
  };
  const handleCancel = async () => {
    if (!activeOrder) return;
    try { await api.post(`/orders/${activeOrder.id}/cancel`); setCancelled(true); } catch {}
  };
  const handleAutoConfirm = async () => {
    if (autoConfirmed || delivered || cancelled || !activeOrder) return;
    try { await api.post(`/orders/${activeOrder.id}/confirm-delivered`); setDelivered(true); setAutoConfirmed(true); } catch {}
  };

  const totalItems = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const pageSlice = filteredOrders.slice(pageStart, pageEnd);

  // Reset page when filters/pageSize change
  useEffect(() => { setPage(1); }, [filterStatus, filterMethod, pageSize]);

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
                  <button className="btn-outline" onClick={() => setShowSettings(v => !v)} {...(showSettings ? { 'aria-expanded': true } : {})}><Cog6ToothIcon className="h-5 w-5 mr-2" /> {t('profile.settings')}</button>
                  <button className="btn-outline" onClick={logout}><ArrowRightOnRectangleIcon className="h-5 w-5 mr-2" /> {t('profile.logout')}</button>
                </div>

                {showSettings && (
                  <div className="mt-6 border-t border-slate-200 pt-6">
                    <h3 className="font-semibold mb-3">{t('profile.edit_profile')}</h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label htmlFor="profile-email" className="block text-sm text-slate-600 mb-1">{t('profile.email', 'Email')}</label>
                        <input
                          className="input bg-slate-100 text-slate-500 cursor-not-allowed"
                          value={me?.email || ''}
                          readOnly
                          id="profile-email"
                          aria-readonly="true"
                        />
                      </div>
                      <div>
                        <label htmlFor="profile-name" className="block text-sm text-slate-600 mb-1">{t('profile.name')}</label>
                        <input
                          className="input"
                          value={form.name}
                          id="profile-name"
                          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                          placeholder={t('profile.placeholder_name')}
                        />
                      </div>
                      <div>
                        <label htmlFor="profile-phone" className="block text-sm text-slate-600 mb-1">{t('profile.phone')}</label>
                        <input
                          className="input"
                          value={form.phone}
                          id="profile-phone"
                          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                          placeholder={t('profile.placeholder_phone')}
                        />
                      </div>
                      <div>
                        <label htmlFor="profile-line-user" className="block text-sm text-slate-600 mb-1">{t('profile.line_user_id', 'LINE ID')}</label>
                        <input
                          className="input"
                          value={form.lineUserId}
                          id="profile-line-user"
                          onChange={e => setForm(f => ({ ...f, lineUserId: e.target.value }))}
                          placeholder={t('profile.placeholder_line_user_id', 'Your LINE ID (optional)')}
                        />
                      </div>
                    </div>
                    <div className="mt-4 flex gap-3">
                      <button className="btn-primary" onClick={saveSettings} disabled={saving}>{saving ? t('profile.saving') : t('profile.save')}</button>
                      <button
                        className="btn-outline"
                        onClick={() => {
                          setShowSettings(false);
                          setForm({ name: me?.name ?? '', phone: me?.phone ?? '', lineUserId: me?.lineUserId ?? '' });
                        }}
                      >
                        {t('profile.cancel')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="mt-2 text-slate-600">{t('profile.not_signed_in')}</div>
                <div className="mt-4 flex gap-3">
                  <Link to="/login" className="btn-primary">{t('profile.login')}</Link>
                  <Link to="/register" className="btn-outline">{t('profile.register')}</Link>
                </div>
              </div>
            )}
          </div>

          {me && (
            <div className="card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Order History</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-outline flex items-center gap-1 text-sm"
                    onClick={async () => {
                      setOrdersLoading(true);
                      try {
                        const { data: list } = await endpoints.myOrders();
                        const arr = Array.isArray(list) ? list : [];
                        setOrders(arr);
                      } catch {}
                      setOrdersLoading(false);
                    }}
                    disabled={ordersLoading}
                  >
                    <ArrowPathIcon className={`h-4 w-4 ${ordersLoading ? 'animate-spin' : ''}`} />
                    <span>{ordersLoading ? t('profile.loading') : t('profile.refresh', 'Refresh')}</span>
                  </button>
                </div>
              </div>
              {activeOrder && (
                <div className="mt-4 p-4 rounded-lg border border-amber-300 bg-amber-50">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <div className="text-sm">
                      <div className="font-medium">Active Order #{activeOrder.id.slice(0,8)}</div>
                      <div className="text-slate-600">Status: {delivered ? 'delivered' : cancelled ? 'cancelled' : activeOrder.status}</div>
                      {eta && (eta.readyMinutes || eta.deliveryMinutes) && (
                        <div className="text-xs text-slate-500 mt-1">
                          {eta.readyMinutes !== undefined && `Ready ~${eta.readyMinutes}m`}
                          {eta.deliveryMinutes !== undefined && ` • Delivery ~${eta.deliveryMinutes}m`}
                        </div>
                      )}
                    </div>
                    {eta?.expectedDeliveryAt && (
                      <div className="w-full mt-2">
                        <PizzaCarProgress ratio={progressRatio} />
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 items-center text-sm">
                    {!delivered && !cancelled && <button onClick={handleConfirm} className="px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700">Confirm</button>}
                    {!delivered && !cancelled && <button onClick={handleCancel} className="px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700">Cancel</button>}
                    {delivered && <span className="text-green-700">Delivered{autoConfirmed ? ' (auto)' : ''}</span>}
                    {cancelled && <span className="text-red-600">Cancelled</span>}
                  </div>
                </div>
              )}
              {/* Controls: filter toggle, page size */}
              {orders.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button className="btn-outline" onClick={() => setShowFilters(v => !v)} {...(showFilters ? { 'aria-pressed': true, 'aria-controls': 'profile-filters' } : {})}>
                    <FunnelIcon className="h-5 w-5 mr-2" /> {showFilters ? t('profile.hide_filters', 'Hide Filters') : t('profile.show_filters', 'Show Filters')}
                  </button>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-500">{'Profile Page Size'}</span>
                    <select aria-label={'Profile Page Size'} className="input !py-1 !px-2" value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                    </select>
                    <span className="text-slate-500">{'Profile Items'}</span>
                  </div>
                </div>
              )}

              {/* Filters panel */}
              {showFilters && (
                <div id="profile-filters" className="mt-4 grid gap-3 sm:grid-cols-2" aria-live="polite">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">{t('profile.filter_status', 'Filter Status')}</label>
                    <select aria-label={t('profile.filter_status', 'Filter Status')} className="input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                      <option value="all">{t('profile.all', 'All')}</option>
                      <option value="received">{t('order.status.received') || 'Received'}</option>
                      <option value="preparing">{t('order.status.preparing') || 'Preparing'}</option>
                      <option value="completed">{t('order.status.completed') || 'Completed'}</option>
                      <option value="cancelled">{t('order.status.cancelled') || 'Cancelled'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">{t('profile.filter_payment', 'Filter Payment')}</label>
                    <select aria-label={t('profile.filter_payment', 'Filter Payment')} className="input" value={filterMethod} onChange={e => setFilterMethod(e.target.value)}>
                      <option value="all">{t('profile.all', 'All')}</option>
                      <option value="promptpay">PromptPay</option>
                      <option value="card">Card</option>
                      <option value="cod">COD</option>
                    </select>
                  </div>
                </div>
              )}

              {ordersLoading ? (
                <div className="mt-6 text-slate-500 flex items-center gap-2 text-sm">
                  <ArrowPathIcon className="h-4 w-4 animate-spin" /> {t('profile.loading') || 'Loading...'}
                </div>
              ) : orders.length === 0 ? (
                <div className="mt-6 border border-dashed border-slate-300 rounded-lg p-8 text-center text-slate-500 text-sm">
                  <p>{t('profile.no_orders', 'You have no orders yet.')}</p>
                  <div className="mt-4 flex justify-center">
                    <Link to="/menu" className="btn-primary text-xs">{t('profile.order_first', 'Order your first meal')}</Link>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-4 space-y-3">
                    {pageSlice.map((o) => {
                      const status = (o.payment?.status || o.status || '').toLowerCase();
                      const method = (o.payment?.method || '').toLowerCase();
                      const statusColor = status.includes('cancel') ? 'bg-red-100 text-red-700' : status.includes('deliver') ? 'bg-green-100 text-green-700' : status.includes('prepar') ? 'bg-amber-100 text-amber-700' : status.includes('complete') ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700';
                      const methodColor = method === 'promptpay' ? 'bg-indigo-100 text-indigo-700' : method === 'card' ? 'bg-violet-100 text-violet-700' : method === 'cod' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700';
                      return (
                        <div key={o.id} className="p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition">
                          <div className="flex flex-wrap justify-between gap-3">
                            <div className="space-y-1">
                              <div className="text-xs font-mono text-slate-500">#{o.id.slice(0, 10)}</div>
                              <div className="text-sm text-slate-600">{new Date(o.createdAt).toLocaleString()}</div>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {o.deliveryType && <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] uppercase tracking-wide">{o.deliveryType}</span>}
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${methodColor}`}>{method || '—'}</span>
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColor}`}>{status || '—'}</span>
                              </div>
                            </div>
                            <div className="text-right ml-auto">
                              <div className="font-semibold tracking-tight">THB {o.total}</div>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Link to={`/order-confirmation?orderId=${o.id}`} className="btn-outline text-xs">View</Link>
                            <PrintButton orderId={o.id} />
                            <DownloadButton orderId={o.id} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-6 flex items-center justify-between text-sm">
                    <div className="text-slate-600">
                      {t('profile.showing', 'Showing')} {totalItems === 0 ? 0 : pageStart + 1}-{Math.min(pageEnd, totalItems)} {t('profile.of', 'of')} {totalItems}
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-outline" disabled={currentPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>{t('profile.prev', 'Prev')}</button>
                      <span className="self-center text-slate-500">{currentPage} / {totalPages}</span>
                      <button className="btn-outline" disabled={currentPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>{t('profile.next', 'Next')}</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

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
              <button
                type="button"
                className={`btn-outline relative ${cartCount === 0 ? 'opacity-60 cursor-not-allowed' : ''}`}
                onClick={() => { if (cartCount > 0) navigate('/cart'); }}
                disabled={cartCount === 0}
                aria-label={t('profile.view_cart') + (cartCount > 0 ? ` (${cartCount})` : '')}
                title={cartCount === 0 ? t('cart.empty', 'Cart kosong') : t('profile.view_cart')}
              >
                {t('profile.view_cart')}
                {cartCount > 0 && (
                  <span className="ml-2 flex items-center gap-1">
                    <span className={`inline-flex items-center justify-center rounded-full bg-brand-primary text-white text-[11px] leading-none px-2 py-0.5 ${pulse ? 'animate-pulse' : ''}`}>{cartCount}</span>
                    <span className="text-[11px] text-slate-500">THB {cartTotal.toFixed(0)}</span>
                  </span>
                )}
              </button>
              <Link to="/contact" className="btn-outline">{t('reach_out')}</Link>
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
};

const PrintButton = ({ orderId }: { orderId: string }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState<null | boolean>(null);
  const [err, setErr] = useState<string | null>(null);
  const onClick = async () => {
    setLoading(true);
    setErr(null);
    setOk(null);
    try {
      await endpoints.reprint(orderId);
      setOk(true);
      // brief success indicator
      setTimeout(() => setOk(null), 2000);
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'Failed to print');
      // auto clear after a while
      setTimeout(() => setErr(null), 3000);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="inline-flex items-center gap-2">
      <button type="button" className={`btn-outline text-xs inline-flex items-center gap-1 ${loading ? 'opacity-70' : ''}`} onClick={onClick} disabled={loading}>
        {loading ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <PrinterIcon className="h-4 w-4" />}
        <span>{ok ? t('profile.printed', 'Printed') : t('profile.print', 'Print')}</span>
      </button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
};

const DownloadButton = ({ orderId }: { orderId: string }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const onClick = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await api.get(`/orders/${orderId}/receipt.pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Try read filename from content-disposition
      const cd = (res.headers?.['content-disposition'] || res.headers?.['Content-Disposition'] || '') as string;
      const m = cd.match(/filename="?([^";]+)"?/i);
      a.download = m?.[1] || `receipt-${orderId.slice(0,8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'Failed to download');
      setTimeout(() => setErr(null), 3000);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="inline-flex items-center gap-2">
      <button type="button" className={`btn-outline text-xs ${loading ? 'opacity-70' : ''}`} onClick={onClick} disabled={loading}>
        {loading ? t('profile.downloading', 'Downloading...') : t('profile.download', 'Download')}
      </button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
};

export default ProfilePage;
