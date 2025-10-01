import type { Transporter } from 'nodemailer'
import nodemailer from 'nodemailer'

// Basic transport singleton
let transport: Transporter | null = null

async function ensureTransport(): Promise<Transporter> {
  if (transport) return transport
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 465)
  const secure = String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true'
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (host && user && pass) {
    transport = nodemailer.createTransport({ host, port, secure, auth: { user, pass } })
    return transport
  }
  // Fallback to Ethereal test account for development if SMTP is not configured
  // This prevents hard failures during local testing and provides a preview URL
  // eslint-disable-next-line no-console
  console.warn('[email] SMTP not configured; creating Ethereal test account for development')
  const testAccount = await nodemailer.createTestAccount()
  transport = nodemailer.createTransport({ host: testAccount.smtp.host, port: testAccount.smtp.port, secure: testAccount.smtp.secure, auth: { user: testAccount.user, pass: testAccount.pass } })
  return transport
}

export type EmailAttachment = { filename: string; path: string; contentType?: string }
export type SendEmailInput = {
  to: string
  subject: string
  text?: string
  html?: string
  attachments?: EmailAttachment[]
}

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; messageId?: string }> {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@example.com'
  const t = await ensureTransport()
  const info = await t.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments: input.attachments,
  })
  // If using Ethereal, log the preview URL to help debugging
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const preview = (nodemailer as any).getTestMessageUrl ? (nodemailer as any).getTestMessageUrl(info) : undefined
    if (preview) console.info('[email] preview URL:', preview)
  } catch {}
  return { ok: true, messageId: info.messageId }
}

// Backward-compatible convenience for order-created emails without attachments
export interface OrderEmailPayload {
  id: string
  to: string
  customerName: string
  total: number
  status: string
}

export async function sendOrderEmail(payload: OrderEmailPayload): Promise<boolean> {
  const subject = `Order ${payload.id} - ${payload.status}`
  const text = `Hello ${payload.customerName},\n\nYour order ${payload.id} is ${payload.status}. Total: ${payload.total}.\n\nThank you for ordering from Pizza & Pasta.`
  try {
    await sendEmail({ to: payload.to, subject, text })
    return true
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[email] sendOrderEmail failed', (e as any)?.message || e)
    return false
  }
}
