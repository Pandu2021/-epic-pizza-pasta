import { PhoneIcon, EnvelopeIcon, MapPinIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

const ADDRESS = '1, 15 Soi Nonthaburi, Bang Krasor, Nonthaburi 11000, Thailand';
const PHONE = '+66 95 569 7525';
const EMAIL = 'epicpizzaandpasta@gmail.com';

function getBangkokMinutesNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
  const [h, m] = parts.split(':').map(Number);
  return h * 60 + m;
}

function getBangkokWeekdayKey(): 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' {
  const longName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    weekday: 'long',
  }).format(new Date());
  const map: Record<string, ReturnType<typeof getBangkokWeekdayKey>> = {
    Sunday: 'sunday',
    Monday: 'monday',
    Tuesday: 'tuesday',
    Wednesday: 'wednesday',
    Thursday: 'thursday',
    Friday: 'friday',
    Saturday: 'saturday',
  };
  return map[longName] ?? 'sunday';
}

export default function ContactPage() {
  const { t } = useTranslation();
  const nowMin = getBangkokMinutesNow();
  const openMin = 12 * 60; // 12:00 PM
  const closeMin = 23 * 60; // 11:00 PM
  const isOpenNow = nowMin >= openMin && nowMin < closeMin;
  const weekdayKey = getBangkokWeekdayKey();
  const weekOrder: typeof weekdayKey[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];

  const lat = import.meta.env.VITE_MAP_LAT;
  const lng = import.meta.env.VITE_MAP_LNG;
  const hasCoords = lat && lng;
  const mapQuery = hasCoords ? `${lat},${lng}` : encodeURIComponent(ADDRESS);
  // Prefer coordinates when available for higher accuracy; use address fallback
  const mapEmbed = hasCoords
    ? `https://www.google.com/maps?q=${mapQuery}&z=17&hl=en&output=embed`
    : `https://www.google.com/maps?q=${mapQuery}&z=17&hl=en&output=embed`;
  const mapLink = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${mapQuery}`
    : `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-400 via-orange-400 to-yellow-400 text-slate-900">
        <div className="px-6 py-10 md:px-10 md:py-14">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">{t('get_in_touch')}</h1>
          <p className="mt-2 md:mt-3 text-slate-800/80 md:text-lg">{t('contact_subtitle')}</p>
        </div>
      </section>

      {/* Content grid */}
      <section className="grid gap-6 lg:grid-cols-3">
        {/* Left: Contact methods */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
    <h2 className="text-xl font-semibold">{t('contact')}</h2>
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              <a href={`tel:${PHONE.replace(/\s/g, '')}`} className="flex items-start gap-3 p-4 rounded-lg hover:bg-slate-50 transition">
                <PhoneIcon className="h-6 w-6 text-brand-primary" />
                <div>
                  <div className="text-sm text-slate-500">{t('phone')}</div>
                  <div className="font-medium">{PHONE}</div>
                </div>
              </a>
              <a href={`mailto:${EMAIL}`} className="flex items-start gap-3 p-4 rounded-lg hover:bg-slate-50 transition">
                <EnvelopeIcon className="h-6 w-6 text-brand-primary" />
                <div>
                  <div className="text-sm text-slate-500">{t('email')}</div>
                  <div className="font-medium">{EMAIL}</div>
                </div>
              </a>
              <a href={mapLink} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 p-4 rounded-lg hover:bg-slate-50 transition sm:col-span-2">
                <MapPinIcon className="h-6 w-6 text-brand-primary" />
                <div>
                  <div className="text-sm text-slate-500">{t('address')}</div>
                  <div className="font-medium">{ADDRESS}</div>
                </div>
              </a>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="aspect-video w-full">
              <iframe
                title="Epic Pizza & Pasta Location Map"
                src={mapEmbed}
                className="h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>

        {/* Right: Hours */}
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <ClockIcon className="h-6 w-6" /> {t('hours_bangkok')}
            </h2>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-slate-500">{t('today')} ({t(`days.${weekdayKey}`)})</div>
              <div className="flex items-center gap-2 font-medium">
                12:00 PM - 11:00 PM
                <span className={`chip border ${isOpenNow ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-700' : 'bg-rose-500/20 border-rose-400/30 text-rose-700'}`}>
                  {isOpenNow ? t('open') : t('closed')}
                </span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
              {weekOrder.map((d) => {
                const isToday = d === weekdayKey;
                return (
                  <>
                    <div key={`${d}-label`} className={isToday ? 'text-slate-900 font-medium' : 'text-slate-500'}>
                      {t(`days.${d}`)}
                    </div>
                    <div key={`${d}-hours`} className={isToday ? 'text-slate-900 font-medium' : undefined}>
                      12:00 PM - 11:00 PM
                    </div>
                  </>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
