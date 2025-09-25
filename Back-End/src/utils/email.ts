// Simple email notification stub. In real implementation integrate with a provider.
export interface OrderEmailPayload {
  id: string;
  to: string;
  customerName: string;
  total: number;
  status: string;
}

export async function sendOrderEmail(payload: OrderEmailPayload): Promise<boolean> {
  // For now just log; return true to indicate success
  // eslint-disable-next-line no-console
  console.log('[email] sendOrderEmail stub', payload);
  return true;
}
