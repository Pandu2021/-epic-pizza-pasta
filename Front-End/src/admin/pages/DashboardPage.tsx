import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminEndpoints } from '../../services/api';

type SummaryPayload = {
  ts: string;
  ordersToday: number;
  revenueToday: number;
  unpaidOrPendingPayments: number;
};

type Summary = SummaryPayload | null;

type SummaryMetricKey = Exclude<keyof SummaryPayload, 'ts'>;

const kpiCards: Array<{ key: SummaryMetricKey; label: string; format?: (value: number) => string }> = [
  { key: 'ordersToday', label: 'Orders Today' },
  { key: 'revenueToday', label: 'Revenue Today', format: (value: number) => `฿${(value || 0).toLocaleString('th-TH')}` },
  { key: 'unpaidOrPendingPayments', label: 'Pending Payments' },
];

type OrderRow = {
  id: string;
  createdAt: string;
  customerName?: string | null;
  total: number;
  status: string;
  payment?: { status: string; method?: string } | null;
};

export default function DashboardPage() {
  const summaryQuery = useQuery<Summary>({
    queryKey: ['admin', 'dashboard', 'summary'],
    queryFn: async () => {
      const { data } = await adminEndpoints.dashboardSummary();
      return (data || null) as Summary;
    },
    refetchInterval: 30000,
  });

  const recentOrdersQuery = useQuery<OrderRow[]>({
    queryKey: ['admin', 'dashboard', 'recent-orders'],
    queryFn: async () => {
      const { data } = await adminEndpoints.listOrders({ take: 10 });
      if (!Array.isArray(data)) return [];
      return (data as OrderRow[]).slice(0, 10);
    },
    refetchInterval: 30000,
  });

  const summary: Summary | undefined = summaryQuery.data;
  const recentOrders: OrderRow[] = recentOrdersQuery.data ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Operations Dashboard</h1>
          <p className="text-sm text-slate-500">Live metrics refresh automatically every 30 seconds.</p>
        </div>
        <div className="text-xs text-slate-400">Last updated {summary?.ts ? new Date(summary.ts).toLocaleTimeString() : '—'}</div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => {
          const value = summary ? summary[card.key] : undefined;
          const display = value === undefined ? '…' : card.format ? card.format(value) : value.toLocaleString();
          return (
            <article key={card.key} className="rounded-xl bg-white shadow-sm border border-slate-200 p-5">
              <div className="text-xs uppercase tracking-wide text-slate-500">{card.label}</div>
              <div className="mt-3 text-2xl font-semibold text-slate-900">{display}</div>
            </article>
          );
        })}
      </section>

      <section className="rounded-xl bg-white shadow-sm border border-slate-200">
        <header className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Recent Orders</h2>
            <p className="text-sm text-slate-500">Latest 10 orders with quick access to detail and receipts.</p>
          </div>
          <Link to="/orders" className="btn-outline">View all</Link>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-left text-slate-500">
              <tr>
                <th className="px-6 py-3">Order</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Total</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Payment</th>
                <th className="px-6 py-3" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {recentOrdersQuery.isLoading && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400">Loading orders…</td>
                </tr>
              )}
              {!recentOrdersQuery.isLoading && recentOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400">No orders captured yet today.</td>
                </tr>
              )}
              {recentOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-mono text-xs">#{order.id.slice(0, 8)}</td>
                  <td className="px-6 py-4">{order.customerName || '—'}</td>
                  <td className="px-6 py-4">฿{(order.total || 0).toLocaleString('th-TH')}</td>
                  <td className="px-6 py-4"><span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">{order.status}</span></td>
                  <td className="px-6 py-4 text-xs text-slate-500">{order.payment?.method ? `${order.payment.method} · ${order.payment.status}` : '—'}</td>
                  <td className="px-6 py-4"><Link to={`/orders/${order.id}`} className="btn-outline text-xs">Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
