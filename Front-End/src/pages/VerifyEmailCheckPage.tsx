import { useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

type LocationState = {
  email?: string;
  verification?: {
    emailSent?: boolean;
    expiresAt?: string | null;
  } | null;
};

function maskEmail(email: string) {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const maskSegment = (segment: string) => {
    if (!segment) return segment;
    if (segment.length <= 2) return `${segment[0] ?? ''}***`;
    return `${segment[0]}***${segment[segment.length - 1]}`;
  };
  const domainParts = domain.split('.');
  const domainName = domainParts.shift() ?? '';
  const maskedUser = maskSegment(user);
  const maskedDomain = [maskSegment(domainName), ...domainParts].filter(Boolean).join('.');
  return `${maskedUser}@${maskedDomain}`;
}

export default function VerifyEmailCheckPage() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const state = (location.state as LocationState | undefined) ?? {};

  const email = state.email?.trim();
  const verification = state.verification ?? undefined;
  const emailSent = verification?.emailSent;
  const expiresAtRaw = verification?.expiresAt ?? null;
  const expiresLabel = useMemo(() => {
    if (!expiresAtRaw) return null;
    const dt = new Date(expiresAtRaw);
    if (Number.isNaN(dt.getTime())) return null;
    try {
      return new Intl.DateTimeFormat(i18n.language, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(dt);
    } catch {
      return dt.toLocaleString();
    }
  }, [expiresAtRaw, i18n.language]);

  const maskedEmail = useMemo(() => (email ? maskEmail(email) : null), [email]);

  return (
    <section className="max-w-xl mx-auto py-16 px-4">
      <div className="bg-white shadow-lg rounded-xl border border-slate-200 px-6 py-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <span className="text-2xl" aria-hidden>✉️</span>
        </div>
        <h1 className="mt-6 text-3xl font-semibold text-slate-900">{t('verify_email_check.almost_there')}</h1>
        <p className="mt-3 text-base text-slate-600">
          {maskedEmail
            ? t('verify_email_check.subtitle_with_email', { email: maskedEmail })
            : t('verify_email_check.subtitle_generic')}
        </p>
        {emailSent === false && (
          <p className="mt-4 text-sm text-amber-600" role="status">
            {t('verify_email_check.email_not_sent')}
          </p>
        )}
        {expiresLabel && (
          <p className="mt-2 text-sm text-slate-500">
            {t('verify_email_check.expires_hint', { datetime: expiresLabel })}
          </p>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link to="/login" className="btn-primary sm:w-auto">
            {t('verify_email_check.cta_login')}
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {t('verify_email_check.cta_home')}
          </Link>
        </div>
        <p className="mt-6 text-sm text-slate-500">{t('verify_email_check.spam_hint')}</p>
        <p className="mt-2 text-sm text-slate-500">{t('verify_email_check.resend_hint')}</p>
      </div>
    </section>
  );
}
