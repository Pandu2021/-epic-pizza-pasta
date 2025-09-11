import { useCart } from '../store/cartStore';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

type Props = { open: boolean; onClose: () => void };

export default function CartDrawer({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { items, updateQty, removeItem, total } = useCart();
  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}>
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={`absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl transition-transform ${open ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-modal="true"
        aria-label={t('cart')}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('your_cart')}</h2>
          <button onClick={onClose} className="btn-outline">{t('close')}</button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto h-[calc(100%-160px)]">
          {items.length === 0 ? (
            <div className="text-center text-slate-500 py-12">{t('cart_empty')}</div>
          ) : (
            items.map((it) => (
              <div key={it.id} className="flex gap-3">
                {it.image && <img src={it.image} alt={it.name} className="w-16 h-16 object-cover rounded" />}
                <div className="flex-1">
                  <div className="font-medium">{it.name}</div>
                  <div className="text-sm text-slate-500">฿ {it.price.toFixed(0)}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <button className="btn-outline px-2" onClick={() => updateQty(it.id, it.qty - 1)}>-</button>
                    <div className="w-8 text-center">{it.qty}</div>
                    <button className="btn-outline px-2" onClick={() => updateQty(it.id, it.qty + 1)}>+</button>
                    <button className="btn-outline ml-auto" onClick={() => removeItem(it.id)}>{t('remove')}</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="p-4 border-t">
          <div className="flex items-center justify-between font-semibold">
            <div>{t('total')}</div>
            <div>฿ {total().toFixed(0)}</div>
          </div>
          <Link to="/checkout" className="btn-primary w-full mt-3 inline-flex justify-center" onClick={onClose}>
            {t('checkout')}
          </Link>
        </div>
      </aside>
    </div>
  );
}
