import { Buffer } from 'node:buffer';
type MessageResult = { ok: boolean; error?: string; responseStatus?: number };

type WhatsAppParams = { to: string; body: string; mediaUrl?: string };
type LineParams = { to: string; body: string };

function normalizeE164Phone(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const sanitized = trimmed.replace(/[^+\d]/g, '');
  if (!sanitized) return null;
  if (sanitized.startsWith('+')) {
    return sanitized;
  }
  const defaultCountry = (process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '').trim();
  if (!defaultCountry.startsWith('+')) {
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

export async function sendWhatsAppMessage({ to, body, mediaUrl }: WhatsAppParams): Promise<MessageResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    return { ok: false, error: 'WhatsApp messaging not configured' };
  }

  const normalizedTo = normalizeE164Phone(to);
  const normalizedFrom = normalizeE164Phone(from) || from.trim();

  if (!normalizedTo) {
    return { ok: false, error: 'Invalid WhatsApp recipient number' };
  }
  if (!normalizedFrom) {
    return { ok: false, error: 'Invalid WhatsApp sender number' };
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
