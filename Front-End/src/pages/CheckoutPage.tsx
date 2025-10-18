import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { QRCodeCanvas } from 'qrcode.react';
import { useCart } from '../store/cartStore';
import { useAuth } from '../store/authStore';
import { endpoints } from '../services/api';
import { useNavigate, useLocation } from 'react-router-dom';
import { rememberGuestSession, purgeExpiredGuestSessions } from '../utils/guestSession';
import CaptchaGate from '../components/CaptchaGate';

const thPhone = z
  .string()
  .min(9)
  .refine((v) => /^0\d{9}$/.test(v) || /^\+66\d{8,9}$/.test(v), {
    message: 'Please enter a valid Thai phone (0XXXXXXXXX or +66XXXXXXXXX)'
  });

const schema = z
  .object({
    name: z.string().min(1),
    phone: thPhone,
    email: z
      .string()
      .optional()
      .transform((value) => (value || '').trim())
      .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value), {
        message: 'Please enter a valid email address if provided',
      }),
    // Address required only when delivery
    address: z.string().optional(),
    deliveryMethod: z.enum(['delivery', 'pickup']),
    paymentMethod: z.enum(['promptpay', 'card', 'cod']).default('promptpay'),
    // Basic card fields for test mode (Omise tokenization)
    cardName: z.string().optional(),
    cardNumber: z.string().optional(),
    cardExpMonth: z.string().optional(),
    cardExpYear: z.string().optional(),
    cardCvc: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.deliveryMethod === 'delivery') {
      const addr = (data.address || '').trim();
      if (!addr || addr.length < 5) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['address'], message: 'Address is required for delivery' });
      }
    }
  });

type FormValues = z.infer<typeof schema>;

