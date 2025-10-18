import { Buffer } from 'node:buffer';
type MessageResult = { ok: boolean; error?: string; responseStatus?: number };

type WhatsAppParams = { to: string; body: string; mediaUrl?: string };
type LineParams = { to: string; body: string };

const IS_TWILIO_MOCK = String(process.env.TWILIO_MOCK || '')
  .trim()
  .toLowerCase() === 'true' || process.env.NODE_ENV === 'test';

function normalizeE164Phone(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const sanitized = trimmed.replace(/[^+\d]/g, '');
  if (!sanitized) return null;
  if (sanitized.startsWith('+')) {
    return sanitized;
  }
  let defaultCountry = (process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '').trim();
  if (!defaultCountry && IS_TWILIO_MOCK) {
    const fallback = (process.env.TWILIO_MOCK_COUNTRY_CODE || '+66').trim();
    const digits = fallback.startsWith('+') ? fallback.slice(1) : fallback.replace(/[^\d]/g, '');
    if (digits) {
      defaultCountry = `+${digits}`;
    }
  }
  if (!defaultCountry || !defaultCountry.startsWith('+')) {
    return null;
  }
  const withoutLeadingZero = sanitized.replace(/^0+/, '');
  if (!withoutLeadingZero) {
    return null;
  }
  return `${defaultCountry}${withoutLeadingZero}`;
}

function ensureWhatsAppAddress(value: string): string {
  return value.startsWith('whatsapp:') ? value : `whatsapp:${value}`;
}

function mockWhatsAppResult(reason: string, to: string, body: string): MessageResult {
  if (!IS_TWILIO_MOCK) {
    return { ok: false, error: reason };
  }
  const snippet = body.length > 140 ? `${body.slice(0, 137)}...` : body;
  console.info('[messaging] Twilio mock send', { to, reason, body: snippet });
  return { ok: true, responseStatus: 200 };
}

export async function sendWhatsAppMessage({ to, body, mediaUrl }: WhatsAppParams): Promise<MessageResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    return mockWhatsAppResult('WhatsApp messaging not configured', to, body);
  }

  const normalizedTo = normalizeE164Phone(to);
  const normalizedFrom = normalizeE164Phone(from) || from.trim();

  if (!normalizedTo) {
    return mockWhatsAppResult('Invalid WhatsApp recipient number', to, body);
  }
  if (!normalizedFrom) {
    return mockWhatsAppResult('Invalid WhatsApp sender number', to, body);
  }

  const params = new URLSearchParams();
  params.set('To', ensureWhatsAppAddress(normalizedTo));
  params.set('From', ensureWhatsAppAddress(normalizedFrom));
  params.set('Body', body);
  if (mediaUrl) {
    params.set('MediaUrl', mediaUrl);
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: text || res.statusText, responseStatus: res.status };
    }

    return { ok: true, responseStatus: res.status };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Unknown WhatsApp error' };
  }
}

export async function sendLineMessage({ to, body }: LineParams): Promise<MessageResult> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    return { ok: false, error: 'LINE messaging not configured' };
  }
  if (!to || !to.trim()) {
    return { ok: false, error: 'Missing LINE recipient identifier' };
  }

  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: to.trim(),
        messages: [
          {
            type: 'text',
            text: body,
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: text || res.statusText, responseStatus: res.status };
    }

    return { ok: true, responseStatus: res.status };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Unknown LINE error' };
  }
}

export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^+\d]/g, '');
  if (digits.length <= 4) return digits;
  const prefix = digits.slice(0, 3);
  const suffix = digits.slice(-2);
  return `${prefix}***${suffix}`;
}

export function maskLineId(lineId: string | null | undefined): string | null {
  if (!lineId) return null;
  if (lineId.length <= 3) return lineId;
  const prefix = lineId.slice(0, 2);
  const suffix = lineId.slice(-1);
  return `${prefix}***${suffix}`;
}
