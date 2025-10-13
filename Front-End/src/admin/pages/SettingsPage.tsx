import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { adminEndpoints } from '../../services/api';

type SettingsPayload = Record<string, unknown>;

export default function SettingsPage() {
  const [form, setForm] = useState<Record<string, string>>({
    storeName: '',
    taxNumber: '',
    serviceFee: '',
    currency: 'THB',
  });

  const settingsQuery = useQuery<SettingsPayload | null>({
    queryKey: ['admin', 'settings'],
    retry: false,
    queryFn: async () => {
      try {
        const { data } = await adminEndpoints.getSettings();
        return (data as SettingsPayload) ?? null;
      } catch (err) {
        if ((err as any)?.response?.status === 404) {
          return null;
        }
        throw err;
      }
    },
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    const next = settingsQuery.data as Record<string, unknown>;
    setForm({
      storeName: String(next.storeName ?? ''),
      taxNumber: String(next.taxNumber ?? ''),
      serviceFee: String(next.serviceFee ?? ''),
      currency: String(next.currency ?? 'THB'),
    });
  }, [settingsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: async (payload: SettingsPayload) => {
      await adminEndpoints.updateSettings(payload);
    },
  });

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await updateMutation.mutateAsync({
        storeName: form.storeName,
        taxNumber: form.taxNumber,
        serviceFee: Number(form.serviceFee || 0),
        currency: form.currency,
      });
      window.alert('Settings saved.');
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to update settings. Check backend permissions.';
      window.alert(message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Settings</h1>
          <p className="text-sm text-slate-500">Manage storefront configuration, tax, printers, and integrations.</p>
        </div>
        <button type="button" className="btn-outline text-sm" onClick={() => window.alert('Printer configuration will be handled in the dedicated printers tab.')}>Printer test</button>
      </div>
      {settingsQuery.isLoading && <div className="text-slate-500">Loading settings…</div>}

      {settingsQuery.data === null && !settingsQuery.isLoading && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-800">
          Settings endpoint not available. Implement <code>GET /api/admin/settings</code> and <code>PATCH /api/admin/settings</code> to power this screen.
        </div>
      )}

      {settingsQuery.data !== null && (
        <form className="bg-white border border-slate-200 rounded-xl p-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="storeName" className="block text-sm font-medium text-slate-600">Store name</label>
            <input
              id="storeName"
              className="input mt-1"
              value={form.storeName}
              onChange={(event) => setForm((prev) => ({ ...prev, storeName: event.target.value }))}
              placeholder="Epic Pizza & Pasta"
            />
          </div>
          <div>
            <label htmlFor="taxNumber" className="block text-sm font-medium text-slate-600">Tax number</label>
            <input
              id="taxNumber"
              className="input mt-1"
              value={form.taxNumber}
              onChange={(event) => setForm((prev) => ({ ...prev, taxNumber: event.target.value }))}
              placeholder=""
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="serviceFee" className="block text-sm font-medium text-slate-600">Service fee (%)</label>
              <input
                id="serviceFee"
                className="input mt-1"
                value={form.serviceFee}
                onChange={(event) => setForm((prev) => ({ ...prev, serviceFee: event.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <label htmlFor="currency" className="block text-sm font-medium text-slate-600">Currency</label>
              <input
                id="currency"
                className="input mt-1"
                value={form.currency}
                onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))}
                placeholder="THB"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-outline" onClick={() => setForm({ storeName: '', taxNumber: '', serviceFee: '', currency: 'THB' })}>Reset</button>
            <button type="submit" className="btn-primary" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      )}
    </div>
  );
}
