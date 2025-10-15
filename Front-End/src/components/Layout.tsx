import { ReactNode, useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCartIcon, MagnifyingGlassIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import LanguageSwitcher from './LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import CartDrawer from './CartDrawer';
import Footer from './Footer';
import ScrollTopButton from './ScrollTopButton';
import { useCart } from '../store/cartStore';

type Props = { children: ReactNode };

export default function Layout({ children }: Props) {
  const { t } = useTranslation();
  const { count } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const navigate = useNavigate();
  const { search, pathname } = useLocation();
  const [term, setTerm] = useState('');

  // Sync input with ?q= from URL when route changes
  useEffect(() => {
    const q = new URLSearchParams(search).get('q') ?? '';
    setTerm(q);
  }, [search]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = term.trim();
    navigate(q ? `/menu?q=${encodeURIComponent(q)}` : '/menu');
  };

  // Debounce navigate for live search while typing
  const isMenuList = pathname === '/menu';
  const isMenuDetail = pathname.startsWith('/menu/') && pathname !== '/menu';

  useEffect(() => {
    const handle = setTimeout(() => {
      const q = term.trim();
      if (isMenuList) {
        navigate(q ? `/menu?q=${encodeURIComponent(q)}` : '/menu', { replace: true });
        return;
      }
      if (q && !isMenuDetail) {
        navigate(`/menu?q=${encodeURIComponent(q)}`);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [term, isMenuList, isMenuDetail]);
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 sticky top-0 z-20">
  <div className="container px-4 py-3 flex items-center gap-3">
          {/* Brand logo moved from Footer to Header */}
          <Link to="/" className="shrink-0 inline-flex items-center" aria-label="Epic Pizza & Pasta">
            <img
              src={new URL('../assets/images/logo/logo.png', import.meta.url).href}
              alt="Epic Pizza & Pasta"
              className="h-12 w-12 rounded-lg object-contain"
              width={48}
              height={48}
              loading="eager"
            />
          </Link>
          <form className="relative flex-1 hidden md:block" onSubmit={onSubmit} role="search" aria-label="Site">
            <MagnifyingGlassIcon className="size-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full border rounded-md pl-10 pr-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
              placeholder={t('search_placeholder')}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              aria-label={t('search_placeholder') as string}
            />
          </form>
          <nav className="ml-auto flex items-center gap-4">
            {/* Order: Menu, Contact, Language, Cart, Profile */}
            <NavLink to="/menu" className={({ isActive }) => (isActive ? 'font-semibold' : '')}>{t('menu')}</NavLink>
            <NavLink to="/contact" className={({ isActive }) => (isActive ? 'font-semibold' : '')}>{t('contact')}</NavLink>
            <LanguageSwitcher />
            <button type="button" className="relative" aria-label="Cart" onClick={() => setCartOpen(true)}>
              <ShoppingCartIcon className="size-6" />
              {count() > 0 && (
                <span className="absolute -top-1 -right-1 bg-brand-primary text-white text-[10px] rounded-full px-1.5">
                  {count()}
                </span>
              )}
            </button>
            <Link to="/profile" aria-label="Profile" className="text-slate-700 hover:text-slate-900">
              <UserCircleIcon className="size-7" />
            </Link>
          </nav>
        </div>
        {/* Mobile search bar */}
        <div className="container px-4 pb-3 md:hidden">
          <form className="relative" onSubmit={onSubmit} role="search" aria-label="Site">
            <MagnifyingGlassIcon className="size-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full border rounded-md pl-10 pr-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
              placeholder={t('search_placeholder')}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              aria-label={t('search_placeholder') as string}
            />
          </form>
        </div>
      </header>
      <motion.main
        key={search} // Re-trigger animation on search change
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="container px-4 py-6 flex-1"
      >
        {children}
      </motion.main>
      <Footer />
  <ScrollTopButton />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
