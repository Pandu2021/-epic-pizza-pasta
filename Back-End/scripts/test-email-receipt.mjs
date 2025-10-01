import PDFDocument from 'pdfkit'
import fs from 'fs'
import nodemailer from 'nodemailer'
import path from 'path'

async function makePdf(outPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [298, 420], margin: 8 }) // approx A6 in points
    const stream = fs.createWriteStream(outPath)
    doc.pipe(stream)
    doc.fontSize(12).text('Pizza & Pasta', { align: 'center' })
    doc.moveDown()
    doc.fontSize(10).text('Order: TEST-1234')
    doc.text('Item 1 x1 - 100 THB')
    doc.text('Item 2 x2 - 200 THB')
    doc.moveDown()
    doc.text('Total: 300 THB', { align: 'right' })
    doc.end()
    stream.on('finish', () => resolve(outPath))
    stream.on('error', reject)
  })
}

async function main() {
  const tmpDir = path.resolve('./tmp')
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
  const out = path.join(tmpDir, `test-receipt-${Date.now()}.pdf`)
  await makePdf(out)

  // create test SMTP account
  const testAccount = await nodemailer.createTestAccount()
  const transporter = nodemailer.createTransport({ host: testAccount.smtp.host, port: testAccount.smtp.port, secure: testAccount.smtp.secure, auth: { user: testAccount.user, pass: testAccount.pass } })

  const info = await transporter.sendMail({
    from: 'no-reply@example.com',
    to: process.env.TEST_EMAIL_TO || 'recipient@example.com',
    subject: 'Test receipt PDF',
    text: 'Attached is a test receipt PDF.',
    attachments: [ { filename: path.basename(out), path: out, contentType: 'application/pdf' } ],
  })

  console.log('Sent message id:', info.messageId)
  const preview = nodemailer.getTestMessageUrl(info)
  if (preview) console.log('Preview URL:', preview)
  else console.log('No preview URL available')
}

main().catch((e) => { console.error('Test script failed:', e); process.exit(1) })
