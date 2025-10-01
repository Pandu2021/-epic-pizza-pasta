import 'dotenv/config'
import { sendEmail } from '../src/utils/email'

async function main() {
  const to = process.env.RECEIPT_EMAIL_TO || process.env.SMTP_USER || 'epicpizzaorders@gmail.com'
  console.log(`[test-email] Sending test email to ${to} via ${process.env.SMTP_HOST}:${process.env.SMTP_PORT} secure=${process.env.SMTP_SECURE}`)
  try {
    const res = await sendEmail({
      to,
      subject: 'Test email from Pizza & Pasta backend',
      text: 'This is a test email to verify SMTP configuration for receipt sending.',
    })
    console.log('[test-email] OK messageId=', res.messageId)
  } catch (e: any) {
    console.error('[test-email] FAILED:', e?.message || e)
    process.exitCode = 1
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
