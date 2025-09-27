import { useTranslation } from 'react-i18next';

export default function OrderHistoryPage() {
  const { t } = useTranslation();
  return (
    <section>
      <h1 className="text-2xl font-bold">{t('orders.title')}</h1>
      <p className="text-slate-600 mt-1">{t('orders.subtitle')}</p>
      {/* TODO: list and details */}
    </section>
  );
}
