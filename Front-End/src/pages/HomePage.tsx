import CategoryChips from '../components/CategoryChips';
import Carousel from '../components/Carousel';
import { ShoppingCartIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { menuImg } from '../utils/assets';
import { useCart } from '../store/cartStore';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const tt = (s: { en: string; th: string }) => (i18n.language === 'th' ? s.th : s.en);
  const { addItem } = useCart();
  const navigate = useNavigate();

  const [featured, setFeatured] = useState<any[]>([]);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/menu');
        const arr = Array.isArray(data) ? data : [];
        const pick = (cat: string) => arr.find((m: any) => m.category === cat);
        setFeatured([pick('pizza'), pick('dessert'), pick('pasta'), pick('appetizer')].filter(Boolean));
      } catch {
        setFeatured([]);
      }
    })();
  }, []);

  // Local hero image from assets for consistent display; fallback to margherita
  const heroUrl = new URL('../assets/images/menu/pizza-margherita.jpg', import.meta.url).href;

  const priceOf = (item: any) => item.basePrice ?? item.price ?? item.priceL ?? item.priceXL ?? 0;

  return (
    <div className="space-y-10">
      {/* Full-screen hero with background image */}
      <section className="relative w-full min-h-[70vh] md:min-h-[80vh] rounded-2xl overflow-hidden">
        <img src={heroUrl} alt="Hero Pizza" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/30" />
        <div className="relative z-10 h-full flex items-center">
          <div className="container px-6 py-12 md:py-20 text-white max-w-3xl mx-auto text-center">
            <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.1] drop-shadow-md">
              Fresh, Hot, and
              {" "}
              <span className="bg-gradient-to-r from-rose-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent">Epic</span>.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-white/85 leading-relaxed drop-shadow-sm">
              {t('hero_subtitle')}
            </p>
            <div className="mt-10 md:mt-12 flex w-full justify-center">
              <a href="/menu" className="btn-primary text-center px-6 py-3 text-base md:text-lg">{t('order_now')}</a>
            </div>
          </div>
        </div>
      </section>

      <section id="categories" className="space-y-3">
        <h2 className="text-xl font-semibold">{t('popular_categories')}</h2>
        <CategoryChips
          categories={[t('category.pizza'), t('category.pasta'), t('category.appetizer'), t('category.salad'), t('category.dessert')]}
          onSelect={(label) => {
            const map: Record<string, string> = {
              [t('category.pizza')]: 'pizza',
              [t('category.pasta')]: 'pasta',
              [t('category.appetizer')]: 'appetizer',
              [t('category.salad')]: 'salad',
              [t('category.dessert')]: 'dessert',
            };
            const target = `cat-${map[label] ?? label.toLowerCase()}`;
            navigate(`/menu#${target}`);
          }}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{t('menu')}</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((it) => (
            <div
              key={it.id}
              className="card overflow-hidden flex flex-col transition-shadow duration-300 hover:shadow-xl cursor-pointer"
              onClick={() => navigate(`/menu/${it.id}`)}
            >
              <img src={menuImg((it.images && it.images[0]) || it.image)} alt={typeof it.name === 'object' ? tt(it.name) : (it.name || '')} className="aspect-video w-full object-cover" />
              <div className="p-4 flex-1 flex flex-col">
                <div className="text-sm uppercase tracking-wide text-slate-500">{it.category}</div>
                <h3 className="mt-1 font-semibold text-lg">{typeof it.name === 'object' ? tt(it.name) : (it.name || '')}</h3>
                <p className="mt-2 text-sm text-slate-600 line-clamp-4">
                  {typeof it.description === 'object' ? tt(it.description) : (it.description || '')}
                </p>
                <div className="mt-3 font-semibold">฿ {priceOf(it).toFixed(0)}</div>
                <button
                  className={`btn w-full mt-4 transition-colors duration-300 ${added[String(it.id)] ? 'bg-emerald-500 hover:bg-emerald-600' : 'btn-primary'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    const requiresOptions = !!(it.priceL || it.priceXL);
                    if (requiresOptions) {
                      navigate(`/menu/${it.id}`);
                      return;
                    }
                    addItem({ id: it.id, name: typeof it.name === 'object' ? tt(it.name) : (it.name || ''), price: priceOf(it), image: menuImg((it.images && it.images[0]) || it.image) });
                    const key = String(it.id);
                    setAdded((prev) => ({ ...prev, [key]: true }));
                    setTimeout(() => setAdded((prev) => ({ ...prev, [key]: false })), 2000);
                  }}
                  disabled={!!added[String(it.id)] && !((it.priceL || it.priceXL))}
                >
                  { (it.priceL || it.priceXL) ? (
                    <> {t('choose_options', 'Choose Options')} </>
                  ) : added[String(it.id)] ? (
                    <>
                      <CheckIcon className="size-5 mr-2" /> {t('added_to_cart', 'Added!')}
                    </>
                  ) : (
                    <>
                      <ShoppingCartIcon className="size-5 mr-2" /> {t('add_to_cart')}
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Carousel: below menu and above footer */}
      <section className="space-y-4">
        <Carousel
          className="mt-4"
          slides={(() => {
            const items = (t('carousel.slides', { returnObjects: true }) as any[]) ?? [];
            const toImg = (file: string) =>
              new URL(`../assets/images/menu/${file}`, import.meta.url).href;
            return items.map((it) => ({
              title: it.title,
              description: it.description,
              image: toImg(it.image),
              alt: it.title,
            }));
          })()}
        />
      </section>
    </div>
  );
}
