import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import PDFDocument from 'pdfkit'
import { applyPrintFont } from './print-font'

export type OrderItem = {
  name: string
  qty: number
  price: number // unit price
}

export type OrderReceipt = {
  id: string
  dateISO?: string
  customer: { name: string; phone?: string; address?: string }
  items: OrderItem[]
  delivery: { type: 'pickup' | 'delivery'; fee: number }
  paymentMethod: 'cod' | 'promptpay' | 'card' | string
  notes?: string
  // Optional pricing fields (if provided by caller we will render them directly)
  subtotal?: number
  deliveryFee?: number
  tax?: number
  discount?: number
  total?: number
  vatRate?: number
}

const mm = (val: number) => (val * 72) / 25.4 // mm -> points
const A6 = [mm(105), mm(148)] as const // width x height

function currencyTHB(v: number) {
  try {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(v)
  } catch {
    return `฿${Math.round(v)}`
  }
}

export async function generateA6ReceiptPdf(order: OrderReceipt): Promise<string> {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pizza-receipt-'))
  const filePath = path.join(dir, `receipt-${order.id}.pdf`)

  const margin = mm(6)
  const doc = new PDFDocument({ size: [A6[0], A6[1]], margin })
  const stream = fs.createWriteStream(filePath)
  doc.pipe(stream)
  // Ensure currency symbol (฿) renders correctly
  applyPrintFont(doc)

  const drawRule = () => {
    doc.moveDown(0.25)
    const x = doc.page.margins.left
    const y = doc.y
    doc.save().moveTo(x, y).lineTo(doc.page.width - x, y).lineWidth(0.5).stroke('#999').restore()
    doc.moveDown(0.2)
  }

  const nowISO = order.dateISO || new Date().toISOString()
  const providedVatRate = typeof order.vatRate === 'number' ? order.vatRate : Number(process.env.THAI_VAT_RATE || 0.07)
  const computedSubtotal = order.items.reduce((s, it) => s + it.qty * it.price, 0)
  const subtotal = typeof order.subtotal === 'number' ? order.subtotal : computedSubtotal
  const deliveryFee = typeof order.deliveryFee === 'number' ? order.deliveryFee : (order.delivery?.fee || 0)
  const discount = typeof order.discount === 'number' ? order.discount : 0
  const tax = typeof order.tax === 'number' ? order.tax : Math.round((subtotal + deliveryFee - discount) * providedVatRate)
  const total = typeof order.total === 'number' ? order.total : subtotal + deliveryFee + tax - discount

  // Header
  doc.fontSize(16).text('Pizza & Pasta', { align: 'center' })
  doc.moveDown(0.2)
  doc.fontSize(10).text('Kitchen Order / Receipt', { align: 'center' })
  drawRule()

  doc.fontSize(9)
  doc.text(`Order: ${order.id}`)
  doc.text(`Date: ${nowISO.replace('T', ' ').slice(0, 19)}`)
  doc.text(`Payment: ${order.paymentMethod.toUpperCase()}`)
  doc.text(`Type: ${order.delivery.type === 'pickup' ? 'Pickup' : 'Delivery'}`)

  doc.moveDown(0.2)
  if (order.customer) {
    doc.text(`Customer: ${order.customer.name}`)
    if (order.customer.phone) doc.text(`Phone: ${order.customer.phone}`)
    if (order.delivery.type === 'delivery' && order.customer.address) doc.text(`Addr: ${order.customer.address}`, { width: A6[0] - margin * 2 })
  }
  if (order.notes) {
    doc.moveDown(0.2)
    doc.text(`Notes: ${order.notes}`, { width: A6[0] - margin * 2 })
  }
  drawRule()

  // Items
  doc.fontSize(10)
  for (const it of order.items) {
    const lineTotal = it.qty * it.price
    doc.text(`${it.qty} x ${it.name}`, { continued: true })
    doc.text(currencyTHB(lineTotal), { align: 'right' })
  }

  drawRule()
  // Totals
  doc.fontSize(10)
  doc.text('Subtotal', { continued: true })
  doc.text(currencyTHB(subtotal), { align: 'right' })
  if (deliveryFee) {
    doc.text('Delivery', { continued: true })
    doc.text(currencyTHB(deliveryFee), { align: 'right' })
  }
  if (tax) {
    const ratePct = Math.round((providedVatRate || 0) * 100)
    doc.text(`VAT ${ratePct}%`, { continued: true })
    doc.text(currencyTHB(tax), { align: 'right' })
  }
  if (discount) {
    doc.text('Discount', { continued: true })
    doc.text(`- ${currencyTHB(discount)}`, { align: 'right' })
  }
  doc.fontSize(12).text('TOTAL', { continued: true })
  doc.fontSize(12).text(currencyTHB(total), { align: 'right' })

  doc.moveDown(0.6)
  doc.fontSize(9).text('Thank you!', { align: 'center' })
  doc.fontSize(7).fillColor('#666').text('Please keep this receipt for your records.', { align: 'center' })
  doc.fillColor('#000')

  doc.end()
  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve())
    stream.on('error', reject)
  })
  return filePath
}
