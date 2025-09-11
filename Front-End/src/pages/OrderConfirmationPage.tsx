import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { endpoints } from '../services/api';

export default function OrderConfirmationPage() {
  const { search } = useLocation();
  const orderId = new URLSearchParams(search).get('orderId');
  const [order, setOrder] = useState<any | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!orderId) return;
      try {
        const res = await endpoints.getOrder(orderId);
        if (!ignore) setOrder(res.data);
      } catch {}
    })();
    return () => { ignore = true; };
  }, [orderId]);

  return (
    <section className="py-10 max-w-2xl mx-auto text-center">
      <h1 className="text-3xl font-bold">Thank you for your order!</h1>
      <p className="text-slate-600 mt-2">We’re preparing your delicious meal.</p>
      {orderId && (
        <p className="mt-2 text-sm text-gray-600">Order ID: <span className="font-mono">{orderId}</span></p>
      )}
      {order && (
        <div className="mt-6 text-left card p-4">
          <h2 className="font-semibold mb-2">Summary</h2>
          <ul className="list-disc pl-6 text-sm text-gray-700">
            {order.items?.map((it: any) => (
              <li key={it.id}>{it.qty} × {it.nameSnapshot} — THB {it.priceSnapshot}</li>
            ))}
          </ul>
          <div className="mt-3 text-right">
            <div>Subtotal: THB {order.subtotal}</div>
            {order.deliveryFee ? <div>Delivery: THB {order.deliveryFee}</div> : null}
            <div className="font-semibold">Total: THB {order.total}</div>
          </div>
        </div>
      )}
      <div className="mt-6">
        <Link to="/menu" className="btn-primary">Continue Shopping</Link>
      </div>
    </section>
  );
}
