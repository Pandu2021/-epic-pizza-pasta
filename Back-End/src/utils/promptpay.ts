// Minimal PromptPay QR payload builder (mock for dev)
// In production, implement EMVCo-compliant payload.
export function buildPromptPayPayload(params: { merchantId: string; amount: number }) {
  const amt = params.amount.toFixed(2);
  return `PROMPTPAY|MID:${params.merchantId}|AMT:${amt}|CUR:THB|TS:${Date.now()}`;
}
