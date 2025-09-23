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
				order.paymentMethod,
				paymentStatus,
			],
		];

		await sheets.spreadsheets.values.append({
			spreadsheetId: sheetId,
			range: 'Orders!A1:N1',
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
		await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Orders!A1:N1' });
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
	const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Orders!A:N' });
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
	];

	let hasHeader = false;
	try {
		const getRes = await sheets.spreadsheets.values.get({
			spreadsheetId,
			range: 'Orders!A1:N1',
		});
		const firstRow = (getRes.data as any)?.values?.[0] as string[] | undefined;
		if (firstRow && firstRow[0] === 'Timestamp') {
			hasHeader = true;
		}
	} catch (e) {
		// Possibly sheet doesn't exist yet; attempt to add it below.
	}

	if (!hasHeader) {
		// Try to create the sheet if missing; ignore errors if it exists.
		try {
			await sheets.spreadsheets.batchUpdate({
				spreadsheetId,
				requestBody: {
					requests: [
						{ addSheet: { properties: { title: 'Orders' } } },
					],
				},
			});
		} catch (e: any) {
			const msg = e?.response?.data?.error?.message || e?.message || e;
			console.warn('[sheets] addSheet warning:', msg);
		}
		// Now set header values in A1:N1
		await sheets.spreadsheets.values.update({
			spreadsheetId,
			range: 'Orders!A1:N1',
			valueInputOption: 'RAW',
			requestBody: { values: [HEADER] },
		});
	}
}

