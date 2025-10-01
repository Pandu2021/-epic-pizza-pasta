import { google } from 'googleapis';

type OrderLike = {
	id: string;
	customerName: string;
	phone: string;
	address: string;
	deliveryType?: string | null;
	subtotal: number;
	deliveryFee: number;
	tax: number;
	discount: number;
	total: number;
	paymentMethod: string;
	status?: string;
	createdAt?: Date | string;
	items?: Array<{ nameSnapshot: string; qty: number; priceSnapshot: number }>;
	payment?: { status?: string | null } | null;
};

function normalizePrivateKey(pk: string) {
	return pk.replace(/\\n/g, '\n');
}

function buildItemsSummary(items?: OrderLike['items']): string {
	if (!items || items.length === 0) return '';
	return items
		.map((it) => `${it.qty}x ${it.nameSnapshot} (${it.priceSnapshot})`)
		.join('; ');
}

export async function appendOrderToSheet(order: OrderLike): Promise<boolean> {
	const sheetId = process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SHEETS_ID;
	const svcEmail = process.env.GOOGLE_SHEET_SERVICE_EMAIL || process.env.GOOGLE_SHEETS_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
	const pk = process.env.GOOGLE_SHEETS_PRIVATE_KEY || process.env.GOOGLE_SHEET_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

	if (!sheetId) {
		console.warn('[sheets] GOOGLE_SHEET_ID missing; skip append');
		return false;
	}
	if (!svcEmail || !pk) {
		console.warn('[sheets] Service account credentials missing; set GOOGLE_SHEET_SERVICE_EMAIL and GOOGLE_SHEETS_PRIVATE_KEY');
		return false;
	}

	try {
		const jwt = new google.auth.JWT({
			email: svcEmail,
			key: normalizePrivateKey(pk),
			scopes: ['https://www.googleapis.com/auth/spreadsheets'],
		});
		const sheets = google.sheets({ version: 'v4', auth: jwt });

		// Ensure the Orders sheet exists and has a header row.
		await ensureOrdersHeader(sheets, sheetId).catch((e) => {
			// Non-fatal: we'll still attempt an append
			console.warn('[sheets] ensure header warning:', e?.message || e);
		});

		const when = order.createdAt ? new Date(order.createdAt) : new Date();
		const paymentStatus = (order.payment?.status as string | undefined) || 'unknown';

		// For pickup orders with COD, present payment method as 'cash' in Sheets
		const paymentMethodOut = (String(order.deliveryType).toLowerCase() === 'pickup' && String(order.paymentMethod).toLowerCase() === 'cod')
			? 'cash'
			: order.paymentMethod;

		const values = [
			[
				when.toISOString(),
				order.id,
				order.customerName,
				order.phone,
				order.address,
				order.deliveryType || '',
				buildItemsSummary(order.items),
				order.subtotal,
				order.deliveryFee,
				order.tax,
				order.discount,
				order.total,
				paymentMethodOut,
				paymentStatus,
				order.status || '', // OrderStatus column (logical status)
				'', // Driver (future use)
				'', // DeliveredAt (future use)
			],
		];

		await sheets.spreadsheets.values.append({
			spreadsheetId: sheetId,
			range: 'Orders!A1:Q1',
			valueInputOption: 'USER_ENTERED',
			requestBody: { values },
		});
		// eslint-disable-next-line no-console
		console.log(`[sheets] append OK: orderId=${order.id}`);
		return true;
	} catch (e: any) {
		const detail = e?.response?.data?.error?.message || e?.message || e;
		console.error('[sheets] append failed:', detail);
		return false;
	}
}

// =============================
// Printing (Kitchen) Sheet Logic
// =============================
// A separate simplified sheet optimized for printing tickets: one row per item.
// Enabled when ENABLE_SHEETS_PRINT_SHEET === 'true'. Sheet name can be overridden via SHEETS_PRINT_SHEET_NAME (default 'Print').

function isPrintSheetEnabled(): boolean {
	return (process.env.ENABLE_SHEETS_PRINT_SHEET || '').toLowerCase() === 'true';
}

function getPrintSheetName(): string { return process.env.SHEETS_PRINT_SHEET_NAME || 'Print'; }

