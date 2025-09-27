import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { OrdersPrintService } from './orders.print'
import * as printerPdf from '../utils/printer-pdf'
import * as printerWin from '../utils/printer-win'
import { prisma } from '../prisma'

describe('OrdersPrintService', () => {
  const oldEnv = { ...process.env }
  beforeAll(() => {
    process.env.WINDOWS_PRINTER_NAME = 'TestPrinter'
  })
  afterAll(() => { process.env = oldEnv })

  it('generates pdf and prints via pdf-to-printer, with PowerShell fallback', async () => {
    // Arrange: stub prisma order
    const orderId = 'ord_123'
  vi.spyOn(prisma.order as any, 'findUnique').mockResolvedValue({
      id: orderId,
      customerName: 'Tester',
      phone: '+6612345678',
      deliveryType: 'delivery',
      deliveryFee: 20,
      paymentMethod: 'cod',
      items: [ { nameSnapshot: 'Pizza', qty: 1, priceSnapshot: 100 } ],
    } as any)

    // Spy on print functions
    const pdfSpy = vi.spyOn(printerPdf, 'printPdfTo').mockResolvedValue()
    const shellSpy = vi.spyOn(printerWin, 'printPdfViaShell').mockResolvedValue()

    const svc = new OrdersPrintService()
    await svc.printReceipt(orderId)

    expect(pdfSpy).toHaveBeenCalledTimes(1)
    // When first succeeds, shell fallback should not be called
    expect(shellSpy).toHaveBeenCalledTimes(0)

    // Now simulate pdf-to-printer failure and ensure fallback executes
    pdfSpy.mockRejectedValueOnce(new Error('fail'))
    await svc.printReceipt(orderId)
    expect(shellSpy).toHaveBeenCalled()
  })
})
