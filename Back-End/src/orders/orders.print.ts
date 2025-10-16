import { Injectable } from '@nestjs/common'
import { prisma } from '../prisma'
import { generateA6ReceiptPdf, OrderReceipt } from '../utils/receipt'
import { printPdfTo } from '../utils/printer-pdf'
import { printPdfViaShell } from '../utils/printer-win'
import { enqueue } from '../utils/job-queue'

@Injectable()
export class OrdersPrintService {
  private enqueued = new Set<string>()
  private useLegacyPaymentSelect = false

  private isMissingVerifiedByColumn(err: unknown) {
    if (!err) return false
    const code = (err as any)?.code
    if (code === '42703') return true
    const columnName = (err as any)?.meta?.column_name || (err as any)?.meta?.columnName
    if (typeof columnName === 'string' && columnName.toLowerCase().includes('verifiedbyid')) {
      return true
    }
    const message = String((err as any)?.message || '').toLowerCase()
    return message.includes('verifiedbyid')
  }

  private async fetchPayment(orderId: string) {
    if (!orderId) return null
    if (this.useLegacyPaymentSelect) {
      return this.fetchPaymentLegacy(orderId)
    }
    try {
      return await prisma.payment.findUnique({ where: { orderId } })
    } catch (err) {
      if (this.isMissingVerifiedByColumn(err)) {
        // eslint-disable-next-line no-console
        console.warn('[orders.print] payment select missing verifiedById; switching to legacy select')
        this.useLegacyPaymentSelect = true
        return this.fetchPaymentLegacy(orderId)
      }
      throw err
    }
  }

  private async fetchPaymentLegacy(orderId: string) {
    try {
      const rows = await prisma.$queryRaw<any[]>`
        SELECT "id", "orderId", "method", "status", "promptpayQR", "providerRefId", "paidAt", "createdAt", "updatedAt"
        FROM "Payment"
        WHERE "orderId" = ${orderId}
        LIMIT 1
      `
      if (Array.isArray(rows) && rows.length) {
        const row = rows[0]
        return {
          id: row.id,
          orderId: row.orderId,
          method: row.method,
          status: row.status,
          promptpayQR: row.promptpayQR ?? null,
          providerRefId: row.providerRefId ?? null,
          paidAt: row.paidAt ?? null,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }
      }
      return null
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[orders.print] legacy payment select failed:', (err as any)?.message || err)
      throw err
    }
  }

  /**
   * Build a receipt PDF file for an order and return its file path.
   */
  async generateReceipt(orderId: string): Promise<string> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    })
    if (!order) throw new Error(`Order not found: ${orderId}`)

    const payment = await this.fetchPayment(orderId)
    const enriched = { ...order, payment }

    const receipt = this.buildReceipt(enriched as any)
    const pdf = await generateA6ReceiptPdf(receipt)
    return pdf
  }

  /**
   * Build a kitchen/receipt PDF for an order and send it to the printer.
   * Throws if order is not found.
   */
  async printReceipt(orderId: string): Promise<void> {
    const pdf = await this.generateReceipt(orderId)

    // Select printer name from env; when undefined, default printer is used
    const printerName = process.env.WINDOWS_PRINTER_NAME
    try {
      await printPdfTo(printerName, pdf)
    } catch (e) {
      // Fallback to PowerShell printing on Windows
      await printPdfViaShell(printerName, pdf)
    }
  }

  /**
   * Enqueue a background print job (idempotent per process) so HTTP request isn't blocked.
   */
  enqueuePrint(orderId: string) {
    if (this.enqueued.has(orderId)) return
    this.enqueued.add(orderId)
    enqueue({
      id: `print:order:${orderId}`,
      run: async () => {
        try {
          await this.printReceipt(orderId)
        } finally {
          // allow re-printing later if needed
          this.enqueued.delete(orderId)
        }
      },
      maxRetries: 3,
      baseDelayMs: 1000,
    })
  }

  private buildReceipt(order: any): OrderReceipt {
    const receipt: OrderReceipt = {
      id: order.id,
      dateISO: order.createdAt ? new Date(order.createdAt).toISOString() : new Date().toISOString(),
      customer: { name: order.customerName || 'Customer', phone: order.phone || undefined, address: order.address || undefined },
      items: (order.items || []).map((it: any) => ({ name: it.nameSnapshot || String(it.menuItemId), qty: it.qty, price: it.priceSnapshot })),
      delivery: { type: (order.deliveryType === 'pickup' ? 'pickup' : 'delivery'), fee: Number(order.deliveryFee || 0) },
      paymentMethod: order.paymentMethod || 'cod',
      // Pass-through pricing fields so PDF can render VAT/discount correctly
      subtotal: typeof order.subtotal === 'number' ? order.subtotal : undefined,
      deliveryFee: typeof order.deliveryFee === 'number' ? order.deliveryFee : undefined,
      tax: typeof order.tax === 'number' ? order.tax : undefined,
      discount: typeof order.discount === 'number' ? order.discount : undefined,
      total: typeof order.total === 'number' ? order.total : undefined,
      vatRate: typeof process.env.THAI_VAT_RATE === 'string' ? Number(process.env.THAI_VAT_RATE) : undefined,
    }
    return receipt
  }
}
