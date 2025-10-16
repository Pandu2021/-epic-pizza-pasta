import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function PaymentFailedPage() {
  const { t } = useTranslation();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const orderId = params.get('orderId') || undefined;
  const message = params.get('message') || t('payment_failed.message_fallback');
  const guestFlow = (params.get('guest') || params.get('mode') || '').toLowerCase() === 'guest';
  const retryHref = guestFlow ? '/checkout?guest=1' : '/checkout/start';
  return (
    <section className="py-10 max-w-xl mx-auto text-center">
      <h1 className="text-2xl font-bold mb-2">{t('payment_failed.title')}</h1>
      <p className="text-slate-700 mb-4">{message}</p>
      {orderId && <p className="text-sm text-gray-600">{t('payment_failed.order_id')} <span className="font-mono">{orderId}</span></p>}
      <div className="mt-6 flex justify-center gap-3">
        <Link className="btn-outline" to={retryHref}>{t('payment_failed.back_to_checkout')}</Link>
        <Link className="btn-primary" to="/menu">{t('payment_failed.continue_shopping')}</Link>
      </div>
    </section>
  );
}