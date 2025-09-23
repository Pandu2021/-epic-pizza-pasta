import { Controller, Get, Post } from '@nestjs/common';
import { getSheetsConfigSnapshot, appendOrderToSheet, probeSheets, getRecentOrderRows } from '../utils/sheets';

@Controller('api/health')
export class HealthController {
  @Get()
  health() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('sheets')
  sheets() {
    return getSheetsConfigSnapshot();
  }

  @Get('sheets/probe')
  async sheetsProbe() {
    return probeSheets();
  }

  @Get('sheets/peek')
  async sheetsPeek() {
    const { header, rows } = await getRecentOrderRows(3);
    return { header, rows };
  }

  // Dev-only helper: triggers a minimal append to verify Sheets is writable.
  // Do NOT expose in production without auth; here it's OK because it appends
  // a harmless test row and environment is dev.
  @Post('sheets/test-append')
  async sheetsTestAppend() {
    const ok = await appendOrderToSheet({
      id: 'health-test',
      customerName: 'HealthCheck',
      phone: '000',
      address: 'N/A',
      deliveryType: 'pickup',
      subtotal: 0,
      deliveryFee: 0,
      tax: 0,
      discount: 0,
      total: 0,
      paymentMethod: 'cod',
      status: 'test',
      createdAt: new Date().toISOString(),
      items: [],
      payment: { status: 'test' },
    } as any);
    return { ok };
  }
}
