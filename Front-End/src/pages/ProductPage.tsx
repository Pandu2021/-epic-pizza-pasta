import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '../store/cartStore';
import { api } from '../services/api';
import { menuImg } from '../utils/assets';
import { motion } from 'framer-motion';
import { CheckIcon, PlusIcon, MinusIcon } from '@heroicons/react/24/solid';

// Define the type for an extra item
type Extra = {
  id:
    | 'extra-cheese'
    | 'garlic-butter'
    | 'pasta-garlic-chicken'
    | 'pasta-shrimp-scampi-3'
    | 'pasta-crispy-bacon';
  name: string; // i18n key under product.extras.*
  price: number | { L: number; XL: number }; // Price can be a number or an object for size-dependent pricing
  icon: string;
};

// Define extras for pizzas and pasta separately
const pizzaExtras: Extra[] = [
  { id: 'extra-cheese', name: 'product.extras.extra-cheese', price: { L: 39, XL: 50 }, icon: '🧀' },
  { id: 'garlic-butter', name: 'product.extras.garlic-butter', price: 10, icon: '🧈' },
];

const pastaExtras: Extra[] = [
  { id: 'pasta-garlic-chicken', name: 'product.extras.pasta-garlic-chicken', price: 45, icon: '🍗' },
  { id: 'pasta-shrimp-scampi-3', name: 'product.extras.pasta-shrimp-scampi-3', price: 79, icon: '🦐' },
  { id: 'pasta-crispy-bacon', name: 'product.extras.pasta-crispy-bacon', price: 49, icon: '🥓' },
];

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { i18n, t: translate } = useTranslation();
  // Helper to translate bilingual fields
  const t = (s: { en: string; th: string }) => (i18n.language === 'th' ? s.th : s.en);
  const { addItem } = useCart();

  const [item, setItem] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [allPizzas, setAllPizzas] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      if (!id) return;
      setLoading(true);
      try {
        const { data } = await api.get(`/menu/${id}`);
        setItem(data ?? null);
        // Preload all pizzas for flavor selection (client-side)
        try {
          const list = await api.get('/menu', { params: { category: 'pizza' } });
          setAllPizzas(Array.isArray(list.data) ? list.data : []);
        } catch {}
      } catch {
        setItem(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // A pizza item is identified by having size-based prices (priceL / priceXL)
  const isPizza = useMemo(() => !!(item && (item.priceL || item.priceXL)), [item]);
  const isPasta = useMemo(() => item?.category === 'pasta', [item]);
  // Normalize base price for non-pizza (DB uses basePrice; JSON fallback may have price)
  const normalizedBasePrice = useMemo(() => {
    if (!item) return 0;
    if (isPizza) return 0; // pizzas handled separately with priceL/priceXL logic below
    return item.basePrice ?? item.price ?? 0; // production DB returns basePrice, JSON fallback has price
  }, [item, isPizza]);
  const [size, setSize] = useState<'L' | 'XL'>('XL');
  const [selectedExtras, setSelectedExtras] = useState<Extra[]>([]);
  const [qty, setQty] = useState<number>(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const [notes, setNotes] = useState<string>('');

  // Flavor selection state
  // singleFlavorId is used when not split; for 50/50 we use halfA/halfB; for sampler we use up to 4
  const [splitMode, setSplitMode] = useState<'single' | 'half' | 'sampler'>('single');
  const [halfA, setHalfA] = useState<string | null>(null);
  const [halfB, setHalfB] = useState<string | null>(null);
  const [samplerFlavors, setSamplerFlavors] = useState<string[]>([]);

  // Build unique pizza options (exclude Super Sampler), ensure current item is included once at the top
  const pizzaOptions = useMemo(() => {
    const arr = (allPizzas || []).filter((p) => p.id !== 'pizza-super-sampler');
    const map = new Map<string, any>();
    if (item && item.category === 'pizza') map.set(item.id, item);
    for (const p of arr) {
      if (!map.has(p.id)) map.set(p.id, p);
    }
    return Array.from(map.values());
  }, [allPizzas, item]);

  // Set default size when item is loaded and is a pizza; default to XL for clarity
  useEffect(() => {
    if (!item) return;
    if (!isPizza) return;
    if (item.priceXL != null) setSize('XL'); else if (item.priceL != null) setSize('L');
    // Set split defaults
    setSplitMode('single');
    setHalfA(item.id);
    setHalfB(null);
    setSamplerFlavors([]);
  }, [item, isPizza]);

  const handleToggleExtra = (extra: Extra) => {
    setSelectedExtras((prev: Extra[]) =>
      prev.find((e) => e.id === extra.id)
        ? prev.filter((e) => e.id !== extra.id)
        : [...prev, extra]
    );
  };

  const availableExtras: Extra[] = isPizza ? pizzaExtras : (isPasta ? pastaExtras : []);

  const extrasPrice = useMemo(() => {
    return selectedExtras.reduce((acc, extra) => {
      if (extra.id === 'extra-cheese' && typeof extra.price === 'object') {
        return acc + (extra.price[size] || extra.price['L']);
      }
      return acc + (extra.price as number);
    }, 0);
  }, [selectedExtras, size]);

  // Helper: get pizza price by id and size
  const getPizzaPrice = (pizzaId: string | null | undefined, sz: 'L' | 'XL'): number => {
    if (!pizzaId) return 0;
    const p = (pizzaId === item?.id ? item : allPizzas.find((m) => m.id === pizzaId));
    if (!p) return 0;
    return sz === 'XL' ? (p.priceXL ?? 0) : (p.priceL ?? 0);
  };

  const SAMPLER_PRICE_XL = 550; // XL-only sampler flat price
  const basePrice = useMemo(() => {
    if (!item) return 0;
    if (!isPizza) return normalizedBasePrice;
    if (splitMode === 'single') {
      return getPizzaPrice(halfA || item.id, size);
    }
    if (splitMode === 'half') {
      // 50/50: price = higher of the two flavors selected for the chosen size
      const a = getPizzaPrice(halfA || item.id, size);
      const b = getPizzaPrice(halfB || item.id, size);
      return Math.max(a, b);
    }
    if (splitMode === 'sampler') {
      // Sampler is XL only at a flat price
      return SAMPLER_PRICE_XL;
    }
    return getPizzaPrice(item.id, size);
  }, [item, isPizza, splitMode, size, halfA, halfB, allPizzas, normalizedBasePrice]);

  const totalPrice = (basePrice + extrasPrice) * qty;

  const handleAddToCart = () => {
    if (!item) return;
  const variant = isPizza ? size : 'STD';
  const displayNameBase = t(item.name) + (isPizza ? ` (${size})` : '');
  const extrasString = selectedExtras.map(e => translate(e.name)).join(', ');
    // Build flavors label and options
    let flavorsLabel = '';
    let options: Record<string, unknown> | undefined = undefined;
    if (isPizza) {
      if (splitMode === 'sampler') {
        const names = samplerFlavors.map((fid) => {
          const p = fid === item.id ? item : allPizzas.find((m) => m.id === fid);
          const nm = p ? (typeof p.name === 'object' ? t(p.name) : (p.name ?? '')) : fid;
          return nm;
        });
        flavorsLabel = names.length ? ` [Sampler: ${names.join(' | ')}]` : '';
        options = {
          type: 'sampler',
          size: 'XL',
          flavors: samplerFlavors,
          extras: selectedExtras.map((e) => e.id),
          notes: notes || undefined
        };
      } else if (splitMode === 'half') {
        const nameA = (() => {
          const p = halfA === item.id ? item : allPizzas.find((m) => m.id === halfA);
          return p ? (typeof p.name === 'object' ? t(p.name) : (p.name ?? '')) : '';
        })();
        const nameB = (() => {
          const p = halfB === item.id ? item : allPizzas.find((m) => m.id === halfB);
          return p ? (typeof p.name === 'object' ? t(p.name) : (p.name ?? '')) : '';
        })();
        flavorsLabel = ` [Half: ${nameA || t(item.name)} + ${nameB || t(item.name)}]`;
        options = {
          type: 'half-half',
          size,
          halfA: halfA || item.id,
          halfB: halfB || item.id,
          priceRule: 'max-of-two',
          extras: selectedExtras.map((e) => e.id),
          notes: notes || undefined
        };
      } else {
        // single flavor (default)
        options = {
          type: 'single',
          size,
          flavor: halfA || item.id,
          extras: selectedExtras.map((e) => e.id),
          notes: notes || undefined
        };
      }
    }
    
    addItem({
      id: `${item.id}:${variant}:${splitMode}:${selectedExtras.map(e => e.id).join('-')}:${(options as any)?.flavors || (options as any)?.flavor || ''}`,
      name: `${displayNameBase}${flavorsLabel}${extrasString ? ` - ${translate('product.with')} ${extrasString}` : ''}${notes ? ` | ${translate('product.notes_prefix')}: ${notes}` : ''}`,
      price: basePrice + extrasPrice,
      image: menuImg((item.images && item.images[0]) || item.image),
      options
    }, qty);

    setAddedToCart(true);
    setTimeout(() => {
      setAddedToCart(false);
    }, 2500);
  };

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl bg-slate-200 animate-pulse aspect-square"></div>
        <div className="space-y-4">
          <div className="h-8 w-3/4 bg-slate-200 animate-pulse rounded"></div>
          <div className="h-4 w-full bg-slate-200 animate-pulse rounded"></div>
          <div className="h-4 w-5/6 bg-slate-200 animate-pulse rounded"></div>
          <div className="h-12 w-1/2 bg-slate-200 animate-pulse rounded mt-6"></div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <section className="text-center py-10">
        <h1 className="text-2xl font-bold">{translate('product.product_not_found')}</h1>
        <Link className="text-brand-primary underline mt-2 inline-block" to="/menu">
          {translate('product.back_to_menu')}
        </Link>
      </section>
    );
  }

  return (
    <section className="grid gap-8 md:grid-cols-2">
      {/* Image */}
      <div className="relative">
        <motion.div layout className="rounded-xl overflow-hidden bg-slate-100 aspect-square">
          <img src={menuImg((item.images && item.images[0]) || item.image)} alt={t(item.name)} className="w-full h-full object-cover" />
        </motion.div>
      </div>

      {/* Details */}
      <div className="flex flex-col">
        <nav className="text-sm text-slate-500 mb-3">
          <Link to="/menu" className="hover:underline">{translate('menu')}</Link>
          <span className="mx-2">/</span>
          <span>{t(item.name)}</span>
        </nav>

        <h1 className="text-4xl font-extrabold tracking-tight">{t(item.name)}</h1>
        <p className="mt-3 text-slate-600 text-lg">{t(item.description)}</p>

        {/* Size Options (Only for Pizzas) */}
        {isPizza && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">{translate('product.choose_size')}</h3>
            <div className="flex gap-3">
              {item.priceL != null && (
                <motion.button
                  type="button"
                  animate={size === 'L' ? { scale: 1.05 } : { scale: 1 }}
                  className={`flex-1 text-center p-4 rounded-lg border-2 transition-colors ${size === 'L' ? 'border-brand-primary bg-brand-primary/10' : 'border-slate-300'}`}
                  onClick={() => setSize('L')}
                  disabled={splitMode === 'sampler'}
                >
                  <div className="text-xl font-bold">L - 10"</div>
                  <div className="text-sm">฿ {item.priceL.toFixed(0)}</div>
                </motion.button>
              )}
              {item.priceXL != null && (
                <motion.button
                  type="button"
                  animate={size === 'XL' ? { scale: 1.05 } : { scale: 1 }}
                  className={`flex-1 text-center p-4 rounded-lg border-2 transition-colors ${size === 'XL' ? 'border-brand-primary bg-brand-primary/10' : 'border-slate-300'}`}
                  onClick={() => setSize('XL')}
                >
                  <div className="text-xl font-bold">XL - 15"</div>
                  <div className="text-sm">฿ {(item.priceXL ?? 0).toFixed(0)}</div>
                </motion.button>
              )}
            </div>
          </div>
        )}

        {/* Flavor selection for pizzas */}
        {isPizza && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">{translate('product.choose_flavors')}</h3>
            <div className="flex gap-2">
              <button
                type="button"
                className={`btn-outline ${splitMode === 'single' ? 'bg-slate-100' : ''}`}
                onClick={() => {
                  setSplitMode('single');
                  // Single flavor must follow the current product
                  setHalfA(item.id);
                }}
              >
                {translate('product.single_flavor')}
              </button>
              <button
                type="button"
                className={`btn-outline ${splitMode === 'half' ? 'bg-slate-100' : ''}`}
                onClick={() => setSplitMode('half')}
              >
                {translate('product.half_half')}
              </button>
              <button
                type="button"
                className={`btn-outline ${splitMode === 'sampler' ? 'bg-slate-100' : ''}`}
                onClick={() => {
                  setSplitMode('sampler');
                  setSize('XL'); // enforce XL for sampler
                }}
              >
                {translate('product.super_sampler_title')}
              </button>
            </div>

            {splitMode === 'single' && (
              <div className="mt-3 p-3 rounded border border-slate-300 bg-white">
                <div className="text-sm text-slate-600">{translate('product.flavor')}</div>
                <div className="font-medium">{t(item.name)}</div>
                <div className="text-xs text-slate-500 mt-1">{translate('product.fixed_to_selected')}</div>
              </div>
            )}

            {splitMode === 'half' && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <div className="text-sm text-slate-600">{translate('product.half_a')}</div>
                  {pizzaOptions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`p-3 rounded border text-left w-full ${halfA === p.id ? 'border-brand-primary bg-brand-primary/10' : 'border-slate-300'}`}
                      onClick={() => setHalfA(p.id)}
                    >
                      <div className="font-medium">{typeof p.name === 'object' ? t(p.name) : (p.name ?? '')}</div>
                      <div className="text-xs text-slate-500">฿ {(size === 'XL' ? (p.priceXL ?? 0) : (p.priceL ?? 0)).toFixed(0)}</div>
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-600">{translate('product.half_b')}</div>
                  {pizzaOptions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`p-3 rounded border text-left w-full ${halfB === p.id ? 'border-brand-primary bg-brand-primary/10' : 'border-slate-300'}`}
                      onClick={() => setHalfB(p.id)}
                    >
                      <div className="font-medium">{typeof p.name === 'object' ? t(p.name) : (p.name ?? '')}</div>
                      <div className="text-xs text-slate-500">฿ {(size === 'XL' ? (p.priceXL ?? 0) : (p.priceL ?? 0)).toFixed(0)}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-2 text-xs text-slate-500">{translate('product.half_rule_hint')}</p>
          </div>
        )}

        {/* Sampler (XL only) */}
        {isPizza && splitMode === 'sampler' && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">{translate('product.super_sampler_title')}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {allPizzas
                .filter((p) => p.id !== 'pizza-super-sampler')
                .map((p) => {
                  const selected = samplerFlavors.includes(p.id);
                  const canAdd = selected || samplerFlavors.length < 4;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`p-3 rounded border text-left ${selected ? 'border-brand-primary bg-brand-primary/10' : 'border-slate-300'} ${!canAdd ? 'opacity-60 cursor-not-allowed' : ''}`}
                      onClick={() => {
                        setSamplerFlavors((prev) =>
                          prev.includes(p.id) ? prev.filter((x) => x !== p.id) : (prev.length < 4 ? [...prev, p.id] : prev)
                        );
                      }}
                      disabled={!canAdd && !selected}
                    >
                      <div className="font-medium">{typeof p.name === 'object' ? t(p.name) : (p.name ?? '')}</div>
                    </button>
                  );
                })}
            </div>
            <p className="mt-2 text-xs text-slate-500">{translate('product.super_sampler_hint')}</p>
          </div>
        )}

        {/* Extras Options (Pizzas and Pasta) */}
        {(isPizza || isPasta) && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">{translate('product.add_extras')}</h3>
            <div className="space-y-3">
              {availableExtras.map(extra => (
                <motion.div
                  key={extra.id}
                  onClick={() => handleToggleExtra(extra)}
                  className="flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors"
                  animate={selectedExtras.find(e => e.id === extra.id) ? { borderColor: '#E94B3C', backgroundColor: '#FDF2F2' } : { borderColor: '#cbd5e1', backgroundColor: '#ffffff' }}
                >
                  <div className="text-3xl">{extra.icon}</div>
                  <div className="flex-grow">
                    <div className="font-medium">{translate(extra.name)}</div>
                    <div className="text-sm text-slate-500">
                      {extra.id === 'extra-cheese' && typeof extra.price === 'object' ? `+฿${extra.price[size].toFixed(2)}` : `+฿${(extra.price as number).toFixed(2)}`}
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedExtras.find(e => e.id === extra.id) ? 'border-brand-primary bg-brand-primary' : 'border-slate-300'}`}>
                    {selectedExtras.find(e => e.id === extra.id) && <CheckIcon className="w-4 h-4 text-white" />}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">{translate('product.notes_label')}</h3>
          <textarea
            className="w-full border rounded p-2"
            rows={3}
            placeholder={translate('product.notes_placeholder')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex-grow"></div>

        {/* Qty & CTA */}
        <div className="mt-8 pt-6 border-t">
          <div className="flex justify-between items-center">
            {/* Quantity Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="qty" className="text-sm font-medium">{translate('product.quantity')}</label>
              <div className="flex items-center rounded-lg border border-slate-300">
                <button type="button" aria-label="Decrease quantity" className="px-3 py-2 text-slate-500 hover:bg-slate-100 rounded-l-md" onClick={() => setQty((q) => Math.max(1, q - 1))}><MinusIcon className="h-4 w-4"/></button>
                <input
                  id="qty"
                  aria-label="Quantity"
                  inputMode="numeric"
                  className="w-12 text-center font-bold text-lg outline-none"
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                />
                <button type="button" aria-label="Increase quantity" className="px-3 py-2 text-slate-500 hover:bg-slate-100 rounded-r-md" onClick={() => setQty((q) => q + 1)}><PlusIcon className="h-4 w-4"/></button>
              </div>
            </div>
            {/* Price */}
            <div className="text-right">
              <div className="text-sm text-slate-500">{translate('product.total_price')}</div>
              <div className="text-3xl font-bold">฿ {totalPrice.toFixed(0)}</div>
            </div>
          </div>

          <motion.button
            className={`btn w-full mt-4 text-lg py-3 ${addedToCart ? 'bg-emerald-500 hover:bg-emerald-600' : 'btn-primary'}`}
            onClick={handleAddToCart}
            disabled={
              addedToCart || !item ||
              (isPizza && splitMode === 'half' && (!halfA || !halfB)) ||
              (isPizza && splitMode === 'sampler' && samplerFlavors.length === 0)
            }
            whileTap={{ scale: 0.95 }}
          >
            {addedToCart ? (
              <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center justify-center">
                <CheckIcon className="size-6 mr-2" /> {translate('product.cta_added')}
              </motion.div>
            ) : (
              translate('product.cta_add')
            )}
          </motion.button>
        </div>
      </div>
    </section>
  );
}
