import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/authStore';
import { purgeExpiredGuestSessions } from '../utils/guestSession';

export default function CheckoutEntryPage() {
  const navigate = useNavigate();
  const { user, loading, fetchMe } = useAuth();

  useEffect(() => {
    purgeExpiredGuestSessions();
  }, []);

  useEffect(() => {
    if (!user) {
      (async () => {
        try {
          await fetchMe();
        } catch {
          // ignore background auth fetch errors
        }
      })();
    }
  }, [fetchMe, user]);

  useEffect(() => {
    if (!loading && user) {
      navigate('/checkout', { replace: true });
    }
  }, [loading, user, navigate]);

  const handleLogin = () => {
    const next = encodeURIComponent('/checkout');
    navigate(`/login?next=${next}`);
  };

  const handleGuest = () => {
    navigate('/checkout?guest=1');
  };

  if (loading && !user) {
    return (
      <section className="py-12 text-center" aria-busy="true" aria-live="polite">
        <h1 className="text-2xl font-semibold text-slate-700">Preparing checkout…</h1>
        <p className="mt-2 text-sm text-slate-500">Checking your account status.</p>
      </section>
    );
  }

  return (
    <section className="max-w-xl mx-auto py-12" aria-labelledby="checkout-entry-heading">
      <h1 id="checkout-entry-heading" className="text-3xl font-bold text-center text-slate-800">How would you like to checkout?</h1>
      <p className="mt-4 text-sm text-center text-slate-600">
        Login to sync your history across devices, or continue as a privacy-first guest with a secure, time-limited order token.
      </p>
      <div className="mt-8 grid gap-4">
        <button
          type="button"
          className="btn-primary py-3 text-base"
          onClick={handleLogin}
        >
          Login &amp; Checkout
        </button>
        <button
          type="button"
          className="btn-outline py-3 text-base"
          onClick={handleGuest}
        >
          Continue as Guest
        </button>
      </div>
      <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p>Your guest session lasts for two hours and stores only what’s needed to fulfill the order. No account or password required.</p>
      </div>
    </section>
  );
}
