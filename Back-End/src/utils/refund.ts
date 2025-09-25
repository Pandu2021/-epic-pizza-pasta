export interface RefundDecisionInput {
  paymentStatus?: string | null;
  orderStatus?: string;
  isPaid?: boolean; // convenience flag if already captured
}

export function shouldRefund({ paymentStatus, orderStatus, isPaid }: RefundDecisionInput): boolean {
  if (!paymentStatus) return false;
  if (orderStatus !== 'cancelled') return false;
  // If payment is pending or unpaid we simulate refund (release hold / ignore collection)
  if (['pending','unpaid'].includes(paymentStatus)) return true;
  // If already fully paid (captured) real refund logic would be needed; keep false here until implemented
  if (isPaid) return true; // placeholder for future expansion
  return false;
}