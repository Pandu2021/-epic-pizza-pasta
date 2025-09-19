import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const HOURS = {
  sun: '12:00 PM - 11:00 PM',
  mon: '12:00 PM - 11:00 PM',
  tue: '12:00 PM - 11:00 PM',
  wed: '12:00 PM - 11:00 PM',
  thu: '12:00 PM - 11:00 PM',
  fri: '12:00 PM - 11:00 PM',
  sat: '12:00 PM - 11:00 PM',
} as const;

function getBangkokDay(): keyof typeof HOURS {
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'Asia/Bangkok',
  });
  const day = formatter.format(new Date()).toLowerCase();
  // Map like "sun", "mon", etc.
  return (day.slice(0, 3) as keyof typeof HOURS) || 'sun';
}

export default function Footer() {
  const { t } = useTranslation();
  const todayKey = getBangkokDay();
  const todayHours = HOURS[todayKey];
  // Brand logo from assets
  const logoUrl = new URL('../assets/images/logo/logo.png', import.meta.url).href;
  const getBangkokMinutesNow = () => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Bangkok',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
    const [h, m] = parts.split(':').map(Number);
    return h * 60 + m;
  };
  const nowMin = getBangkokMinutesNow();
  const openMin = 12 * 60; // 12:00 PM
  const closeMin = 23 * 60; // 11:00 PM
  const isOpenNow = nowMin >= openMin && nowMin < closeMin;
  return (
    <footer className="mt-10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
      <div className="container px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3">
              <img
                src={logoUrl}
                alt="Epic Pizza & Pasta"
                className="h-12 w-12 rounded-xl object-contain bg-white/5"
                loading="lazy"
              />
              <div className="sr-only">Epic Pizza & Pasta</div>
            </div>
            <div className="mt-3 text-xl font-bold">Epic Pizza & Pasta</div>

            <div className="mt-5 space-y-2 text-sm text-slate-300">
              <div>
                <a href="tel:+66955697525" className="hover:underline">+66 95 569 7525</a>
              </div>
              <div>
                <a href="mailto:epicpizzaandpasta@gmail.com" className="hover:underline">epicpizzaandpasta@gmail.com</a>
              </div>
              <address className="not-italic">
                1, 15 Soi Nonthaburi, Bang Krasor, Nonthaburi 11000, Thailand
              </address>
            </div>

            <div className="mt-6 flex items-center gap-4">
              <a
                href="https://www.instagram.com/epicpizzaandpasta/#"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition"
              >
                {/* Instagram icon */}
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm0 2a3 3 0 00-3 3v10a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H7zm5 3a5 5 0 110 10 5 5 0 010-10zm0 2.2a2.8 2.8 0 100 5.6 2.8 2.8 0 000-5.6zM18 6.5a1 1 0 110 2 1 1 0 010-2z" />
                </svg>
              </a>
              <a
                href="https://www.facebook.com/epicpizzapasta"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition"
              >
                {/* Facebook icon */}
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M22 12a10 10 0 10-11.6 9.9v-7h-2.2V12h2.2V9.8c0-2.2 1.3-3.4 3.3-3.4.96 0 1.96.17 1.96.17v2.15h-1.1c-1.08 0-1.42.67-1.42 1.36V12h2.42l-.39 2.9h-2.03v7A10 10 0 0022 12z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <div className="text-sm uppercase tracking-wider text-slate-400">{t('reach_out')}</div>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link to="/" className="btn-outline text-slate-100 border-white/20 hover:bg-white/10">{t('home')}</Link>
              <Link to="/menu" className="btn-outline text-slate-100 border-white/20 hover:bg-white/10">{t('menu')}</Link>
              <a href="mailto:epicpizzaandpasta@gmail.com" className="btn-primary bg-rose-500 hover:bg-rose-600 focus:ring-rose-500">{t('contact')}</a>
            </div>
          </div>

          {/* Hours */}
          <div>
            <div className="text-sm uppercase tracking-wider text-slate-400">{t('hours_bangkok')}</div>
            <div className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
              <div className="text-slate-300">{t('today')}</div>
              <div className="text-slate-100 font-medium flex items-center gap-2">
                {todayHours} ICT (UTC+7)
                <span
                  className={`chip border ${
                    isOpenNow
                      ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300'
                      : 'bg-rose-500/20 border-rose-400/30 text-rose-300'
                  }`}
                >
                  {isOpenNow ? t('open') : t('closed')}
                </span>
              </div>

              <div className="text-slate-300">{t('sun_to_sat')}</div>
              <div className="text-slate-100">12:00 PM - 11:00 PM</div>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-xs text-slate-400 text-center">
          <div>© 2025 Epic Pizza & Pasta — {t('all_rights_reserved')}</div>
          <div className="opacity-80 mt-2">{t('made_with_love')}</div>
        </div>
      </div>
    </footer>
  );
}
