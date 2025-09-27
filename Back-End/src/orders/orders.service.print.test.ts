import { describe, it, expect, vi } from 'vitest'
import { OrdersService } from './orders.service'
import { OrdersPrintService } from './orders.print'
import { prisma } from '../prisma'

describe('OrdersService printing integration', () => {
  it('enqueues print when status updated to received', async () => {
    const printer = new OrdersPrintService()
    const enqueueSpy = vi.spyOn(printer, 'enqueuePrint').mockImplementation(() => {})
  // Mock prisma update
  vi.spyOn(prisma.order as any, 'update').mockResolvedValue({ id: 'o1', status: 'received' } as any)

    const svc = new OrdersService(undefined as any, printer)
    await svc.updateStatus('o1', 'received')
    expect(enqueueSpy).toHaveBeenCalledWith('o1')
  })
})
