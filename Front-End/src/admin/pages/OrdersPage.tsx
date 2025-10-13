import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminEndpoints } from '../../services/api';

const STATUS_OPTIONS = ['received', 'preparing', 'ready', 'delivering', 'completed', 'cancelled'];

type Order = {
  id: string;
  createdAt: string;
  customerName?: string | null;
  customerPhone?: string | null;
  total: number;
  status: string;
  channel?: string | null;
  payment?: { status: string; method?: string; amount?: number } | null;
};

export default function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const ordersQuery = useQuery<Order[]>({
    queryKey: ['admin', 'orders', statusFilter],
    queryFn: async () => {
      const params = statusFilter === 'all' ? undefined : { status: statusFilter };
      const { data } = await adminEndpoints.listOrders(params);
      if (!Array.isArray(data)) return [];
      return data as Order[];
    },
    refetchInterval: 30000,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await adminEndpoints.updateOrderStatus(id, { status });
    },
    onSuccess: () => ordersQuery.refetch(),
    onError: (err: any) => {
      const message = err?.response?.data?.message || 'Failed to update order status.';
      window.alert(message);
    },
  });

  const reprintMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await adminEndpoints.reprintReceipt(orderId);
    },
    onSuccess: () => window.alert('Print job dispatched. Check the kitchen printer.'),
    onError: (err: any) => {
      const message = err?.response?.data?.message || 'Unable to trigger print job. Please verify the backend implementation.';
      window.alert(message);
    },
  });

  const orders: Order[] = ordersQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Orders</h1>
          <p className="text-sm text-slate-500">Monitor and update order status. Data refreshes every 30 seconds.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="statusFilter" className="text-slate-500">Status</label>
          <select
            id="statusFilter"
            className="input"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-left text-slate-500">
            <tr>
              <th className="px-6 py-3">Order</th>
              <th className="px-6 py-3">Placed</th>
              <th className="px-6 py-3">Customer</th>
              <th className="px-6 py-3">Total</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Payment</th>
              <th className="px-6 py-3" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {ordersQuery.isLoading && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-slate-400">Loading orders…</td>
              </tr>
            )}
            {!ordersQuery.isLoading && orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-slate-400">No orders match the current filter.</td>
              </tr>
            )}
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-mono text-xs">#{order.id.slice(0, 8)}</td>
                <td className="px-6 py-4 text-xs text-slate-500">{new Date(order.createdAt).toLocaleString()}</td>
                <td className="px-6 py-4">
                  <div className="font-medium">{order.customerName || '—'}</div>
                  {order.customerPhone ? <div className="text-xs text-slate-500">{order.customerPhone}</div> : null}
                  {order.channel ? <div className="text-xs text-slate-400">{order.channel}</div> : null}
                </td>
                <td className="px-6 py-4">฿{(order.total || 0).toLocaleString('th-TH')}</td>
                <td className="px-6 py-4">
                  <select
                    className="input text-xs"
                    value={order.status}
                    onChange={(event) => statusMutation.mutate({ id: order.id, status: event.target.value })}
                    aria-label={`Update status for order ${order.id}`}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4 text-xs text-slate-500">
                  {order.payment?.method ? `${order.payment.method} · ${order.payment.status}` : '—'}
                </td>
                <td className="px-6 py-4 space-x-2 text-right">
                  <Link to={`/orders/${order.id}`} className="btn-outline text-xs">Detail</Link>
                  <button
                    type="button"
                    className="btn-outline text-xs"
                    onClick={() => reprintMutation.mutate(order.id)}
                    disabled={reprintMutation.isPending}
                  >
                    Print
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
