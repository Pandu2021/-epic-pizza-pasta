import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ProductCard from '../components/ProductCard';
import { useNavigate } from 'react-router-dom';
import CategoryChips from '../components/CategoryChips';
import { useCart } from '../store/cartStore';
import { api } from '../services/api';
import { menuImg } from '../utils/assets';

export default function MenuPage() {
  const { i18n } = useTranslation();
  const t = (s: { en: string; th: string }) => (i18n.language === 'th' ? s.th : s.en);
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { search } = useLocation();
  const query = useMemo(() => (new URLSearchParams(search).get('q') ?? '').trim(), [search]);
  
  // If navigated with a hash (e.g. /menu#cat-pizza), scroll to that section on mount
  useEffect(() => {
    // fetch menu from API
    (async () => {
      try {
        if (query) {
          try {
            const { data } = await api.get('/menu/search', { params: { q: query } });
            if (Array.isArray(data) && data.length > 0) {
              setMenuItems(data);
              return;
            }
          } catch {}
        }
        const { data } = await api.get('/menu');
        setMenuItems(Array.isArray(data) ? data : []);
      } catch (e) {
        setError('Failed to load menu');
      } finally {
        setLoading(false);
      }
    })();

    const hash = window.location.hash;
    if (hash) {
      const id = hash.replace('#', '');
      const el = document.getElementById(id);
      // slight delay to ensure layout rendered
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    }
  }, [query]);

  const groups: Array<{
    key: 'pizza' | 'pasta' | 'appetizer' | 'salad' | 'dessert';
    title: string;
  }> = [
    { key: 'pizza', title: 'category.pizza' },
    { key: 'pasta', title: 'category.pasta' },
    { key: 'appetizer', title: 'category.appetizer' },
    { key: 'salad', title: 'category.salad' },
    { key: 'dessert', title: 'category.dessert' }
  ];

  // Build a normalized searchable text for each item and filter by tokens
  const filtered = useMemo(() => {
    if (!query) return menuItems;
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    return menuItems.filter((m) => {
      const name = typeof m.name === 'object' ? (i18n.language === 'th' ? m.name.th : m.name.en) : (m.name ?? '');
      const desc = typeof m.description === 'object' ? (i18n.language === 'th' ? m.description.th : m.description.en) : (m.description ?? '');
      const hay = [m.id, m.category, name, desc].join(' ').toLowerCase();
      return tokens.every((tk) => hay.includes(tk));
    });
  }, [menuItems, query, i18n.language]);

  // Highlight helper
  const highlight = (text: string) => {
    if (!query) return text;
    const tokens = query
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (tokens.length === 0) return text;
    const re = new RegExp(`(${tokens.join('|')})`, 'ig');
    return (
      <>
        {text.split(re).map((part, idx) =>
          re.test(part) ? (
            <mark key={idx} className="bg-yellow-200/70 rounded px-0.5">{part}</mark>
          ) : (
            <span key={idx}>{part}</span>
          )
        )}
      </>
    );
  };

  return (
    <section className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-400 via-orange-400 to-yellow-400 text-slate-900">
        <div className="px-6 py-10 md:px-10 md:py-14">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">{i18n.t('our_menu')}</h1>
          <p className="mt-2 md:mt-3 text-slate-800/80 md:text-lg">{i18n.t('menu_hero_subtitle')}</p>
        </div>
      </div>

      <h2 className="text-xl font-semibold">{i18n.t('browse_categories')}</h2>
      <CategoryChips
        categories={groups.map((g) => i18n.t(g.title))}
        onSelect={(label) => {
          const map: Record<string, string> = {
            [i18n.t('category.pizza')]: 'pizza',
            [i18n.t('category.pasta')]: 'pasta',
            [i18n.t('category.appetizer')]: 'appetizer',
            [i18n.t('category.salad')]: 'salad',
            [i18n.t('category.dessert')]: 'dessert',
          };
          const id = `cat-${map[label] ?? label.toLowerCase()}`;
          const el = document.getElementById(id);
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      />

      {loading && <div className="text-slate-500">Loading menu...</div>}
      {error && <div className="text-red-600">{error}</div>}
  {!loading && !error && query && (
        <div className="space-y-3">
          <h3 className="text-lg md:text-xl font-semibold">Search results for “{query}”</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((it) => {
              const requiresOptions = !!(it.priceL || it.priceXL); // pizzas with size
              return (
                <ProductCard
                  key={it.id}
                  name={highlight(typeof it.name === 'object' ? t(it.name) : (it.name || '')) as any}
                  price={it.price ?? it.basePrice ?? (it.priceL ?? 0)}
                  imageUrl={menuImg(((Array.isArray(it.images) && it.images[0]) || it.image))}
                  description={highlight(typeof it.description === 'object' ? t(it.description) : (it.description ?? '')) as any}
                  label={it.labels?.[0]}
                  to={`/menu/${it.id}`}
                  variant={requiresOptions ? 'options' : 'quick-add'}
                  onAdd={requiresOptions ? undefined : () =>
                    addItem({ id: it.id, name: typeof it.name === 'object' ? t(it.name) : (it.name || ''), price: it.price ?? it.basePrice ?? (it.priceL ?? 0), image: menuImg(((Array.isArray(it.images) && it.images[0]) || it.image)) })}
                />
              );
            })}
            {filtered.length === 0 && <div className="text-slate-500">No results</div>}
          </div>
        </div>
      )}

      {!loading && !error && !query && groups.map((g) => {
  const items = filtered.filter((m) => m.category === g.key);
        return (
          <div key={g.key} id={`cat-${g.key}`} className="space-y-3 scroll-mt-24">
            <h3 className="text-lg md:text-xl font-semibold">{i18n.t(g.title)}</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map((it) => {
                const requiresOptions = !!(it.priceL || it.priceXL);
                return (
                  <ProductCard
                    key={it.id}
                    name={query ? (highlight(typeof it.name === 'object' ? t(it.name) : (it.name || '')) as any) : (typeof it.name === 'object' ? t(it.name) : (it.name || ''))}
                    price={it.price ?? it.basePrice ?? (it.priceL ?? 0)}
                    imageUrl={menuImg(((Array.isArray(it.images) && it.images[0]) || it.image))}
                    description={query ? (highlight(typeof it.description === 'object' ? t(it.description) : (it.description ?? '')) as any) : (typeof it.description === 'object' ? t(it.description) : (it.description ?? ''))}
                    label={it.labels?.[0]}
                    to={`/menu/${it.id}`}
                    variant={requiresOptions ? 'options' : 'quick-add'}
                    onAdd={requiresOptions ? undefined : () =>
                      addItem({ id: it.id, name: typeof it.name === 'object' ? t(it.name) : (it.name || ''), price: it.price ?? it.basePrice ?? (it.priceL ?? 0), image: menuImg(((Array.isArray(it.images) && it.images[0]) || it.image)) })}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
