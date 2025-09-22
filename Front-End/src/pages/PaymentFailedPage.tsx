import { Link, useLocation } from 'react-router-dom';

export default function PaymentFailedPage() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const orderId = params.get('orderId') || undefined;
  const message = params.get('message') || 'Payment failed. Please try again.';
  return (
    <section className="py-10 max-w-xl mx-auto text-center">
      <h1 className="text-2xl font-bold mb-2">Payment Failed</h1>
      <p className="text-slate-700 mb-4">{message}</p>
      {orderId && <p className="text-sm text-gray-600">Order ID: <span className="font-mono">{orderId}</span></p>}
      <div className="mt-6 flex justify-center gap-3">
        <Link className="btn-outline" to="/checkout">Back to Checkout</Link>
        <Link className="btn-primary" to="/menu">Continue Shopping</Link>
      </div>
    </section>
  );
}