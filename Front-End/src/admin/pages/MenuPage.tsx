import { useQuery } from '@tanstack/react-query';
import { adminEndpoints } from '../../services/api';

type MenuItem = {
  id: string;
  category: string;
  name: Record<string, string> | string;
  basePrice: number;
  priceL?: number | null;
  priceXL?: number | null;
  isAvailable?: boolean;
  updatedAt: string;
};

function resolveName(name: MenuItem['name']) {
  if (!name) return 'Untitled item';
  if (typeof name === 'string') return name;
  return name.en || Object.values(name)[0] || 'Untitled item';
}

function formatPrice(value?: number | null) {
  if (typeof value !== 'number') return null;
  return value.toLocaleString('th-TH');
}

export default function MenuPage() {
  const menuQuery = useQuery<MenuItem[]>({
    queryKey: ['admin', 'menu'],
    queryFn: async () => {
      const { data } = await adminEndpoints.listMenu();
      if (!Array.isArray(data)) return [];
      return data as MenuItem[];
    },
    refetchInterval: 60000,
  });

  const items: MenuItem[] = menuQuery.data ?? [];

  const grouped = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const key = item.category || 'Uncategorized';
    acc[key] ||= [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Menu Manager</h1>
          <p className="text-sm text-slate-500">Review availability and pricing before rolling out promotions.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => window.alert('Use the upcoming CMS editor to add items.')}>Add item</button>
      </div>

      {menuQuery.isLoading && <div className="text-slate-500">Loading menu…</div>}

      {!menuQuery.isLoading && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No menu items found. Seed the database via prisma or add items from the CMS script.
        </div>
      )}

      {Object.entries(grouped).map(([category, rows]) => (
        <section key={category} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <header className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">{category}</h2>
              <p className="text-xs text-slate-500">{rows.length} items</p>
            </div>
            <button type="button" className="btn-outline text-xs" onClick={() => window.alert('Bulk edit coming soon.')}>Bulk edit</button>
          </header>
          <div className="divide-y divide-slate-100 text-sm">
            {rows.map((item) => (
              <article key={item.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-800">{resolveName(item.name)}</div>
                  <div className="text-xs text-slate-500">
                    Updated {new Date(item.updatedAt).toLocaleString()} · Base ฿{item.basePrice.toLocaleString('th-TH')}
                    {formatPrice(item.priceL) ? ` · L ฿${formatPrice(item.priceL)}` : ''}
                    {formatPrice(item.priceXL) ? ` · XL ฿${formatPrice(item.priceXL)}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${item.isAvailable === false ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
                    {item.isAvailable === false ? 'Unavailable' : 'Available'}
                  </span>
                  <button type="button" className="btn-outline text-xs" onClick={() => window.alert('Editor not ready. Update via prisma admin until backend endpoints are complete.')}>Edit</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