async function ensurePrintHeader(sheets: ReturnType<typeof google.sheets>, spreadsheetId: string, sheetName = getPrintSheetName()): Promise<void> {
	const HEADER = [
		'Timestamp',       // ISO time
		'OrderID',         // Order id
		'Qty',             // Quantity
		'Item',            // Item name
		'UnitPrice',       // Unit price snapshot
		'LineTotal',       // qty * unit price
		'Customer',        // Customer name
		'Phone',           // Phone (for driver contact)
		'Address',         // Delivery address
		'DeliveryType',    // delivery|pickup
		'PaymentMethod',   // promptpay|card|cod
		'PaymentStatus',   // paid|pending|...
		'OrderStatus',     // logical order status
	];
	let hasHeader = false;
	let existing: string[] | undefined;
	try {
		const getRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!A1:M1` });
		const first = (getRes.data as any)?.values?.[0];
		existing = first as string[] | undefined;
		if (first && first[0] === 'Timestamp') hasHeader = true;
	} catch { /* sheet may not exist yet */ }
	if (!hasHeader) {
		try {
			await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [ { addSheet: { properties: { title: sheetName } } } ] } });
		} catch (e: any) {
			const msg = e?.response?.data?.error?.message || e?.message || e;
			// If already exists, ignore error
			if (!/already exists/i.test(String(msg))) console.warn('[sheets.print] addSheet warning:', msg);
		}
		await sheets.spreadsheets.values.update({ spreadsheetId, range: `${sheetName}!A1:M1`, valueInputOption: 'RAW', requestBody: { values: [HEADER] } });
	} else {
		// Header row exists; if any expected labels are missing/blank, repair the header row in-place
		const needsRepair = !existing || HEADER.some((label, idx) => (existing![idx] || '').trim() !== label);
		if (needsRepair) {
			await sheets.spreadsheets.values.update({ spreadsheetId, range: `${sheetName}!A1:M1`, valueInputOption: 'RAW', requestBody: { values: [HEADER] } });
		}
	}
}

export async function appendOrderItemsToPrintSheet(order: OrderLike): Promise<boolean> {
	if (!isPrintSheetEnabled()) return false; // silently skip when disabled
	const sheetId = process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SHEETS_ID;
	const svcEmail = process.env.GOOGLE_SHEET_SERVICE_EMAIL || process.env.GOOGLE_SHEETS_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
	const pk = process.env.GOOGLE_SHEETS_PRIVATE_KEY || process.env.GOOGLE_SHEET_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
	if (!sheetId || !svcEmail || !pk) return false;
	const items = order.items || [];
	if (!items.length) return false;
	try {
		const jwt = new google.auth.JWT({ email: svcEmail, key: normalizePrivateKey(pk), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
		const sheets = google.sheets({ version: 'v4', auth: jwt });
		const sheetName = getPrintSheetName();
		await ensurePrintHeader(sheets, sheetId, sheetName).catch(()=>{});
		const when = order.createdAt ? new Date(order.createdAt) : new Date();
		const paymentStatus = (order.payment?.status as string | undefined) || 'unknown';
		const paymentMethodOut = (String(order.deliveryType).toLowerCase() === 'pickup' && String(order.paymentMethod).toLowerCase() === 'cod')
			? 'cash'
			: order.paymentMethod;
		const rows = items.map(it => [
			when.toISOString(),
			order.id,
			it.qty,
			it.nameSnapshot,
			it.priceSnapshot,
			it.qty * it.priceSnapshot,
			order.customerName,
			order.phone,
			order.address,
			order.deliveryType || '',
			paymentMethodOut,
			paymentStatus,
			order.status || '',
		]);
		await sheets.spreadsheets.values.append({ spreadsheetId: sheetId, range: `${sheetName}!A1:M1`, valueInputOption: 'USER_ENTERED', requestBody: { values: rows } });
		console.log(`[sheets.print] appended ${rows.length} item rows for order ${order.id}`);
		return true;
	} catch (e: any) {
		console.warn('[sheets.print] append failed:', e?.message || e);
		return false;
	}
}

export async function updatePrintSheetStatus(orderId: string, newStatus: string): Promise<boolean> {
	if (!isPrintSheetEnabled()) return false;
	const sheetId = process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SHEETS_ID;
	const svcEmail = process.env.GOOGLE_SHEET_SERVICE_EMAIL || process.env.GOOGLE_SHEETS_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
	const pk = process.env.GOOGLE_SHEETS_PRIVATE_KEY || process.env.GOOGLE_SHEET_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
	if (!sheetId || !svcEmail || !pk) return false;
	try {
		const jwt = new google.auth.JWT({ email: svcEmail, key: normalizePrivateKey(pk), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
		const sheets = google.sheets({ version: 'v4', auth: jwt });
		const sheetName = getPrintSheetName();
		await ensurePrintHeader(sheets, sheetId, sheetName).catch(()=>{});
		const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${sheetName}!A:M` });
		const rows = (res.data as any)?.values as string[][] | undefined;
		if (!rows || rows.length < 2) return false;
		const header = rows[0];
		const orderIdCol = header.indexOf('OrderID');
		const statusCol = header.indexOf('OrderStatus');
		if (orderIdCol === -1 || statusCol === -1) return false;
		let dirty = false;
		for (let i = 1; i < rows.length; i++) {
			if (rows[i][orderIdCol] === orderId) {
				rows[i][statusCol] = newStatus;
				dirty = true;
			}
		}
		if (!dirty) return false;
		// Write back only status column cells (optimize) - build updates
		const updates: string[][] = [];
		const ranges: string[] = [];
		for (let i = 1; i < rows.length; i++) {
			if (rows[i][orderIdCol] === orderId) {
				const cell = columnNumberToLetter(statusCol + 1) + (i + 1);
				ranges.push(`${sheetName}!${cell}`);
				updates.push([newStatus]);
			}
		}
		if (!ranges.length) return false;
		await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: sheetId, requestBody: { data: ranges.map((r, idx) => ({ range: r, values: [updates[idx]] })), valueInputOption: 'USER_ENTERED' } });
		console.log(`[sheets.print] updated status for order ${orderId} (${ranges.length} rows)`);
		return true;
	} catch (e: any) {
		console.warn('[sheets.print] status update failed:', e?.message || e);
		return false;
	}
}