export default function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items, total, clear } = useCart();
  const { user, loading: authLoading, fetchMe } = useAuth();
  const mountedRef = useRef(false);
  const [guestMode, setGuestMode] = useState(false);
  const [activeGuestToken, setActiveGuestToken] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<{ subtotal: number; deliveryFee: number; tax: number; discount: number; total: number; expectedReadyAt?: string; expectedDeliveryAt?: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [omisePublicKey, setOmisePublicKey] = useState<string | null>(() => {
    const pk = import.meta.env.VITE_OMISE_PUBLIC_KEY as string | undefined;
    return pk || null;
  });
  const pollRef = useRef<number | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaRefreshKey, setCaptchaRefreshKey] = useState(0);
  const captchaSiteKey = (import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined) || null;
  const requireCaptcha = Boolean(captchaSiteKey);
  const [verificationRequestId, setVerificationRequestId] = useState<string | null>(null);
  const [verificationExpiry, setVerificationExpiry] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'sending' | 'code-sent' | 'verifying' | 'verified'>('idle');
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const resetVerificationState = useCallback(() => {
    setVerificationStatus('idle');
    setVerificationRequestId(null);
    setVerificationExpiry(null);
    setVerificationToken(null);
    setVerificationCode('');
    setVerificationMessage(null);
    setVerificationError(null);
    setVerifiedEmail(null);
  }, []);
  const verificationSecondsRemaining = useMemo(() => {
    if (verificationStatus !== 'code-sent' || !verificationExpiry) return null;
    const expires = Date.parse(verificationExpiry);
    if (!Number.isFinite(expires)) return null;
    return Math.ceil((expires - nowMs) / 1000);
  }, [nowMs, verificationExpiry, verificationStatus]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { deliveryMethod: 'delivery', paymentMethod: 'promptpay', email: '' },
  });

  // Raw cart subtotal (without delivery/tax)
  const cartSubtotal = useMemo(() => total(), [total]);
  const deliveryMethod = watch('deliveryMethod');
  const paymentMethod = watch('paymentMethod');
  const emailValue = watch('email');
  const normalizedEmail = useMemo(() => (emailValue || '').trim().toLowerCase(), [emailValue]);

  // Local preview breakdown BEFORE order is created (mirrors backend logic simplified)
  const previewBreakdown = useMemo(() => {
    if (items.length === 0) return null;
    const subtotal = items.reduce((s, it) => s + Math.round(it.price) * Math.max(1, Math.round(it.qty)), 0);
    const FREE_DELIVERY_THRESHOLD = 600;
    const baseDelivery = deliveryMethod === 'delivery' ? 39 : 0;
    const deliveryFee = deliveryMethod === 'delivery' && subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : baseDelivery;
    const vatRate = Number(import.meta.env.VITE_THAI_VAT_RATE || 0.07);
    const tax = Math.round((subtotal + deliveryFee) * vatRate);
    const discount = 0;
    const totalAmount = subtotal + deliveryFee + tax - discount;
    return { subtotal, deliveryFee, tax, discount, total: totalAmount, freeDeliveryThreshold: FREE_DELIVERY_THRESHOLD } as any;
  }, [items, deliveryMethod]);

  // Final breakdown (prefer backend result after order creation, else preview)
  const effectiveBreakdown = breakdown || previewBreakdown;
  const displayTotal = effectiveBreakdown ? effectiveBreakdown.total : cartSubtotal;
  const isCartEmpty = items.length === 0;

  const MIN_ORDER = 99;
  useEffect(() => {
    purgeExpiredGuestSessions();
  }, []);

  useEffect(() => {
    if (!guestMode) {
      resetVerificationState();
      if (requireCaptcha) {
        setCaptchaToken(null);
        setCaptchaRefreshKey((key) => key + 1);
      }
    }
  }, [guestMode, resetVerificationState, requireCaptcha]);

  useEffect(() => {
    if (verificationStatus !== 'code-sent') {
      return;
    }
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [verificationStatus]);

  useEffect(() => {
    if (verificationStatus !== 'code-sent') return;
    if (verificationSecondsRemaining !== null && verificationSecondsRemaining <= 0) {
      resetVerificationState();
      setVerificationError('Verification code expired. Please request a new code.');
    }
  }, [verificationSecondsRemaining, verificationStatus, resetVerificationState]);

  useEffect(() => {
    if (verificationStatus !== 'verified' || !verifiedEmail) return;
    if (!normalizedEmail || normalizedEmail !== verifiedEmail) {
      resetVerificationState();
    }
  }, [normalizedEmail, verificationStatus, verifiedEmail, resetVerificationState]);

  useEffect(() => {
    if (!guestMode || user) return;
    if (!normalizedEmail) {
      resetVerificationState();
    }
  }, [guestMode, user, normalizedEmail, resetVerificationState]);

  useEffect(() => {
    if (authLoading) return;
    const params = new URLSearchParams(location.search);
    const guestParam = (params.get('guest') || '').toLowerCase();
    const guestSelected = ['1', 'true', 'yes', 'guest'].includes(guestParam);
    if (user) {
      setGuestMode(false);
      setActiveGuestToken(null);
      if (guestSelected) {
        navigate('/checkout', { replace: true });
      }
      return;
    }
    if (guestSelected) {
      setGuestMode(true);
    } else {
      navigate('/checkout/start', { replace: true });
    }
  }, [authLoading, location.search, navigate, user]);

  useEffect(() => {
    if (omisePublicKey) return;
    (async () => {
      try {
        const cfg = await endpoints.paymentConfig();
        const pk = cfg.data?.omisePublicKey as string | undefined;
        if (pk) setOmisePublicKey(pk);
      } catch {
        // ignore and fallback to runtime fetch during card submission
      }
    })();
  }, [omisePublicKey]);

  const handleSendVerification = useCallback(async () => {
    if (!guestMode || user) return;
    const channel: 'email' = 'email';
    const target = normalizedEmail;
    setVerificationError(null);
    setVerificationMessage(null);
    if (verificationStatus === 'sending') return;
    if (!target) {
      setVerificationError('Please enter an email address before requesting verification.');
      return;
    }
    if (requireCaptcha && !captchaToken) {
      setVerificationError('Complete the captcha before requesting a verification code.');
      return;
    }
    try {
      setVerificationStatus('sending');
      const { data } = await endpoints.requestGuestVerification({ channel, target }, captchaToken || undefined);
      setVerificationRequestId(data?.requestId || null);
      setVerificationExpiry(data?.expiresAt || null);
      setVerificationStatus('code-sent');
      setVerificationMessage('Verification code sent via email.');
      setVerificationToken(null);
      setVerifiedEmail(null);
      setVerificationCode('');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to send verification code.';
      setVerificationError(msg);
      setVerificationStatus('idle');
    } finally {
      if (requireCaptcha) {
        setCaptchaToken(null);
        setCaptchaRefreshKey((key) => key + 1);
      }
    }
  }, [guestMode, user, normalizedEmail, verificationStatus, requireCaptcha, captchaToken]);

  const handleConfirmVerification = useCallback(async () => {
    if (!guestMode || user) return;
    if (!verificationRequestId) {
      setVerificationError('Request a verification code first.');
      return;
    }
    const trimmedCode = verificationCode.trim();
    if (!trimmedCode) {
      setVerificationError('Enter the verification code you received.');
      return;
    }
    try {
      setVerificationError(null);
      setVerificationStatus('verifying');
      const res = await endpoints.confirmGuestVerification({ requestId: verificationRequestId, code: trimmedCode });
      const payload = res.data as { verificationToken?: string; expiresAt?: string };
      if (!payload?.verificationToken) {
        throw new Error('Verification token missing from response');
      }
      const channel: 'email' = 'email';
      const target = normalizedEmail;
      if (!target) {
        setVerificationError('Enter your email address before confirming verification.');
        setVerificationStatus('code-sent');
        return;
      }
      setVerificationToken(payload.verificationToken);
      setVerificationStatus('verified');
      setVerificationMessage('Contact verified successfully.');
      setVerifiedEmail(target);
      setVerificationCode('');
      setVerificationExpiry(payload?.expiresAt || null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Verification failed. Please double check the code.';
      setVerificationError(msg);
      setVerificationStatus('code-sent');
    }
  }, [guestMode, user, verificationRequestId, verificationCode, normalizedEmail]);

  const onSubmit = async (data: FormValues) => {
    setError(null);
    if (items.length === 0) {
      setError('Your cart is empty.');
      return;
    }
    if (!user && guestMode) {
      if (!verificationToken) {
        setError('Complete contact verification before placing an order.');
        return;
      }
      if (requireCaptcha && !captchaToken) {
        setError('Complete the captcha challenge before placing the order.');
        return;
      }
    }
    if (previewBreakdown && previewBreakdown.subtotal < MIN_ORDER) {
      setError(`Minimum order is THB ${MIN_ORDER}. Add more items.`);
      return;
    }
    if (creating) return;
    const useGuestFlow = !user && guestMode;
    const emailNormalized = (data.email || '').trim().toLowerCase();
    if (useGuestFlow && !emailNormalized) {
      setError('Guest checkout requires a valid email address for OTP verification.');
      return;
    }
    try {
      setCreating(true);
      // 1) Create order in backend
      const payload = {
        customer: {
          name: data.name.trim(),
          phone: data.phone.replace(/[\s-]/g, ''),
          email: emailNormalized || undefined,
          address: (data.address || '').trim() || undefined,
        },
        items: items.map((it) => ({ id: it.id, name: it.name, qty: Math.round(it.qty), price: Math.round(it.price), options: it.options ?? undefined })),
        delivery: { type: data.deliveryMethod, fee: data.deliveryMethod === 'delivery' ? 39 : 0 },
        paymentMethod: data.paymentMethod,
        verificationToken: verificationToken || undefined,
      } as const;

      const res = await (useGuestFlow
        ? endpoints.createGuestOrder(payload, captchaToken || undefined)
        : endpoints.createOrder(payload));
      if (useGuestFlow && requireCaptcha) {
        setCaptchaToken(null);
        setCaptchaRefreshKey((key) => key + 1);
      }
      type CreateResponse = {
        orderId: string;
        status: string;
        amountTotal: number;
        subtotal: number;
        deliveryFee: number;
        tax: number;
        discount: number;
        expectedReadyAt?: string;
        expectedDeliveryAt?: string;
        payment?: { type: string; qrPayload?: string; status: string };
        guestToken?: string;
        expiresAt?: string;
      };
      const created = res.data as CreateResponse;
      if (!created.orderId) {
        throw new Error('Order not created');
      }
      const tokenFromResponse = useGuestFlow ? created.guestToken ?? null : null;
      if (useGuestFlow && tokenFromResponse) {
        const expiresAt = typeof created.expiresAt === 'string' ? created.expiresAt : new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
        rememberGuestSession({ orderId: created.orderId, token: tokenFromResponse, expiresAt });
        setActiveGuestToken(tokenFromResponse);
      }
      if (useGuestFlow) {
        resetVerificationState();
      }
  const sessionToken = useGuestFlow ? (tokenFromResponse || activeGuestToken) : null;
      setOrderId(created.orderId);
      setBreakdown({ subtotal: created.subtotal, deliveryFee: created.deliveryFee, tax: created.tax, discount: created.discount, total: created.amountTotal, expectedReadyAt: created.expectedReadyAt, expectedDeliveryAt: created.expectedDeliveryAt });

      const amountForPayment = created.amountTotal ?? effectiveBreakdown?.total ?? 0;

      // 2) Payment flow by method
      if (data.paymentMethod === 'promptpay') {
        // Prefer Omise-based PromptPay to test end-to-end provider flow; fallback to local generator
        let qr = created.payment?.qrPayload || null;
        let qrImg: string | null = null;
        if (created.orderId) {
          try {
            const r = await endpoints.createOmisePromptPay({ orderId: created.orderId, amount: amountForPayment });
            qr = (r.data?.qrPayload as string) || null;
            qrImg = (r.data?.qrImageUrl as string) || null;
          } catch {
            // fallback to local payload
            const qrRes = await endpoints.createPromptPay({ orderId: created.orderId, amount: amountForPayment });
            qr = qrRes.data.qrPayload as string;
          }
        }
        setQrPayload(qr);
        setQrImageUrl(qrImg);
      } else if (data.paymentMethod === 'card') {
        // Tokenize with OmiseJS (test mode). Expect window.Omise defined after script load.
        let pk = omisePublicKey;
        if (!pk) {
          try {
            const cfg = await endpoints.paymentConfig();
            pk = (cfg.data?.omisePublicKey as string | undefined) || null;
            if (pk) setOmisePublicKey(pk);
          } catch {
            // ignore, error handled below when pk still missing
          }
        }
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
          const chargeRes = await endpoints.omiseCharge({ orderId: created.orderId, amount: amountForPayment, token });
          ok = !!chargeRes.data?.ok;
          if (!ok) failMsg = chargeRes.data?.message || 'Card charge failed. Please try another card.';
        } catch (err: any) {
          failMsg = err?.response?.data?.message || err?.message || 'Card charge failed. Please try another card.';
        }
        if (ok) {
          clear();
          navigate(`/order-confirmation?orderId=${created.orderId}${sessionToken ? `&guestToken=${encodeURIComponent(sessionToken)}` : ''}`);
        } else {
          const msg = failMsg || 'Card charge failed. Please try another card.';
          navigate(`/payment-failed?orderId=${created.orderId}${sessionToken ? '&mode=guest' : ''}&message=${encodeURIComponent(msg)}`);
        }
      } else if (data.paymentMethod === 'cod') {
        // No online payment, show simple confirmation
        setQrPayload(null);
        if (created.orderId) {
          clear();
          navigate(`/order-confirmation?orderId=${created.orderId}${sessionToken ? `&guestToken=${encodeURIComponent(sessionToken)}` : ''}`);
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
              navigate(`/order-confirmation?orderId=${created.orderId}${sessionToken ? `&guestToken=${encodeURIComponent(sessionToken)}` : ''}`);
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
      if (useGuestFlow && requireCaptcha) {
        setCaptchaToken(null);
        setCaptchaRefreshKey((key) => key + 1);
      }
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  // Auth gate: fetch user once; if unauth after load, redirect to login preserving next
  useEffect(() => {
    (async () => {
      try { await fetchMe(); } catch {}
    })();
  }, []);

  // Redirect if cart emptied (after mount) and no order in progress
  useEffect(() => {
    if (mountedRef.current && items.length === 0 && !creating && !orderId) {
      navigate('/cart');
    }
  }, [items.length, creating, orderId, navigate]);
  useEffect(() => { mountedRef.current = true; }, []);

  if (authLoading) {
    return (
      <section className="py-10" aria-labelledby="checkout-heading" {...(authLoading ? { 'aria-busy': true } as any : {})}>
        <h1 id="checkout-heading" className="text-xl font-semibold mb-4">Checkout</h1>
        <p className="text-sm text-gray-600">Loading account...</p>
      </section>
    );
  }

  return (
    <section className="grid gap-6 md:grid-cols-2" aria-labelledby="checkout-heading">
  <form
    onSubmit={handleSubmit(onSubmit)}
    className="space-y-3"
    {...(creating ? { 'aria-busy': true } as any : {})}
  >
        {/* Live region for submit status (screen reader only) */}
        <p className="sr-only" aria-live="polite" role="status">
          {creating ? 'Submitting order…' : 'Form ready'}
        </p>
        <h1 id="checkout-heading" className="text-xl font-semibold">Checkout</h1>
        {!user && guestMode && (
          <div className="space-y-3">
            <div className="rounded border border-slate-200 bg-slate-50 p-3 space-y-2 text-sm">
              <p className="text-gray-700">Guest checkout active. We will issue a secure session token after you place the order. Sessions expire automatically after two hours.</p>
              <button
                type="button"
                className="btn-outline"
                onClick={() => navigate('/checkout/start')}
              >
                Change Checkout Method
              </button>
            </div>
            {requireCaptcha && (
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm space-y-2">
                <p className="text-amber-700">Complete the captcha to unlock verification and checkout.</p>
                <CaptchaGate siteKey={captchaSiteKey} refreshKey={captchaRefreshKey} onToken={setCaptchaToken} />
                {!captchaToken && <p className="text-xs text-amber-600">Token required for secure guest actions.</p>}
              </div>
            )}
            <div className="rounded border border-slate-200 bg-white p-3 text-sm space-y-3">
              <div className="flex flex-col gap-2">
                <span className="font-medium text-slate-700">Verify your contact</span>
                <p className="text-xs text-slate-500">For now we deliver guest OTP codes by email only. Enter your email address below, request the code, and confirm it before checkout.</p>
              </div>
              {verificationMessage && <p className="text-xs text-emerald-600">{verificationMessage}</p>}
              {verificationError && <p className="text-xs text-red-600">{verificationError}</p>}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn-outline text-xs"
                  onClick={handleSendVerification}
                  disabled={verificationStatus === 'sending'}
                >
                  {verificationStatus === 'sending' ? 'Sending…' : 'Send Verification Code'}
                </button>
                {verificationStatus === 'code-sent' && verificationSecondsRemaining !== null && verificationSecondsRemaining > 0 && (
                  <span className="text-xs text-slate-500">Code expires in {verificationSecondsRemaining}s</span>
                )}
                {verificationStatus === 'verified' && <span className="text-xs text-emerald-600">Verified</span>}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="border rounded p-2 w-32 text-center tracking-widest uppercase"
                  placeholder="OTP"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                />
                <button
                  type="button"
                  className="btn-primary text-xs"
                  onClick={handleConfirmVerification}
                  disabled={verificationStatus !== 'code-sent'}
                >
                  {verificationStatus === 'verifying' ? 'Verifying…' : 'Confirm Code'}
                </button>
              </div>
            </div>
          </div>
        )}
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {previewBreakdown && previewBreakdown.subtotal < MIN_ORDER && (
          <p className="text-xs text-amber-600">Add THB {MIN_ORDER - previewBreakdown.subtotal} more to reach the minimum order.</p>
        )}
        {previewBreakdown && previewBreakdown.freeDeliveryThreshold && previewBreakdown.subtotal < previewBreakdown.freeDeliveryThreshold && deliveryMethod === 'delivery' && (
          <p className="text-xs text-emerald-600">Spend THB {previewBreakdown.freeDeliveryThreshold - previewBreakdown.subtotal} more for free delivery.</p>
        )}
        <input className="border rounded p-2 w-full" placeholder="Name" {...register('name')} />
        {errors.name && <p className="text-red-600 text-sm">Name is required</p>}
  <input className="border rounded p-2 w-full" placeholder="Phone" type="tel" {...register('phone')} />
  {errors.phone && <p className="text-red-600 text-sm">{errors.phone.message || 'Valid Thai phone is required'}</p>}
    <input
      className="border rounded p-2 w-full"
      placeholder={!user && guestMode ? 'Email (required for verification)' : 'Email (optional)'}
      type="email"
      required={!user && guestMode}
      {...register('email')}
    />
    {errors.email && <p className="text-red-600 text-sm">{String(errors.email.message || 'Please enter a valid email address')}</p>}
  <textarea className="border rounded p-2 w-full" placeholder={deliveryMethod === 'pickup' ? 'Address (optional for pickup)' : 'Address'} {...register('address')} />
  {errors.address && <p className="text-red-600 text-sm">{String(errors.address.message || 'Address is required for delivery')}</p>}
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
            <input type="radio" value="cod" {...register('paymentMethod')} /> {deliveryMethod === 'pickup' ? 'Cash' : 'Cash on Delivery (COD)'}
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
            {/* Test card hint removed for production */}
          </div>
        )}
        <div className="space-y-2" aria-live="polite">
          {effectiveBreakdown && (
            <div className="text-sm bg-slate-50 rounded p-3 space-y-1 border">
              <div className="flex justify-between"><span>Subtotal</span><span>THB {effectiveBreakdown.subtotal}</span></div>
              <div className="flex justify-between"><span>Delivery</span><span>THB {effectiveBreakdown.deliveryFee}</span></div>
              <div className="flex justify-between"><span>Tax</span><span>THB {effectiveBreakdown.tax}</span></div>
              {effectiveBreakdown.discount ? <div className="flex justify-between text-emerald-600"><span>Discount</span><span>- THB {effectiveBreakdown.discount}</span></div> : null}
              <div className="flex justify-between font-semibold border-t pt-1"><span>Total</span><span>THB {effectiveBreakdown.total}</span></div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button className="btn-primary" type="submit" disabled={creating || isCartEmpty}>
              {creating ? 'Placing order…' : 'Place order'}
            </button>
            <span className="text-sm text-gray-600">Total: THB {displayTotal}</span>
          </div>
        </div>
      </form>

      <div className="card p-4" aria-labelledby="payment-heading">
        <h2 id="payment-heading" className="text-lg font-semibold mb-2">Payment</h2>
        {breakdown?.expectedReadyAt && (
          <div className="text-xs text-gray-500 mb-3">Ready about {new Date(breakdown.expectedReadyAt).toLocaleTimeString()} {breakdown.expectedDeliveryAt ? `• ETA delivery ${new Date(breakdown.expectedDeliveryAt).toLocaleTimeString()}` : ''}</div>
        )}
        {paymentMethod === 'promptpay' && (
          qrImageUrl || qrPayload ? (
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
                onClick={() => navigator.clipboard.writeText(String(displayTotal))}
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
          )
        )}
        {paymentMethod !== 'promptpay' && !orderId && (
          <p className="text-sm text-gray-600">Select payment method and place order to continue.</p>
        )}
      </div>
    </section>
  );
}
