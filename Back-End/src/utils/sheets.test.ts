import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as GoogleApis from 'googleapis';
import { ensureOrdersHeader, updateOrderStatusInSheet } from './sheets';

// Build a mock sheets client
function createMockSheets() {
	const get = vi.fn().mockResolvedValue({ data: { values: [['Timestamp']] } });
	const append = vi.fn().mockResolvedValue({});
	const update = vi.fn().mockResolvedValue({});
	const batchUpdate = vi.fn().mockResolvedValue({});
	return {
		spreadsheets: {
			values: { get, append, update },
			batchUpdate,
		},
	} as any;
}

describe('sheets utils', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('ensureOrdersHeader no-op when header exists', async () => {
		const mockSheets = createMockSheets();
		await ensureOrdersHeader(mockSheets as any, 'sheet123');
		expect(mockSheets.spreadsheets.values.get).toHaveBeenCalledOnce();
		expect(mockSheets.spreadsheets.values.update).not.toHaveBeenCalled();
	});

	it('ensureOrdersHeader writes header when missing', async () => {
		const mockSheets = createMockSheets();
		mockSheets.spreadsheets.values.get = vi.fn().mockResolvedValue({ data: { values: [] } });
		await ensureOrdersHeader(mockSheets as any, 'sheet123');
		expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalled();
		expect(mockSheets.spreadsheets.values.update).toHaveBeenCalled();
	});

	it('updateOrderStatusInSheet returns false if not configured', async () => {
		// Unset envs
		delete process.env.GOOGLE_SHEET_ID;
		const ok = await updateOrderStatusInSheet('order-x', 'cancelled');
		expect(ok).toBe(false);
	});

	it('updateOrderStatusInSheet updates matching row', async () => {
		process.env.GOOGLE_SHEET_ID = 'sheet1';
		process.env.GOOGLE_SHEET_SERVICE_EMAIL = 'svc@example.com';
		process.env.GOOGLE_SHEETS_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----';
		// Mock google auth + client
		const update = vi.fn().mockResolvedValue({});
		const get = vi.fn().mockResolvedValue({ data: { values: [
			['Timestamp','Order ID','Name','Phone','Address','Delivery','Items','Subtotal','DeliveryFee','Tax','Discount','Total','Method','PaymentStatus','OrderStatus','Driver','DeliveredAt'],
			['2024-01-01T00:00:00.000Z','order-123','A','P','Addr','delivery','','0','0','0','0','0','cod','unpaid','', '', ''],
		] } });
		vi.spyOn(GoogleApis, 'google', 'get').mockReturnValue({
			auth: { JWT: vi.fn().mockImplementation(() => ({})) },
			sheets: () => ({
				spreadsheets: {
					values: { get, append: vi.fn(), update },
					batchUpdate: vi.fn(),
				},
			}),
		} as any);
		const ok = await updateOrderStatusInSheet('order-123', 'cancelled');
		expect(ok).toBe(true);
		expect(update).toHaveBeenCalled();
	});

	it('updateOrderStatusInSheet returns false if order not found', async () => {
		process.env.GOOGLE_SHEET_ID = 'sheet1';
		process.env.GOOGLE_SHEET_SERVICE_EMAIL = 'svc@example.com';
		process.env.GOOGLE_SHEETS_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----';
		const update = vi.fn().mockResolvedValue({});
		const get = vi.fn().mockResolvedValue({ data: { values: [
			['Timestamp','Order ID','Name','Phone','Address','Delivery','Items','Subtotal','DeliveryFee','Tax','Discount','Total','Method','PaymentStatus','OrderStatus','Driver','DeliveredAt'],
			['2024-01-01T00:00:00.000Z','order-999','A','P','Addr','delivery','','0','0','0','0','0','cod','unpaid','', '', ''],
		] } });
		vi.spyOn(GoogleApis, 'google', 'get').mockReturnValue({
			auth: { JWT: vi.fn().mockImplementation(() => ({})) },
			sheets: () => ({
				spreadsheets: {
					values: { get, append: vi.fn(), update },
					batchUpdate: vi.fn(),
				},
			}),
		} as any);
		const ok = await updateOrderStatusInSheet('order-123', 'cancelled');
		expect(ok).toBe(false);
		expect(update).not.toHaveBeenCalled();
	});
});
