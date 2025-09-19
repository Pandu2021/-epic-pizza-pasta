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
  id: 'extra-cheese' | 'garlic-butter';
  name: string;
  price: number | { L: number; XL: number }; // Price can be a number or an object for size-dependent pricing
  icon: string;
};

// Define the extras based on the menu
const extras: Extra[] = [
  { id: 'extra-cheese', name: 'Extra Cheese', price: { L: 39, XL: 50 }, icon: '🧀' },
  { id: 'garlic-butter', name: 'Garlic Butter', price: 10, icon: '🧈' },
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

  const isPizza = useMemo(() => !!(item && (item.priceL || item.priceXL)), [item]);
  const [size, setSize] = useState<'L' | 'XL'>('L');
  const [selectedExtras, setSelectedExtras] = useState<Extra[]>([]);
  const [qty, setQty] = useState<number>(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const [notes, setNotes] = useState<string>('');

  // Flavor selection state
  const isSuperSampler = useMemo(() => item?.id === 'pizza-super-sampler', [item]);
  // singleFlavorId is used when not split; for 50/50 we use halfA/halfB; for sampler we use up to 4
  const [splitMode, setSplitMode] = useState<'single' | 'half' | 'sampler'>('single');
  const [halfA, setHalfA] = useState<string | null>(null);
  const [halfB, setHalfB] = useState<string | null>(null);
  const [samplerFlavors, setSamplerFlavors] = useState<string[]>([]);

  // Set default size when item is loaded and is a pizza; prefer L if available else XL
  useEffect(() => {
    if (!item) return;
    if (!isPizza) return;
    if (item.priceL != null) setSize('L'); else if (item.priceXL != null) setSize('XL');
    // Set split defaults
    if (item.id === 'pizza-super-sampler') {
      setSplitMode('sampler');
      setSize('XL'); // enforce XL
    } else {
      setSplitMode('single');
      setHalfA(item.id);
      setHalfB(null);
      setSamplerFlavors([]);
    }
  }, [item, isPizza]);

  const handleToggleExtra = (extra: Extra) => {
    setSelectedExtras((prev: Extra[]) =>
      prev.find((e) => e.id === extra.id)
        ? prev.filter((e) => e.id !== extra.id)
        : [...prev, extra]
    );
  };

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

  const basePrice = useMemo(() => {
    if (!item) return 0;
    if (!isPizza) return item.price ?? 0;
    if (isSuperSampler) {
      // Flat price XL only
      return item.priceXL ?? getPizzaPrice(item.id, 'XL');
    }
    if (splitMode === 'single') {
      return getPizzaPrice(halfA || item.id, size);
    }
    if (splitMode === 'half') {
      // 50/50: price = higher of the two flavors selected for the chosen size
      const a = getPizzaPrice(halfA || item.id, size);
      const b = getPizzaPrice(halfB || item.id, size);
      return Math.max(a, b);
    }
    return getPizzaPrice(item.id, size);
  }, [item, isPizza, isSuperSampler, splitMode, size, halfA, halfB, allPizzas]);

  const totalPrice = (basePrice + extrasPrice) * qty;

  const handleAddToCart = () => {
    if (!item) return;
    const variant = isPizza ? size : 'STD';
    const displayNameBase = t(item.name) + (isPizza ? ` (${size})` : '');
    const extrasString = selectedExtras.map(e => e.name).join(', ');
    // Build flavors label and options
    let flavorsLabel = '';
    let options: Record<string, unknown> | undefined = undefined;
    if (isPizza) {
      if (isSuperSampler) {
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
      name: `${displayNameBase}${flavorsLabel}${extrasString ? ` - With ${extrasString}` : ''}${notes ? ` | Notes: ${notes}` : ''}`,
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
        <h1 className="text-2xl font-bold">Product not found</h1>
        <Link className="text-brand-primary underline mt-2 inline-block" to="/menu">
          ← Back to menu
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
            <h3 className="text-lg font-semibold mb-3">Choose size</h3>
            <div className="flex gap-3">
              {item.priceL != null && (
                <motion.button
                  type="button"
                  animate={size === 'L' ? { scale: 1.05 } : { scale: 1 }}
                  className={`flex-1 text-center p-4 rounded-lg border-2 transition-colors ${size === 'L' ? 'border-brand-primary bg-brand-primary/10' : 'border-slate-300'}`}
                  onClick={() => setSize('L')}
                  disabled={isSuperSampler}
                >
                  <div className="text-xl font-bold">L</div>
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
                  <div className="text-xl font-bold">XL</div>
                  <div className="text-sm">฿ {(item.priceXL ?? 0).toFixed(0)}</div>
                </motion.button>
              )}
            </div>
          </div>
        )}

        {/* Flavor selection for pizzas */}
        {isPizza && !isSuperSampler && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">Choose flavors</h3>
            <div className="flex gap-2">
              <button
                type="button"
                className={`btn-outline ${splitMode === 'single' ? 'bg-slate-100' : ''}`}
                onClick={() => setSplitMode('single')}
              >
                Single Flavor
              </button>
              <button
                type="button"
                className={`btn-outline ${splitMode === 'half' ? 'bg-slate-100' : ''}`}
                onClick={() => setSplitMode('half')}
              >
                50/50 (Two Flavors)
              </button>
            </div>

            {splitMode === 'single' && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[item, ...allPizzas.filter((p) => p.id !== item.id && p.id !== 'pizza-super-sampler')].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`p-3 rounded border text-left ${halfA === p.id ? 'border-brand-primary bg-brand-primary/10' : 'border-slate-300'}`}
                    onClick={() => setHalfA(p.id)}
                  >
                    <div className="font-medium">{typeof p.name === 'object' ? t(p.name) : (p.name ?? '')}</div>
                    <div className="text-xs text-slate-500">฿ {(size === 'XL' ? (p.priceXL ?? 0) : (p.priceL ?? 0)).toFixed(0)}</div>
                  </button>
                ))}
              </div>
            )}

            {splitMode === 'half' && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <div className="text-sm text-slate-600">Half A</div>
                  {[item, ...allPizzas.filter((p) => p.id !== 'pizza-super-sampler')].map((p) => (
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
                  <div className="text-sm text-slate-600">Half B</div>
                  {[item, ...allPizzas.filter((p) => p.id !== 'pizza-super-sampler')].map((p) => (
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
            <p className="mt-2 text-xs text-slate-500">50/50 price follows the higher-priced half for the selected size.</p>
          </div>
        )}

        {/* Super Sampler (XL only) */}
        {isSuperSampler && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">Super Sampler — Choose up to 4 flavors (XL only)</h3>
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
            <p className="mt-2 text-xs text-slate-500">Every 2 slices can be a different flavor. Max 4 flavors.</p>
          </div>
        )}

        {/* Extras Options (Only for Pizzas) */}
        {isPizza && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">Add extras</h3>
            <div className="space-y-3">
              {extras.map(extra => (
                <motion.div
                  key={extra.id}
                  onClick={() => handleToggleExtra(extra)}
                  className="flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors"
                  animate={selectedExtras.find(e => e.id === extra.id) ? { borderColor: '#E94B3C', backgroundColor: '#FDF2F2' } : { borderColor: '#cbd5e1', backgroundColor: '#ffffff' }}
                >
                  <div className="text-3xl">{extra.icon}</div>
                  <div className="flex-grow">
                    <div className="font-medium">{extra.name}</div>
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
          <h3 className="text-lg font-semibold mb-2">Notes (allergies, remove toppings, etc.)</h3>
          <textarea
            className="w-full border rounded p-2"
            rows={3}
            placeholder="Any special requests?"
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
              <label htmlFor="qty" className="text-sm font-medium">Quantity</label>
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
              <div className="text-sm text-slate-500">Total Price</div>
              <div className="text-3xl font-bold">฿ {totalPrice.toFixed(0)}</div>
            </div>
          </div>

          <motion.button
            className={`btn w-full mt-4 text-lg py-3 ${addedToCart ? 'bg-emerald-500 hover:bg-emerald-600' : 'btn-primary'}`}
            onClick={handleAddToCart}
            disabled={
              addedToCart || !item ||
              (isPizza && splitMode === 'half' && (!halfA || !halfB)) ||
              (isSuperSampler && samplerFlavors.length === 0)
            }
            whileTap={{ scale: 0.95 }}
          >
            {addedToCart ? (
              <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center justify-center">
                <CheckIcon className="size-6 mr-2" /> Added to Cart!
              </motion.div>
            ) : (
              "Add to Cart"
            )}
          </motion.button>
        </div>
      </div>
    </section>
  );
}