export function isSheetsConfigured(): boolean {
	const sheetId = process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SHEETS_ID;
	const svcEmail = process.env.GOOGLE_SHEET_SERVICE_EMAIL || process.env.GOOGLE_SHEETS_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
	const pk = process.env.GOOGLE_SHEETS_PRIVATE_KEY || process.env.GOOGLE_SHEET_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
	return !!(sheetId && svcEmail && pk);
}

export function getSheetsConfigSnapshot() {
	const sheetId = process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SHEETS_ID || '';
	const svcEmail = process.env.GOOGLE_SHEET_SERVICE_EMAIL || process.env.GOOGLE_SHEETS_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
	const hasKey = !!(process.env.GOOGLE_SHEETS_PRIVATE_KEY || process.env.GOOGLE_SHEET_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
	const mask = (s: string) => (s ? `${s.slice(0, 4)}...${s.slice(-4)}` : '');
	return { configured: isSheetsConfigured(), sheetId: mask(sheetId), serviceEmail: svcEmail, hasPrivateKey: hasKey };
}

// Lightweight read probe to diagnose access/config issues without attempting writes
export async function probeSheets(): Promise<{ ok: boolean; error?: string }> {
	const sheetId = process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SHEETS_ID;
	const svcEmail = process.env.GOOGLE_SHEET_SERVICE_EMAIL || process.env.GOOGLE_SHEETS_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
	const pk = process.env.GOOGLE_SHEETS_PRIVATE_KEY || process.env.GOOGLE_SHEET_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
	if (!sheetId) return { ok: false, error: 'GOOGLE_SHEET_ID missing' };
	if (!svcEmail || !pk) return { ok: false, error: 'Service account email/private key missing' };
	try {
		const jwt = new google.auth.JWT({ email: svcEmail, key: normalizePrivateKey(pk), scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
		const sheets = google.sheets({ version: 'v4', auth: jwt });
		// Try to read the header row if exists
		await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Orders!A1:Q1' });
		return { ok: true };
	} catch (e: any) {
		const detail = e?.response?.data?.error?.message || e?.message || String(e);
		return { ok: false, error: detail };
	}
}

export async function getRecentOrderRows(limit = 5): Promise<{ header: string[]; rows: string[][] }> {
	const sheetId = process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SHEETS_ID;
	const svcEmail = process.env.GOOGLE_SHEET_SERVICE_EMAIL || process.env.GOOGLE_SHEETS_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
	const pk = process.env.GOOGLE_SHEETS_PRIVATE_KEY || process.env.GOOGLE_SHEET_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
	if (!sheetId || !svcEmail || !pk) throw new Error('Sheets not configured');
	const jwt = new google.auth.JWT({ email: svcEmail, key: normalizePrivateKey(pk), scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
	const sheets = google.sheets({ version: 'v4', auth: jwt });
	const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Orders!A:Q' });
	const all = (res.data as any)?.values || [];
	if (!all.length) return { header: [], rows: [] };
	const [header, ...rows] = all as string[][];
	const tail = rows.slice(-Math.max(0, limit));
	return { header, rows: tail };
}

// Internal: ensure the 'Orders' sheet exists and the header row A1:N1 is set.
// Exported for testing convenience.
export async function ensureOrdersHeader(
		sheets: ReturnType<typeof google.sheets>,
		spreadsheetId: string,
): Promise<void> {
	const HEADER = [
		'Timestamp',
		'Order ID',
		'Name',
		'Phone',
		'Address',
		'Delivery',
		'Items',
		'Subtotal',
		'DeliveryFee',
		'Tax',
		'Discount',
		'Total',
		'Method',
		'PaymentStatus',
		'OrderStatus',
		'Driver', // Column O label added (was blank before)
		'DeliveredAt', // Optional tracking column (column P)
	];

	let hasHeader = false;
	let existing: string[] | undefined;
	try {
		const getRes = await sheets.spreadsheets.values.get({
			spreadsheetId,
			range: 'Orders!A1:Q1',
		});
		existing = (getRes.data as any)?.values?.[0] as string[] | undefined;
		if (existing && existing[0] === 'Timestamp') {
			hasHeader = true;
		}
	} catch (e) {
		// Possibly sheet doesn't exist yet; attempt to add it below.
	}

	if (!hasHeader) {
		try {
			await sheets.spreadsheets.batchUpdate({
				spreadsheetId,
				requestBody: { requests: [ { addSheet: { properties: { title: 'Orders' } } } ] },
			});
		} catch (e: any) {
			const msg = e?.response?.data?.error?.message || e?.message || e;
			console.warn('[sheets] addSheet warning:', msg);
		}
		// Header now has one more column (A1:Q1)
		await sheets.spreadsheets.values.update({
			spreadsheetId,
			range: 'Orders!A1:Q1',
			valueInputOption: 'RAW',
			requestBody: { values: [HEADER] },
		});
	} else {
		// If header exists but any column name is blank or mismatched, repair the header row
		const needsRepair = !existing || HEADER.some((label, idx) => (existing![idx] || '').trim() !== label);
		if (needsRepair) {
			await sheets.spreadsheets.values.update({
				spreadsheetId,
				range: 'Orders!A1:Q1',
				valueInputOption: 'RAW',
				requestBody: { values: [HEADER] },
			});
		}
	}
}

// Update (or append missing) logical order status (independent from payment status)
export async function updateOrderStatusInSheet(orderId: string, newStatus: string): Promise<boolean> {
	const sheetId = process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SHEETS_ID;
	const svcEmail = process.env.GOOGLE_SHEET_SERVICE_EMAIL || process.env.GOOGLE_SHEETS_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
	const pk = process.env.GOOGLE_SHEETS_PRIVATE_KEY || process.env.GOOGLE_SHEET_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
	if (!sheetId || !svcEmail || !pk) {
		console.warn('[sheets.updateStatus] Sheets not configured');
		return false;
	}
	try {
		const jwt = new google.auth.JWT({ email: svcEmail, key: normalizePrivateKey(pk), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
		const sheets = google.sheets({ version: 'v4', auth: jwt });
		// Ensure header (will also add OrderStatus column if missing fresh sheet)
		await ensureOrdersHeader(sheets, sheetId).catch(() => {});

		// Get all current rows
		const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Orders!A:Q' });
		const rows = (res.data as any)?.values as string[][] | undefined;
		if (!rows || rows.length < 2) {
			console.warn('[sheets.updateStatus] No data rows to update');
			return false;
		}
		const header = rows[0];
		const orderIdCol = header.indexOf('Order ID');
		const orderStatusCol = header.indexOf('OrderStatus');
		const paymentStatusCol = header.indexOf('PaymentStatus');
		const deliveredAtCol = header.indexOf('DeliveredAt');
		if (orderIdCol === -1 || orderStatusCol === -1) {
			console.warn('[sheets.updateStatus] Required columns missing');
			return false;
		}
		// Find row index (1-based in sheet, 0-based in array; header = 0)
		let targetRow: number | null = null;
		for (let i = 1; i < rows.length; i++) {
			if (rows[i][orderIdCol] === orderId) {
				targetRow = i; break;
			}
		}
		if (targetRow == null) {
			console.warn('[sheets.updateStatus] Order ID not found', orderId);
			return false;
		}
		// Build updates for OrderStatus and optionally PaymentStatus (refund on cancel)
		const updates: { range: string; values: string[][] }[] = [];
		const statusCell = `Orders!${columnNumberToLetter(orderStatusCol + 1)}${targetRow + 1}`;
		updates.push({ range: statusCell, values: [[newStatus]] });
		if (String(newStatus).toLowerCase() === 'cancelled' && paymentStatusCol !== -1) {
			const payCell = `Orders!${columnNumberToLetter(paymentStatusCol + 1)}${targetRow + 1}`;
			updates.push({ range: payCell, values: [['refunded']] });
		}
		// When delivered, stamp DeliveredAt with current ISO time if column exists
		if (String(newStatus).toLowerCase() === 'delivered' && deliveredAtCol !== -1) {
			const delCell = `Orders!${columnNumberToLetter(deliveredAtCol + 1)}${targetRow + 1}`;
			updates.push({ range: delCell, values: [[new Date().toISOString()]] });
		}
		await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: sheetId, requestBody: { data: updates, valueInputOption: 'USER_ENTERED' } });
		console.log(`[sheets.updateStatus] Updated order ${orderId} => ${newStatus}`);
		return true;
	} catch (e: any) {
		const detail = e?.response?.data?.error?.message || e?.message || e;
		console.error('[sheets.updateStatus] failed:', detail);
		return false;
	}
}

function columnNumberToLetter(num: number): string {
	let s = '';
	while (num > 0) {
		const mod = (num - 1) % 26;
		s = String.fromCharCode(65 + mod) + s;
		num = Math.floor((num - mod) / 26);
	}
	return s;
}

// Rebuild entire sheet (Orders) from given dataset (orders already enriched with items + payment)
// This purposely replaces all rows except header. For large datasets consider batching.
export async function rebuildOrdersSheet(orders: Array<OrderLike & { payment?: any }>): Promise<boolean> {
	const sheetId = process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SHEETS_ID;
	const svcEmail = process.env.GOOGLE_SHEET_SERVICE_EMAIL || process.env.GOOGLE_SHEETS_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
	const pk = process.env.GOOGLE_SHEETS_PRIVATE_KEY || process.env.GOOGLE_SHEET_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
	if (!sheetId || !svcEmail || !pk) {
		console.warn('[sheets.rebuild] Sheets not configured');
		return false;
	}
	try {
		const jwt = new google.auth.JWT({ email: svcEmail, key: normalizePrivateKey(pk), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
		const sheets = google.sheets({ version: 'v4', auth: jwt });
		await ensureOrdersHeader(sheets, sheetId).catch(() => {});

		// Clear existing (except header). Use batchUpdate -> updateCells? Simpler: clear A2:Q
		await sheets.spreadsheets.values.clear({ spreadsheetId: sheetId, range: 'Orders!A2:Q' });

		if (!orders.length) return true;

		const values = orders.map(o => {
			const when = o.createdAt ? new Date(o.createdAt) : new Date();
			const paymentStatus = (o.payment?.status as string | undefined) || 'unknown';
			const methodOut = (String(o.deliveryType).toLowerCase() === 'pickup' && String(o.paymentMethod).toLowerCase() === 'cod') ? 'cash' : o.paymentMethod;
			return [
				when.toISOString(),
				o.id,
				o.customerName,
				o.phone,
				o.address,
				o.deliveryType || '',
				buildItemsSummary(o.items),
				o.subtotal,
				o.deliveryFee,
				o.tax,
				o.discount,
				o.total,
				methodOut,
				paymentStatus,
				o.status || '',
				'', // Driver placeholder
				'', // DeliveredAt placeholder
			];
		});
		// Batch write in one request
		await sheets.spreadsheets.values.update({
			spreadsheetId: sheetId,
			range: 'Orders!A2:Q2',
			valueInputOption: 'RAW',
			requestBody: { values },
		});
		console.log(`[sheets.rebuild] Wrote ${values.length} rows`);
		return true;
	} catch (e: any) {
		console.error('[sheets.rebuild] failed:', e?.message || e);
		return false;
	}
}

