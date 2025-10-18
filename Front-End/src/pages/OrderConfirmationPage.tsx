import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { endpoints, api } from '../services/api';
import { computeProgress, shouldAutoConfirm } from '../utils/tracking';
import PizzaCarProgress from '../components/PizzaCarProgress';
import { findGuestSession, purgeExpiredGuestSessions } from '../utils/guestSession';

// Small helper for status badge styling (aligned with ProfilePage semantics)
function statusClasses(status?: string) {
  if (!status) return 'bg-gray-200 text-gray-700';
  const s = status.toLowerCase();
  if (s === 'delivered' || s === 'completed') return 'bg-green-100 text-green-700 ring-1 ring-inset ring-green-600/20';
  if (s === 'cancelled') return 'bg-red-100 text-red-700 ring-1 ring-inset ring-red-600/20';
  if (s === 'out-for-delivery') return 'bg-indigo-100 text-indigo-700 ring-1 ring-inset ring-indigo-600/20 animate-pulse';
  if (s === 'preparing') return 'bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-600/20';
  if (s === 'received') return 'bg-slate-200 text-slate-700 ring-1 ring-inset ring-slate-400/30';
  return 'bg-gray-200 text-gray-700';
}

export default function OrderConfirmationPage() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const queryOrderId = params.get('orderId');
  const queryGuestToken = params.get('guestToken');
  // Resolve orderId: from query if present, else pick the latest in-flight order from user's history
  const [resolvedOrderId, setResolvedOrderId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState(true);
  const [order, setOrder] = useState<any | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [eta, setEta] = useState<{ readyMinutes?: number; deliveryMinutes?: number; expectedDeliveryAt?: number } | null>(null);
  const [delivered, setDelivered] = useState(false);
  const [autoConfirmed, setAutoConfirmed] = useState(false);
  const [progressRatio, setProgressRatio] = useState(0);
  const [cancelled, setCancelled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoTimerRef = useRef<number | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const guestPollRef = useRef<number | null>(null);
  const [guestToken, setGuestToken] = useState<string | null>(() => queryGuestToken);

  // Resolve order id if missing
  useEffect(() => {
    let ignore = false;
    purgeExpiredGuestSessions();
    (async () => {
      setResolvingId(true);
      if (queryOrderId && queryOrderId.trim().length > 0) {
        if (!ignore) {
          setResolvedOrderId(queryOrderId);
          if (!guestToken) {
            const session = findGuestSession({ orderId: queryOrderId, token: queryGuestToken || undefined });
            if (session) setGuestToken(session.token);
            else if (queryGuestToken) setGuestToken(queryGuestToken);
          }
        }
        setResolvingId(false);
        return;
      }

      const session = findGuestSession(queryGuestToken ? { token: queryGuestToken } : undefined);
      if (session) {
        if (!ignore) {
          setResolvedOrderId(session.orderId);
          setGuestToken(session.token);
        }
        setResolvingId(false);
        return;
      }

      // Fallback: try to pick active order from authenticated history
      try {
        const { data: list } = await endpoints.myOrders();
        const arr = Array.isArray(list) ? list : [];
        const active = [...arr]
          .filter((o: any) => !['delivered', 'cancelled'].includes(String(o.status || '').toLowerCase()))
          .sort((a: any, b: any) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
        const latest = active || arr.sort((a: any, b: any) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
        if (!ignore) {
          setResolvedOrderId(latest?.id || null);
          setGuestToken(null);
        }
      } catch (err: any) {
        if (!ignore) setResolvedOrderId(null);
      } finally {
        if (!ignore) setResolvingId(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [queryOrderId, queryGuestToken]);

  useEffect(() => {
    let ignore = false;
    const token = guestToken || queryGuestToken || null;
    (async () => {
      if (!resolvedOrderId) {
        setError('Missing order id');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        if (token) {
          const res = await endpoints.getGuestOrder(token);
          if (!ignore) {
            setOrder(res.data);
            const st = String(res.data?.status || '').toLowerCase();
            setStatus(res.data?.status || null);
            setDelivered(st === 'delivered');
            setCancelled(st === 'cancelled');
            const expected = res.data?.expectedDeliveryAt ? Date.parse(res.data.expectedDeliveryAt) : undefined;
            if (expected) setEta({ expectedDeliveryAt: expected });
          }
        } else {
          const res = await endpoints.getOrder(resolvedOrderId);
          if (!ignore) {
            setOrder(res.data);
            setStatus(res.data?.status);
            setDelivered(res.data?.status === 'delivered');
            setCancelled(res.data?.status === 'cancelled');
          }
        }
      } catch (err: any) {
        if (!ignore) setError('Failed to load order');
      } finally {
        if (!ignore) setLoading(false);
      }

      if (token) {
        if (guestPollRef.current) window.clearInterval(guestPollRef.current);
        guestPollRef.current = window.setInterval(async () => {
          try {
            const res = await endpoints.getGuestOrder(token);
            const st = String(res.data?.status || '').toLowerCase();
            setOrder((prev: any) => ({ ...(prev || {}), ...res.data }));
            setStatus(res.data?.status || null);
            setDelivered(st === 'delivered');
            setCancelled(st === 'cancelled');
          } catch {
            // ignore polling errors
          }
        }, 8000) as unknown as number;
        return;
      }

      // fetch initial eta (best-effort) for authenticated users
      try {
        const etaRes = await api.get(`/orders/${resolvedOrderId}/eta`);
        if (!ignore && etaRes.data) setEta({ readyMinutes: etaRes.data.readyMinutes, deliveryMinutes: etaRes.data.deliveryMinutes, expectedDeliveryAt: etaRes.data.expectedDeliveryAt ? Date.parse(etaRes.data.expectedDeliveryAt) : undefined });
      } catch {}
      // open SSE for live updates (authenticated only)
      try {
        const base = api.defaults.baseURL || '';
        const url = base.replace(/\/$/, '') + `/orders/${resolvedOrderId}/stream`;
        const es = new EventSource(url);
        esRef.current = es;
        es.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data || '{}');
            if (data?.type === 'order.status') {
              const st = data.payload?.status;
              if (!st) return;
              setStatus(st);
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
      if (guestPollRef.current) window.clearInterval(guestPollRef.current);
      if (autoTimerRef.current) window.clearTimeout(autoTimerRef.current);
      if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
    };
  }, [resolvedOrderId, guestToken, queryGuestToken]);

  // Progress animation loop
  useEffect(() => {
    if (!order || !eta?.expectedDeliveryAt || cancelled || delivered) return;
    const orderedAt = Date.parse(order.createdAt || new Date().toISOString());
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
    return () => {
      if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
    };
  }, [order, eta?.expectedDeliveryAt, cancelled, delivered]);

  const [actionLoading, setActionLoading] = useState<'confirm' | 'cancel' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const handleConfirm = async () => {
    if (!resolvedOrderId || delivered || cancelled) return;
    setActionLoading('confirm'); setActionError(null);
    try { await api.post(`/orders/${resolvedOrderId}/confirm-delivered`); setDelivered(true); setStatus('delivered'); }
    catch (e: any) { setActionError(e?.response?.data?.message || e?.message || 'Failed to confirm'); }
    finally { setActionLoading(null); }
  };
  const handleCancel = async () => {
    if (!resolvedOrderId || delivered || cancelled) return;
    setActionLoading('cancel'); setActionError(null);
    try { await api.post(`/orders/${resolvedOrderId}/cancel`); setCancelled(true); setStatus('cancelled'); }
    catch (e: any) { setActionError(e?.response?.data?.message || e?.message || 'Failed to cancel'); }
    finally { setActionLoading(null); }
  };
  const handleAutoConfirm = async () => {
    if (autoConfirmed || delivered || cancelled || !resolvedOrderId) return;
    try { await api.post(`/orders/${resolvedOrderId}/confirm-delivered`); setDelivered(true); setStatus('delivered'); setAutoConfirmed(true); } catch {}
  };

  const progressBar = eta?.expectedDeliveryAt ? (
    <div className="mt-6">
      <PizzaCarProgress ratio={progressRatio} startLabel="Restaurant" endLabel="Home" />
    </div>
  ) : null;

  const guestView = Boolean(guestToken || queryGuestToken);
  const showActions = !guestView && !delivered && !cancelled && !loading && !resolvingId && !!resolvedOrderId;
  const readyOrDeliveryText = eta && (eta.readyMinutes || eta.deliveryMinutes) ? (
    <p className="mt-1 text-xs text-gray-500">
      {eta.readyMinutes !== undefined && `Ready in ~${eta.readyMinutes} min`}
      {eta.deliveryMinutes !== undefined && ` • Delivery in ~${eta.deliveryMinutes} min`}
    </p>
  ) : null;

  return (
    <section className="py-10 max-w-2xl mx-auto text-center">
      <h1 className="text-3xl font-bold">Thank you for your order!</h1>
      <p className="text-slate-600 mt-2">We’re preparing your delicious meal.</p>
      {loading && <p className="mt-4 text-sm text-slate-500 animate-pulse">Loading order details…</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {status && !loading && !error && (
        <p className="mt-2 text-sm text-gray-500 flex items-center justify-center gap-2">Status:
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusClasses(status)}`}>{status}</span>
        </p>
      )}
      {readyOrDeliveryText}
      {resolvedOrderId && (
        <p className="mt-2 text-sm text-gray-600">Order ID: <span className="font-mono">{resolvedOrderId}</span></p>
      )}
      {guestView && guestToken && (
        <p className="mt-2 text-xs text-gray-500">Guest session token: <span className="font-mono break-all">{guestToken}</span></p>
      )}
      {!resolvedOrderId && !loading && !resolvingId && (
        <p className="mt-2 text-sm text-red-600">Order ID tidak ditemukan. Silakan kembali ke Profil untuk memilih pesanan aktif.</p>
      )}
      {order && !error && (
        <div className="mt-6 text-left card p-5 border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="font-semibold">Summary</h2>
            {status && <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusClasses(status)}`}>{status}</span>}
          </div>
          {order.verification && order.verification.channel && (
            <p className="mt-2 text-xs text-emerald-600">
              Contact verified via {order.verification.channel} at{' '}
              {new Date(order.verification.verifiedAt).toLocaleString()}
            </p>
          )}
          <ul className="mt-3 space-y-1 text-sm text-gray-700">
            {order.items?.map((it: any, idx: number) => {
              const name = it.nameSnapshot || it.name || `Item ${idx + 1}`;
              const price = Number(it.priceSnapshot ?? it.price ?? 0);
              const key = it.id || `${name}-${idx}`;
              return (
                <li key={key} className="flex justify-between gap-4"><span>{it.qty} × {name}</span><span className="tabular-nums">THB {price}</span></li>
              );
            })}
          </ul>
          <div className="mt-4 border-t pt-3 space-y-1 text-right text-sm">
            <div>Subtotal: THB {order.subtotal}</div>
            {order.deliveryFee ? <div>Delivery: THB {order.deliveryFee}</div> : null}
            {order.tax ? <div>VAT: THB {order.tax}</div> : null}
            {order.discount ? <div className="text-emerald-600">Discount: -THB {order.discount}</div> : null}
            <div className="font-semibold text-base">Total: THB {order.total}</div>
          </div>
          {progressBar}
          <div className="mt-5 flex flex-wrap gap-3 items-center">
            {showActions && (
              <button onClick={handleConfirm} className="px-4 py-2 rounded bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-50" disabled={delivered || cancelled || actionLoading !== null}>
                {actionLoading === 'confirm' ? 'Confirming…' : 'Confirm Delivery'}
              </button>
            )}
            {showActions && (
              <button onClick={handleCancel} className="px-4 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-50" disabled={delivered || cancelled || actionLoading !== null}>
                {actionLoading === 'cancel' ? 'Cancelling…' : 'Cancel Order'}
              </button>
            )}
            {delivered && <span className="text-sm text-green-700">Delivered{autoConfirmed ? ' (auto)' : ''}</span>}
            {cancelled && <span className="text-sm text-red-600">Cancelled</span>}
            {actionError && <span className="text-xs text-red-600">{actionError}</span>}
            {!delivered && !cancelled && progressRatio >= 1 && shouldAutoConfirm(false, eta?.expectedDeliveryAt) && (
              <span className="text-xs text-slate-500">Auto-confirming soon…</span>
            )}
          </div>
        </div>
      )}
      <div className="mt-8">
        <Link to="/menu" className="btn-primary">Continue Shopping</Link>
      </div>
    </section>
  );
}
