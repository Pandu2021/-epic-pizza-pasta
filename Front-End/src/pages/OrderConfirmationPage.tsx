import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { endpoints, api } from '../services/api';
import { computeProgress, shouldAutoConfirm } from '../utils/tracking';
import PizzaCarProgress from '../components/PizzaCarProgress';

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
  const orderId = new URLSearchParams(search).get('orderId');
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

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!orderId) { setError('Missing order id'); return; }
      setLoading(true); setError(null);
      try {
        const res = await endpoints.getOrder(orderId);
        if (!ignore) {
          setOrder(res.data);
          setStatus(res.data?.status);
          setDelivered(res.data?.status === 'delivered');
          setCancelled(res.data?.status === 'cancelled');
        }
      } catch (e: any) {
        if (!ignore) setError('Failed to load order');
      } finally { if (!ignore) setLoading(false); }
      // fetch initial eta (best-effort)
      try {
        const etaRes = await api.get(`/orders/${orderId}/eta`);
        if (!ignore && etaRes.data) setEta({ readyMinutes: etaRes.data.readyMinutes, deliveryMinutes: etaRes.data.deliveryMinutes, expectedDeliveryAt: etaRes.data.expectedDeliveryAt ? Date.parse(etaRes.data.expectedDeliveryAt) : undefined });
      } catch {}
      // open SSE for live updates
      try {
        const base = api.defaults.baseURL || '';
        const url = base.replace(/\/$/, '') + `/orders/${orderId}/stream`;
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
        es.onerror = () => { try { es.close(); } catch {}; };
      } catch {}
    })();
    return () => { ignore = true; if (esRef.current) { try { esRef.current.close(); } catch {} } if (autoTimerRef.current) window.clearTimeout(autoTimerRef.current); if (progressTimerRef.current) window.clearInterval(progressTimerRef.current); };
  }, [orderId]);

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
    return () => { if (progressTimerRef.current) window.clearInterval(progressTimerRef.current); };
  }, [order, eta?.expectedDeliveryAt, cancelled, delivered]);

  const handleConfirm = async () => {
    if (!orderId || delivered || cancelled) return;
    try { await api.post(`/orders/${orderId}/confirm-delivered`); setDelivered(true); setStatus('delivered'); } catch {}
  };
  const handleCancel = async () => {
    if (!orderId || delivered || cancelled) return;
    try { await api.post(`/orders/${orderId}/cancel`); setCancelled(true); setStatus('cancelled'); } catch {}
  };
  const handleAutoConfirm = async () => {
    if (autoConfirmed || delivered || cancelled || !orderId) return;
    try { await api.post(`/orders/${orderId}/confirm-delivered`); setDelivered(true); setStatus('delivered'); setAutoConfirmed(true); } catch {}
  };

  const progressBar = eta?.expectedDeliveryAt ? (
    <div className="mt-6">
      <PizzaCarProgress ratio={progressRatio} startLabel="Restaurant" endLabel="Home" />
    </div>
  ) : null;

  const showActions = !delivered && !cancelled && !loading && !error;
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
      {orderId && (
        <p className="mt-2 text-sm text-gray-600">Order ID: <span className="font-mono">{orderId}</span></p>
      )}
      {order && !error && (
        <div className="mt-6 text-left card p-5 border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="font-semibold">Summary</h2>
            {status && <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusClasses(status)}`}>{status}</span>}
          </div>
          <ul className="mt-3 space-y-1 text-sm text-gray-700">
            {order.items?.map((it: any) => (
              <li key={it.id} className="flex justify-between gap-4"><span>{it.qty} × {it.nameSnapshot}</span><span className="tabular-nums">THB {it.priceSnapshot}</span></li>
            ))}
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
              <button onClick={handleConfirm} className="px-4 py-2 rounded bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-50" disabled={delivered || cancelled}>Confirm Delivery</button>
            )}
            {showActions && (
              <button onClick={handleCancel} className="px-4 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-50" disabled={delivered || cancelled}>Cancel Order</button>
            )}
            {delivered && <span className="text-sm text-green-700">Delivered{autoConfirmed ? ' (auto)' : ''}</span>}
            {cancelled && <span className="text-sm text-red-600">Cancelled</span>}
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
