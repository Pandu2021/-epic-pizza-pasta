import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { QRCodeCanvas } from 'qrcode.react';
import { useCart } from '../store/cartStore';
import { endpoints } from '../services/api';
import { useNavigate } from 'react-router-dom';

const schema = z.object({
  name: z.string().min(1),
  phone: z.string().min(6),
  address: z.string().min(5),
  deliveryMethod: z.enum(['delivery', 'pickup'])
});

type FormValues = z.infer<typeof schema>;

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, total, clear } = useCart();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { deliveryMethod: 'delivery' } });

  const amount = useMemo(() => total(), [total]);
  const isCartEmpty = items.length === 0;

  const onSubmit = async (data: FormValues) => {
    setError(null);
    if (items.length === 0) {
      setError('Your cart is empty.');
      return;
    }
    try {
      setCreating(true);
      // 1) Create order in backend
      const payload = {
        customer: { name: data.name, phone: data.phone, address: data.address },
        items: items.map((it) => ({ id: it.id, name: it.name, qty: it.qty, price: it.price })),
        delivery: { type: data.deliveryMethod, fee: data.deliveryMethod === 'delivery' ? 39 : 0 },
        paymentMethod: 'promptpay'
      } as const;

      const res = await endpoints.createOrder(payload);
      const created = res.data as {
        orderId: string;
        status: string;
        amountTotal: number;
        payment?: { type: string; qrPayload?: string; status: string };
      };
      setOrderId(created.orderId);

      // 2) Ensure QR payload (use response if present; otherwise request generation)
      let qr = created.payment?.qrPayload || null;
      if (!qr && created.orderId) {
        const qrRes = await endpoints.createPromptPay({ orderId: created.orderId, amount: created.amountTotal ?? amount });
        qr = qrRes.data.qrPayload as string;
      }
      setQrPayload(qr);

      // 3) Start polling payment status
      if (created.orderId) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        pollRef.current = window.setInterval(async () => {
          try {
            const st = await endpoints.paymentStatus(created.orderId);
            if (st.data.status === 'paid') {
              if (pollRef.current) window.clearInterval(pollRef.current);
              clear();
              navigate(`/order-confirmation?orderId=${created.orderId}`);
            }
          } catch {
            // ignore transient errors
          }
        }, 2500) as unknown as number;
      }
    } catch (e) {
      setError('Failed to create order. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  return (
    <section className="grid gap-6 md:grid-cols-2">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <h1 className="text-xl font-semibold">Checkout</h1>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <input className="border rounded p-2 w-full" placeholder="Name" {...register('name')} />
        {errors.name && <p className="text-red-600 text-sm">Name is required</p>}
        <input className="border rounded p-2 w-full" placeholder="Phone" {...register('phone')} />
        {errors.phone && <p className="text-red-600 text-sm">Phone is required</p>}
        <textarea className="border rounded p-2 w-full" placeholder="Address" {...register('address')} />
        {errors.address && <p className="text-red-600 text-sm">Address is required</p>}
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input type="radio" value="delivery" {...register('deliveryMethod')} /> Delivery
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" value="pickup" {...register('deliveryMethod')} /> Pickup
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-primary" type="submit" disabled={creating || isCartEmpty}>
            {creating ? 'Placing order…' : 'Place order'}
          </button>
          <span className="text-sm text-gray-600">Total: THB {amount}</span>
        </div>
      </form>

      <div className="card p-4">
        <h2 className="text-lg font-semibold mb-2">PromptPay QR</h2>
        {qrPayload ? (
          <>
            <div className="grid place-items-center py-2">
              <QRCodeCanvas value={qrPayload} size={220} />
            </div>
            <p className="text-sm text-gray-600 mt-2">Scan with your banking app. Payment status will update automatically.</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="btn-outline"
                onClick={() => navigator.clipboard.writeText(String(amount))}
              >
                Copy Amount
              </button>
              <button
                type="button"
                className="btn-outline"
                onClick={async () => {
                  if (!orderId) return;
                  // Optional manual refresh
                  try {
                    const st = await endpoints.paymentStatus(orderId);
                    if (st.data.status === 'paid') {
                      clear();
                      navigate(`/order-confirmation?orderId=${orderId}`);
                    }
                  } catch {}
                }}
              >
                I’ve Paid
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-600">Create an order to generate QR code.</p>
        )}
      </div>
    </section>
  );
}
