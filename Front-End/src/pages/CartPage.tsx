import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useCart } from '../store/cartStore';
import { Link, useNavigate } from 'react-router-dom';

export default function CartPage() {
  const { t } = useTranslation();
  const focusRef = useRef<HTMLHeadingElement | null>(null);
  const { items, updateQty, removeItem, clear, total, count } = useCart();
  const navigate = useNavigate();
  const subtotal = total();
  const itemCount = count();

  useEffect(() => { if (focusRef.current) focusRef.current.focus(); }, []);

  return (
    <section aria-labelledby="cart-heading" className="max-w-4xl mx-auto">
      <h1
        id="cart-heading"
        ref={focusRef}
        tabIndex={-1}
        className="text-2xl font-bold mb-6 focus:outline-none tracking-tight"
      >
        {t('cart_page.title')}
      </h1>

      {items.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center">
          <p className="text-slate-600">{t('cart_page.empty')}</p>
          <div className="mt-4 flex justify-center gap-3">
            <Link to="/menu" className="btn-primary">{t('cart_page.browse_menu')}</Link>
            <Link to="/profile" className="btn-outline">{t('cart_page.back_to_profile')}</Link>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-8">
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-sm align-middle">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-2 font-medium">{t('cart_page.table.item')}</th>
                  <th className="py-2 px-2 font-medium w-28 text-center">{t('cart_page.table.price')}</th>
                  <th className="py-2 px-2 font-medium w-32 text-center">{t('cart_page.table.qty')}</th>
                  <th className="py-2 px-2 font-medium w-28 text-right">{t('cart_page.table.total')}</th>
                  <th className="py-2 pl-2 w-10" aria-label="Remove" />
                </tr>
              </thead>
              <tbody>
                {items.map(it => {
                  const lineTotal = it.qty * it.price;
                  return (
                    <tr key={it.id} className="border-b last:border-b-0 border-slate-100">
                      <td className="py-3 pr-2">
                        <div className="flex items-center gap-3">
                          {it.image && <img src={it.image} alt={it.name} className="h-14 w-20 object-cover rounded" />}
                          <div>
                            <div className="font-medium text-slate-800">{it.name}</div>
                            {it.options && Object.keys(it.options).length > 0 && (
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {Object.entries(it.options).map(([k,v]) => `${k}: ${v}`).join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center text-slate-600">THB {it.price.toFixed(0)}</td>
                      <td className="py-3 px-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateQty(it.id, it.qty - 1)}
                            className="h-7 w-7 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-semibold disabled:opacity-40"
                            disabled={it.qty <= 1}
                            aria-label={t('cart_page.aria.dec_qty', { name: it.name })}
                          >-
                          </button>
                          <input
                            type="number"
                            onClick={() => navigate('/checkout/start')}
                            onChange={(e) => {
                              const val = Math.max(1, Number(e.target.value) || 1);
                              updateQty(it.id, val);
                            }}
                            className="w-12 text-center border border-slate-300 rounded h-7 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            aria-label={t('cart_page.aria.qty_of', { name: it.name })}
                            min={1}
                          />
                          <button
                            type="button"
                            onClick={() => updateQty(it.id, it.qty + 1)}
                            className="h-7 w-7 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-semibold"
                            aria-label={t('cart_page.aria.inc_qty', { name: it.name })}
                          >+
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right font-medium text-slate-800">THB {lineTotal.toFixed(0)}</td>
                      <td className="py-3 pl-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeItem(it.id)}
                          className="text-slate-400 hover:text-red-500 transition"
                          aria-label={t('cart_page.aria.remove', { name: it.name })}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="md:w-2/3 space-y-4">
              <button
                type="button"
                onClick={() => clear()}
                className="btn-outline text-sm"
              >
                {t('cart_page.clear')}
              </button>
            </div>
            <div className="md:w-1/3 ml-auto rounded-lg border border-slate-200 p-5 bg-white shadow-sm space-y-4">
              <h2 className="font-semibold text-slate-700">{t('cart_page.summary')}</h2>
              <div className="flex justify-between text-sm text-slate-600">
                <span>{t('cart_page.items')}</span>
                <span>{itemCount}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-600">
                <span>{t('cart_page.subtotal')}</span>
                <span className="font-medium text-slate-800">THB {subtotal.toFixed(0)}</span>
              </div>
              <p className="text-[11px] text-slate-500">{t('cart_page.delivery_vat_hint')}</p>
              <button
                type="button"
                className="btn-primary w-full"
                onClick={() => navigate('/checkout/start')}
              >
                {t('cart_page.proceed_checkout')}
              </button>
              <Link to="/menu" className="btn-outline w-full text-center">{t('cart_page.continue_shopping')}</Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
