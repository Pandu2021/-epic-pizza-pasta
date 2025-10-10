import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { isAxiosError } from 'axios';
import {
  EnvelopeIcon,
  ChevronDownIcon,
  PhoneIcon,
  ShieldCheckIcon,
  LifebuoyIcon,
  CheckCircleIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import { endpoints } from '../services/api';

const RESEND_COOLDOWN_SECONDS = 45;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function maskEmail(email: string) {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const domainParts = domain.split('.');
  const first = domainParts.shift() ?? '';
  const maskSegment = (segment: string) => {
    if (!segment) return segment;
    if (segment.length <= 2) return `${segment[0] ?? ''}***`;
    return `${segment[0]}***${segment[segment.length - 1]}`;
  };
  const maskedUser = maskSegment(user);
  const maskedDomain = [maskSegment(first), ...domainParts].filter(Boolean).join('.');
  return `${maskedUser}@${maskedDomain}`;
}

type ManualStatus = 'idle' | 'sending' | 'success' | 'error';

type Channel = 'email' | 'whatsapp' | 'line';
type DeliveryStatus = 'queued' | 'unavailable' | 'error' | 'unknown';
type DeliveryAttempt = {
  method: Channel;
  status: DeliveryStatus;
  hint: string;
  target?: string | null;
  devNote?: string;
};
type DeliverySummary = { primary: Channel; attempts: DeliveryAttempt[] };

const METHOD_TITLES: Record<Channel, string> = {
  email: 'Check your email',
  whatsapp: 'Check WhatsApp',
  line: 'Check the LINE chat',
};

const METHOD_LABELS: Record<Channel, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  line: 'LINE',
};

const METHOD_ICONS: Record<Channel, typeof EnvelopeIcon> = {
  email: EnvelopeIcon,
  whatsapp: PhoneIcon,
  line: ChatBubbleLeftRightIcon,
};

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  queued: 'Sent',
  unavailable: 'Unavailable',
  error: 'Needs attention',
  unknown: 'Pending',
};

const STATUS_STYLES: Record<DeliveryStatus, string> = {
  queued: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  unavailable: 'bg-amber-100 text-amber-700 border border-amber-200',
  error: 'bg-rose-100 text-rose-700 border border-rose-200',
  unknown: 'bg-slate-100 text-slate-600 border border-slate-200',
};

function getFriendlyErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError(error)) {
    const raw = error.response?.data?.message;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed || trimmed.toLowerCase() === 'internal server error') {
        return fallback;
      }
      return trimmed;
    }
  }
  return fallback;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'form' | 'sent'>('form');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [expiresInMinutes, setExpiresInMinutes] = useState<number | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualStatus, setManualStatus] = useState<ManualStatus>('idle');
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualForm, setManualForm] = useState({ name: '', phone: '', details: '' });
  const [notice, setNotice] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<DeliverySummary | null>(null);

  const getChannelFallbackNotice = (method: Channel) => {
    switch (method) {
      case 'whatsapp':
        return 'We couldn’t confirm the WhatsApp delivery, but if your account is eligible you’ll still hear from us soon. You can also use the help options below.';
      case 'line':
        return 'We couldn’t confirm the LINE delivery, but if your account is linked you’ll receive a message shortly. You can also use the help options below.';
      default:
        return 'We couldn’t confirm the email delivery, but if the address is registered you’ll still hear from us soon. You can also use the help options below.';
    }
  };

  const getDeliveryIssueNotice = (attempt?: DeliveryAttempt | null) => {
    if (!attempt) return null;
    if (attempt.status === 'queued' || attempt.status === 'unknown') return null;
    if (attempt.method === 'whatsapp') {
      return 'WhatsApp delivery is unavailable right now. We’ll follow up by email shortly—use the help options below if you still don’t see anything.';
    }
    if (attempt.method === 'line') {
      return 'LINE delivery didn’t go through yet. We’re also emailing you, and our support team can help manually if needed.';
    }
    return null;
  };

  useEffect(() => {
    if (!resendCooldown) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const steps = useMemo(() => {
    const attempts = delivery?.attempts?.length
      ? delivery.attempts
      : [
          {
            method: 'email' as Channel,
            status: 'unknown' as DeliveryStatus,
            hint: `We’ll email ${maskedEmail || 'your email address'} with reset instructions.`,
            target: maskedEmail,
          },
        ];

    const attemptSteps = attempts.map((attempt) => {
      const Icon = METHOD_ICONS[attempt.method];
      const devNote = import.meta.env.DEV && attempt.devNote ? attempt.devNote : null;
      const parts: string[] = [];
      if (attempt.target) {
        parts.push(`Target: ${attempt.target}.`);
      }
      if (attempt.hint) {
        parts.push(attempt.hint);
      }
      if (attempt.method === 'email') {
        parts.push(`If it doesn’t arrive, search your inbox (and spam) for “Epic Pizza & Pasta”.`);
        parts.push(`The link expires in ${expiresInMinutes ?? 30} minutes.`);
      } else {
        parts.push('If you don’t see it, try opening the app on your registered device. We also send a backup email whenever possible.');
      }
      if (attempt.status === 'unavailable') {
        parts.push('This channel isn’t active right now—we’ll follow up using another method.');
      } else if (attempt.status === 'error') {
        parts.push('Delivery had an issue. Please reach our team if nothing arrives soon.');
      }

      return {
        title: METHOD_TITLES[attempt.method],
        description: parts.filter(Boolean).join(' '),
        icon: Icon,
        status: attempt.status,
        statusLabel: STATUS_LABELS[attempt.status],
        devNote,
      };
    });

    return [
      ...attemptSteps,
      {
        title: 'Still need help?',
        description: 'Resend the link or reach our team using the manual assistance options below.',
        icon: LifebuoyIcon,
      },
    ];
  }, [delivery, expiresInMinutes, maskedEmail]);

  const primaryMethod = (delivery?.primary ?? 'email') as Channel;
  const primaryAttempt = delivery?.attempts?.[0] ?? null;
  const primaryTarget = primaryMethod === 'email' ? maskedEmail : primaryAttempt?.target ?? null;
  const resendLabel = resendCooldown > 0
    ? `Resend available in ${resendCooldown}s`
    : 'Resend email';
  const deliveryIssueNotice = getDeliveryIssueNotice(primaryAttempt);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeEmail(email);
    setError(null);
    setLoading(true);
    try {
      const { data } = await endpoints.forgotPassword({ email: normalized, channel: 'email' });
      setSubmittedEmail(normalized);
      setMaskedEmail(data?.email || maskEmail(normalized));
      setExpiresInMinutes(data?.expiresInMinutes ?? 30);
      setDelivery((data?.delivery as DeliverySummary | null) ?? null);
      setView('sent');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      const issueNotice = getDeliveryIssueNotice((data?.delivery as DeliverySummary | null)?.attempts?.[0]);
      setNotice(issueNotice);
    } catch (err) {
      const fallbackMasked = maskEmail(normalized);
      setSubmittedEmail(normalized);
      setMaskedEmail(fallbackMasked);
      setExpiresInMinutes(expiresInMinutes ?? 30);
      setView('sent');
      setDelivery(null);
      setNotice(getChannelFallbackNotice('email'));
      setError(null);
      console.warn('[forgot-password] fallback flow triggered', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!submittedEmail || resendCooldown > 0) return;
    setResendLoading(true);
    setError(null);
    try {
      const { data } = await endpoints.forgotPassword({ email: submittedEmail, channel: 'email' });
      setMaskedEmail(data?.email || maskEmail(submittedEmail));
      setExpiresInMinutes(data?.expiresInMinutes ?? expiresInMinutes ?? 30);
      setDelivery((data?.delivery as DeliverySummary | null) ?? null);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      const issueNotice = getDeliveryIssueNotice((data?.delivery as DeliverySummary | null)?.attempts?.[0]);
      setNotice(issueNotice);
    } catch (err) {
      setMaskedEmail(maskEmail(submittedEmail));
      setDelivery(null);
      setNotice(getChannelFallbackNotice('email'));
      setError(null);
      console.warn('[forgot-password] resend fallback flow triggered', err);
    } finally {
      setResendLoading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = submittedEmail || normalizeEmail(email);
    if (!targetEmail) {
      setManualError('Please provide your account email first.');
      return;
    }
    if (!manualForm.details.trim()) {
      setManualError('Let us know how we can help so the team can act quickly.');
      return;
    }
    setManualError(null);
    setManualStatus('sending');
    try {
      const message = [
        'Password reset assistance requested from forgot-password page.',
        `Account email: ${targetEmail}`,
        manualForm.phone ? `Phone: ${manualForm.phone}` : null,
        '',
        manualForm.details.trim(),
      ]
        .filter(Boolean)
        .join('\n');
      await endpoints.contact({
        name: manualForm.name || 'Password reset help',
        email: targetEmail,
        message,
      });
      setManualStatus('success');
    } catch (err) {
      setManualStatus('error');
      setManualError(getFriendlyErrorMessage(err, 'Unable to reach the team right now.'));
    }
  };

  const resetState = () => {
    setView('form');
    setManualOpen(false);
    setManualStatus('idle');
    setManualError(null);
    setExpiresInMinutes(null);
    setMaskedEmail('');
    setSubmittedEmail('');
    setResendCooldown(0);
    setNotice(null);
    setDelivery(null);
  };

  const manualSuccessMessage = manualStatus === 'success' ? 'Thanks! Our team will reach out using the details you shared.' : null;

  return (
    <section className="max-w-3xl mx-auto py-10">
      <div className="card border border-slate-200 shadow-sm">
        {view === 'form' ? (
          <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_280px]">
            <div>
              <header>
                <p className="text-sm uppercase tracking-wide text-primary/80 font-semibold">Forgot password</p>
                <h1 className="mt-2 text-3xl font-bold text-slate-900">Let’s get you back in</h1>
                <p className="mt-3 text-slate-600">Enter the email you use for Epic Pizza & Pasta and we’ll send you a secure reset link right away. The link expires quickly to keep your account safe.</p>
              </header>
              <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email address</label>
                  <input
                    id="email"
                    type="email"
                    className="input w-full mt-1"
                    placeholder="your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <p className="text-sm text-slate-600">
                  We’ll send a secure reset link to your inbox. For security, the link expires quickly, so please check your email right away.
                </p>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button type="submit" className="btn-primary w-full md:w-auto" disabled={loading}>
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>

              <div className="mt-8 space-y-4 text-sm text-slate-600">
                <div className="flex items-start gap-3">
                  <EnvelopeIcon className="h-5 w-5 text-primary mt-0.5" />
                  <p>We’ll send you an email with a link to create a new password. For security, the link expires after {expiresInMinutes ?? 30} minutes.</p>
                </div>
                <div className="flex items-start gap-3">
                  <ShieldCheckIcon className="h-5 w-5 text-primary mt-0.5" />
                  <p>Not sure which email you used? Try the one you receive order receipts on.</p>
                </div>
              </div>
            </div>

            <aside className="rounded-xl bg-slate-50 p-6 border border-slate-200/70 space-y-4">
              <h2 className="text-base font-semibold text-slate-800">Need a different way?</h2>
              <p className="text-sm text-slate-600">If you can’t access your email, our team can help you reset manually.</p>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <PhoneIcon className="h-5 w-5 text-primary" />
                  <div>
                    <div className="font-medium text-slate-800">Call us</div>
                    <a className="text-primary" href="tel:+66955697525">+66 95 569 7525</a>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <ChatBubbleLeftRightIcon className="h-5 w-5 text-primary" />
                  <div>
                    <div className="font-medium text-slate-800">LINE chat</div>
                    <a href="https://page.line.me/epicpizzapasta" className="text-primary" target="_blank" rel="noopener noreferrer">@epicpizzapasta</a>
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  Prefer email? Fill the form after you request a reset and we’ll flag it for review.
                </div>
              </div>
            </aside>
          </div>
        ) : (
          <div className="space-y-8">
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircleIcon className="h-8 w-8 text-emerald-500" />
                  Reset link on its way
                </h1>
                <p className="mt-2 text-slate-600">
                  We’re delivering instructions via <span className="font-semibold text-slate-800">{METHOD_LABELS[primaryMethod]}</span>
                  {primaryTarget ? (
                    <>
                      {' '}to <span className="font-semibold text-slate-800">{primaryTarget}</span>
                    </>
                  ) : null}
                  . The reset link expires in {expiresInMinutes ?? 30} minutes.
                </p>
              </div>
              <button type="button" className="btn-outline" onClick={resetState}>
                Try a different email
              </button>
            </header>

            {(notice || deliveryIssueNotice) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {deliveryIssueNotice || notice}
              </div>
            )}

            <ol className="space-y-4">
              {steps.map((step, index) => {
                const statusKey = 'status' in step ? step.status : undefined;
                const statusLabel = 'statusLabel' in step ? step.statusLabel : undefined;
                const devNote = 'devNote' in step ? step.devNote : undefined;
                return (
                  <li key={step.title} className="flex items-start gap-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">{index + 1}</span>
                    <div>
                      <div className="flex flex-col gap-2 text-base font-semibold text-slate-800 sm:flex-row sm:items-center sm:justify-between">
                        <span className="inline-flex items-center gap-2">
                          <step.icon className="h-5 w-5 text-primary" />
                          {step.title}
                        </span>
                        {statusKey && statusLabel ? (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[statusKey]}`}>
                            {statusLabel}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{step.description}</p>
                      {devNote ? (
                        <p className="mt-2 text-xs font-mono text-slate-400 break-words">{devNote}</p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn-primary"
                onClick={handleResend}
                disabled={resendCooldown > 0 || resendLoading}
              >
                {resendLoading ? 'Resending…' : resendLabel}
              </button>
              <Link to="/reset-password" className="btn-outline">
                Have a token already?
              </Link>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="rounded-xl border border-slate-200 bg-white">
              <button
                type="button"
                className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold text-slate-800"
                onClick={() => {
                  setManualOpen((prev) => !prev);
                  setManualError(null);
                  setManualStatus('idle');
                }}
              >
                <span className="flex items-center gap-2">
                  <LifebuoyIcon className="h-5 w-5 text-primary" />
                  Need help without email access?
                </span>
                <ChevronDownIcon className={`h-5 w-5 text-slate-400 transition-transform ${manualOpen ? 'rotate-180' : ''}`} />
              </button>
              {manualOpen && (
                <div className="border-t border-slate-200 px-5 py-6 space-y-5 text-sm">
                  <p className="text-slate-600">
                    Send a quick note to our support team. We’ll verify your details and reset the password manually.
                  </p>
                  <form className="space-y-4" onSubmit={handleManualSubmit}>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="block text-xs font-medium text-slate-600">Full name</span>
                        <input
                          type="text"
                          className="input mt-1 w-full"
                          value={manualForm.name}
                          onChange={(e) => setManualForm((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder="Optional"
                        />
                      </label>
                      <label className="block">
                        <span className="block text-xs font-medium text-slate-600">Phone number</span>
                        <input
                          type="tel"
                          className="input mt-1 w-full"
                          value={manualForm.phone}
                          onChange={(e) => setManualForm((prev) => ({ ...prev, phone: e.target.value }))}
                          placeholder="So we can reach you"
                        />
                      </label>
                    </div>
                    <label className="block">
                      <span className="block text-xs font-medium text-slate-600">Tell us what happened</span>
                      <textarea
                        className="input mt-1 w-full h-28"
                        value={manualForm.details}
                        onChange={(e) => setManualForm((prev) => ({ ...prev, details: e.target.value }))}
                        placeholder="Example: I no longer have access to this inbox, my last order number was..."
                        required
                      />
                    </label>
                    {manualError && <p className="text-red-600 text-sm">{manualError}</p>}
                    {manualSuccessMessage && <p className="text-emerald-600 text-sm">{manualSuccessMessage}</p>}
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="submit" className="btn-outline" disabled={manualStatus === 'sending'}>
                        {manualStatus === 'sending' ? 'Sending…' : 'Notify support'}
                      </button>
                      <a href="mailto:epicpizzaandpasta@gmail.com" className="text-sm text-primary underline">
                        Email us directly
                      </a>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
