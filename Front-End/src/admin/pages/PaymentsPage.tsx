import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { adminEndpoints } from '../../services/api';

type Payment = {
  id: string;
  orderId: string;
  status: string;
  method: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
};

function isNotImplemented(error: unknown): boolean {
  const status = (error as any)?.response?.status;
  return status === 404 || status === 501;
}

export default function PaymentsPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');

  const paymentsQuery = useQuery<Payment[]>({
    queryKey: ['admin', 'payments', statusFilter, methodFilter],
    retry: false,
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (methodFilter !== 'all') params.method = methodFilter;
      try {
        const { data } = await adminEndpoints.listPayments(params);
        if (!Array.isArray(data)) return [];
        return data as Payment[];
      } catch (error) {
        if (isNotImplemented(error)) {
          throw new Error('NOT_IMPLEMENTED');
        }
        throw error;
      }
    },
    refetchInterval: 45000,
  });

  const refundMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await adminEndpoints.refundPayment(id, { reason });
    },
    onSuccess: () => paymentsQuery.refetch(),
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      await adminEndpoints.verifyPayment(id, { note });
    },
    onSuccess: () => paymentsQuery.refetch(),
  });

  const payments = paymentsQuery.data ?? [];

  const handleRefund = async (payment: Payment) => {
    const reason = window.prompt(`Refund amount ฿${payment.amount.toLocaleString('th-TH')} for order ${payment.orderId}. Reason?`, 'Customer requested cancellation');
    if (!reason) return;
    try {
      await refundMutation.mutateAsync({ id: payment.id, reason });
      window.alert('Refund request submitted.');
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Refund failed. Please check gateway configuration.';
      window.alert(message);
    }
  };

  const handleVerify = async (payment: Payment) => {
    const note = window.prompt(`Verify payment ${payment.id}. Optional note`, 'Verified manually');
    try {
      await verifyMutation.mutateAsync({ id: payment.id, note: note || undefined });
      window.alert('Payment marked as verified.');
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Verification failed. Ensure backend endpoint is implemented.';
      window.alert(message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Payments</h1>
          <p className="text-sm text-slate-500">Reconcile transactions, verify COD/transfer, and initiate manual refunds.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="status" className="text-slate-500">Status</label>
          <select id="status" className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="succeeded">Succeeded</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
          <label htmlFor="method" className="text-slate-500">Method</label>
          <select id="method" className="input" value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="promptpay">PromptPay</option>
            <option value="card">Card</option>
            <option value="cod">COD</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>
      </div>

      {paymentsQuery.isError && (paymentsQuery.error as Error)?.message === 'NOT_IMPLEMENTED' && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-800">
          The backend payments endpoints are not yet available. Please implement the routes listed in <code>Back-End/API-CONTRACT.md</code> before using this screen.
        </div>
      )}

      {paymentsQuery.isError && (paymentsQuery.error as Error)?.message !== 'NOT_IMPLEMENTED' && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-6 text-red-700">
          Failed to load payments. {(paymentsQuery.error as Error).message}
        </div>
      )}

      {!paymentsQuery.isError && (
        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-left text-slate-500">
              <tr>
                <th className="px-6 py-3">Payment</th>
                <th className="px-6 py-3">Order</th>
                <th className="px-6 py-3">Method</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Updated</th>
                <th className="px-6 py-3" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paymentsQuery.isLoading && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-400">Loading payments…</td>
                </tr>
              )}
              {!paymentsQuery.isLoading && payments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-400">No payments match the current filters.</td>
                </tr>
              )}
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-mono text-xs">{payment.id.slice(0, 10)}</td>
                  <td className="px-6 py-4 font-mono text-xs">{payment.orderId.slice(0, 10)}</td>
                  <td className="px-6 py-4 capitalize">{payment.method}</td>
                  <td className="px-6 py-4">฿{payment.amount.toLocaleString('th-TH')}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">{new Date(payment.updatedAt || payment.createdAt).toLocaleString()}</td>
                  <td className="px-6 py-4 space-x-2 text-right">
                    <button
                      type="button"
                      className="btn-outline text-xs"
                      onClick={() => handleVerify(payment)}
                      disabled={verifyMutation.isPending}
                    >
                      Verify
                    </button>
                    <button
                      type="button"
                      className="btn-outline text-xs"
                      onClick={() => handleRefund(payment)}
                      disabled={refundMutation.isPending || payment.status === 'refunded'}
                    >
                      Refund
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
