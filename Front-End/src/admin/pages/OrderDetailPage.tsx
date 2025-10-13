import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { adminEndpoints } from '../../services/api';

const STATUS_OPTIONS = ['received', 'preparing', 'ready', 'delivering', 'completed', 'cancelled'];

type OrderDetail = {
  id: string;
  createdAt: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  channel?: string | null;
  status: string;
  eta?: string | null;
  total: number;
  items: Array<{ id: string; name: string; quantity: number; price: number; modifiers?: string[] }>;
  payment?: { status: string; method?: string; amount?: number; reference?: string | null } | null;
  history?: Array<{ status: string; updatedAt: string; updatedBy?: string | null }>;
};

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();

  const detailQuery = useQuery<OrderDetail | null>({
    queryKey: ['admin', 'orders', orderId],
    enabled: Boolean(orderId),
    queryFn: async () => {
      if (!orderId) return null;
      const { data } = await adminEndpoints.getOrder(orderId);
      return (data || null) as OrderDetail | null;
    },
    refetchInterval: 20000,
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      if (!orderId) return;
      await adminEndpoints.updateOrderStatus(orderId, { status });
    },
    onSuccess: () => detailQuery.refetch(),
  });

  const reprintMutation = useMutation({
    mutationFn: async () => {
      if (!orderId) return;
      try {
        await adminEndpoints.reprintReceipt(orderId);
        window.alert('Print job dispatched.');
      } catch (err: any) {
        const message = err?.response?.data?.message || 'Unable to trigger print job. Please verify backend support.';
        window.alert(message);
        throw err;
      }
    },
  });

  const order = detailQuery.data;

  if (detailQuery.isLoading) {
    return <div className="text-slate-500">Loading order detail…</div>;
  }

  if (!order) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold text-slate-800">Order not found</h1>
        <p className="text-sm text-slate-500">The order you are looking for might have been deleted or the ID is invalid.</p>
        <Link to="/orders" className="btn-outline">Back to orders</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Order #{order.id.slice(0, 8)}</h1>
          <p className="text-sm text-slate-500">Created at {new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input"
            value={order.status}
            onChange={(event) => statusMutation.mutate(event.target.value)}
            disabled={statusMutation.isPending}
            aria-label="Update order status"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn-outline"
            onClick={() => reprintMutation.mutate()}
            disabled={reprintMutation.isPending}
          >
            Print receipt
          </button>
        </div>
      </div>

      <section className="grid gap-6 md:grid-cols-2">
        <article className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-semibold text-slate-800">Customer</h2>
          <div className="text-sm text-slate-600 space-y-1">
            <div><span className="font-medium">Name:</span> {order.customerName || '—'}</div>
            <div><span className="font-medium">Phone:</span> {order.customerPhone || '—'}</div>
            <div><span className="font-medium">Email:</span> {order.customerEmail || '—'}</div>
            <div><span className="font-medium">Channel:</span> {order.channel || '—'}</div>
          </div>
        </article>

        <article className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-semibold text-slate-800">Payment</h2>
          <div className="text-sm text-slate-600 space-y-1">
            <div><span className="font-medium">Method:</span> {order.payment?.method || '—'}</div>
            <div><span className="font-medium">Status:</span> {order.payment?.status || '—'}</div>
            <div><span className="font-medium">Amount:</span> ฿{(order.payment?.amount || order.total || 0).toLocaleString('th-TH')}</div>
            <div><span className="font-medium">Reference:</span> {order.payment?.reference || '—'}</div>
          </div>
        </article>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl">
        <header className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Items</h2>
        </header>
        <div className="divide-y divide-slate-100 text-sm">
          {order.items.map((item) => (
            <div key={item.id} className="px-6 py-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-800">{item.name}</div>
                {item.modifiers && item.modifiers.length > 0 ? (
                  <div className="text-xs text-slate-500">{item.modifiers.join(', ')}</div>
                ) : null}
              </div>
              <div className="text-right">
                <div className="font-medium">x{item.quantity}</div>
                <div className="text-xs text-slate-500">฿{item.price.toLocaleString('th-TH')}</div>
              </div>
            </div>
          ))}
        </div>
        <footer className="px-6 py-4 border-t border-slate-200 text-right text-sm font-semibold text-slate-800">
          Total ฿{(order.total || 0).toLocaleString('th-TH')}
        </footer>
      </section>

      {order.history && order.history.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl">
          <header className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800">Status history</h2>
          </header>
          <ul className="divide-y divide-slate-100 text-sm">
            {order.history.map((entry, index) => (
              <li key={`${entry.status}-${index}`} className="px-6 py-3 flex justify-between">
                <div>
                  <div className="font-medium text-slate-700">{entry.status}</div>
                  {entry.updatedBy ? <div className="text-xs text-slate-500">By {entry.updatedBy}</div> : null}
                </div>
                <div className="text-xs text-slate-500">{new Date(entry.updatedAt).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
