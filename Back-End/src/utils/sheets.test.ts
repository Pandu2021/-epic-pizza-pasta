import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as GoogleApis from 'googleapis';
import { ensureOrdersHeader } from './sheets';

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
});
