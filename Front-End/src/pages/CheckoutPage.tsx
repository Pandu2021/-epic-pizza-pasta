import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { QRCodeCanvas } from 'qrcode.react';
import { useCart } from '../store/cartStore';
import { endpoints } from '../services/api';
import { useNavigate } from 'react-router-dom';

const thPhone = z
  .string()
  .min(9)
  .refine((v) => /^0\d{9}$/.test(v) || /^\+66\d{8,9}$/.test(v), {
    message: 'Please enter a valid Thai phone (0XXXXXXXXX or +66XXXXXXXXX)'
  });

const schema = z.object({
  name: z.string().min(1),
  phone: thPhone,
  address: z.string().min(5),
  deliveryMethod: z.enum(['delivery', 'pickup']),
  paymentMethod: z.enum(['promptpay', 'card', 'cod']).default('promptpay'),
  // Basic card fields for test mode (Omise tokenization)
  cardName: z.string().optional(),
  cardNumber: z.string().optional(),
  cardExpMonth: z.string().optional(),
  cardExpYear: z.string().optional(),
  cardCvc: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, total, clear } = useCart();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { deliveryMethod: 'delivery', paymentMethod: 'promptpay' } });

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
        items: items.map((it) => ({ id: it.id, name: it.name, qty: Math.round(it.qty), price: Math.round(it.price), options: it.options ?? undefined })),
        delivery: { type: data.deliveryMethod, fee: data.deliveryMethod === 'delivery' ? 39 : 0 },
        paymentMethod: data.paymentMethod
      } as const;

      const res = await endpoints.createOrder(payload);
      const created = res.data as {
        orderId: string;
        status: string;
        amountTotal: number;
        payment?: { type: string; qrPayload?: string; status: string };
      };
      setOrderId(created.orderId);

      // 2) Payment flow by method
      if (data.paymentMethod === 'promptpay') {
        // Prefer Omise-based PromptPay to test end-to-end provider flow; fallback to local generator
        let qr = created.payment?.qrPayload || null;
        let qrImg: string | null = null;
        if (created.orderId) {
          try {
            const r = await endpoints.createOmisePromptPay({ orderId: created.orderId, amount: created.amountTotal ?? amount });
            qr = (r.data?.qrPayload as string) || null;
            qrImg = (r.data?.qrImageUrl as string) || null;
          } catch {
            // fallback to local payload
            const qrRes = await endpoints.createPromptPay({ orderId: created.orderId, amount: created.amountTotal ?? amount });
            qr = qrRes.data.qrPayload as string;
          }
        }
        setQrPayload(qr);
        setQrImageUrl(qrImg);
      } else if (data.paymentMethod === 'card') {
        // Tokenize with OmiseJS (test mode). Expect window.Omise defined after script load.
        const pk = import.meta.env.VITE_OMISE_PUBLIC_KEY as string | undefined;
        if (!pk) throw new Error('Omise public key not configured');

        // Lazy-load Omise script if not present
        if (!(window as any).Omise) {
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.omise.co/omise.js';
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('Failed to load Omise.js'));
            document.head.appendChild(s);
          });
        }
        const Omise = (window as any).Omise;
        Omise.setPublicKey(pk);

        const cardNumber = (data.cardNumber || '').replace(/\s+/g, '');
        const expMonth = Number(data.cardExpMonth || 0);
        const expYear = Number(data.cardExpYear || 0);
        const name = data.cardName || 'Cardholder';
        const securityCode = data.cardCvc || '';

        let token: string;
        try {
          token = await new Promise((resolve, reject) => {
            Omise.createToken('card', { name, number: cardNumber, expiration_month: expMonth, expiration_year: expYear, security_code: securityCode }, (status: number, response: any) => {
              if (status === 200 && response.id) resolve(response.id);
              else reject(new Error(response?.message || 'Failed to tokenize card'));
            });
          });
        } catch (tokErr: any) {
          setError(tokErr?.message || 'Failed to tokenize card. Please check your card details.');
          return;
        }

        // Charge via backend
        if (!created.orderId) throw new Error('Order not created');
        let ok = false;
        let failMsg: string | undefined;
        try {
          const chargeRes = await endpoints.omiseCharge({ orderId: created.orderId, amount: created.amountTotal ?? amount, token });
          ok = !!chargeRes.data?.ok;
          if (!ok) failMsg = chargeRes.data?.message || 'Card charge failed. Please try another card.';
        } catch (err: any) {
          failMsg = err?.response?.data?.message || err?.message || 'Card charge failed. Please try another card.';
        }
        if (ok) {
          clear();
          navigate(`/order-confirmation?orderId=${created.orderId}`);
        } else {
          const msg = failMsg || 'Card charge failed. Please try another card.';
          navigate(`/payment-failed?orderId=${created.orderId}&message=${encodeURIComponent(msg)}`);
        }
      } else if (data.paymentMethod === 'cod') {
        // No online payment, show simple confirmation
        setQrPayload(null);
        if (created.orderId) {
          clear();
          navigate(`/order-confirmation?orderId=${created.orderId}`);
        }
      }

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
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      const m = Array.isArray(msg) ? msg.join('\n') : (typeof msg === 'string' ? msg : null);
      const fallback = (e && e.message) ? e.message : 'Failed to create order. Please try again.';
      setError(m || fallback);
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
  <input className="border rounded p-2 w-full" placeholder="Phone" type="tel" {...register('phone')} />
  {errors.phone && <p className="text-red-600 text-sm">{errors.phone.message || 'Valid Thai phone is required'}</p>}
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
        <div className="flex flex-col gap-2">
          <span className="font-medium">Payment Method</span>
          <label className="flex items-center gap-2">
            <input type="radio" value="promptpay" {...register('paymentMethod')} /> PromptPay (QR)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" value="card" {...register('paymentMethod')} /> Card (Omise)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" value="cod" {...register('paymentMethod')} /> Cash on Delivery (COD)
          </label>
        </div>

        {/* Card form (shown only if card selected) */}
        {watch('paymentMethod') === 'card' && (
          <div className="grid gap-2">
            <input className="border rounded p-2 w-full" placeholder="Name on Card" {...register('cardName')} />
            <input className="border rounded p-2 w-full" placeholder="Card Number" {...register('cardNumber')} />
            <div className="grid grid-cols-3 gap-2">
              <input className="border rounded p-2 w-full" placeholder="MM" {...register('cardExpMonth')} />
              <input className="border rounded p-2 w-full" placeholder="YYYY" {...register('cardExpYear')} />
              <input className="border rounded p-2 w-full" placeholder="CVC" {...register('cardCvc')} />
            </div>
            <p className="text-xs text-gray-500">Use Omise test card: 4242 4242 4242 4242, any future date, any CVC</p>
          </div>
        )}
        <div className="flex items-center gap-3">
          <button className="btn-primary" type="submit" disabled={creating || isCartEmpty}>
            {creating ? 'Placing order…' : 'Place order'}
          </button>
          <span className="text-sm text-gray-600">Total: THB {amount}</span>
        </div>
      </form>

      <div className="card p-4">
        <h2 className="text-lg font-semibold mb-2">PromptPay QR</h2>
        {qrImageUrl || qrPayload ? (
          <>
            <div className="grid place-items-center py-2">
              {qrImageUrl ? (
                <img src={qrImageUrl} alt="PromptPay QR" className="w-[220px] h-[220px] object-contain" />
              ) : (
                qrPayload && <QRCodeCanvas value={qrPayload} size={220} />
              )}
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
          <p className="text-sm text-gray-600">Create an order to generate QR code (shown when PromptPay selected).</p>
        )}
      </div>
    </section>
  );
}
