import { useQuery } from '@tanstack/react-query';
import { adminEndpoints } from '../../services/api';

type AuditLog = {
  id: string;
  actorEmail?: string | null;
  action: string;
  module?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
};

export default function AuditLogsPage() {
  const logsQuery = useQuery<AuditLog[]>({
    queryKey: ['admin', 'audit-logs'],
    retry: false,
    queryFn: async () => {
      try {
        const { data } = await adminEndpoints.listAuditLogs({ limit: 100 });
        if (!Array.isArray(data?.items)) {
          if (Array.isArray(data)) return data as AuditLog[];
          throw new Error('NOT_IMPLEMENTED');
        }
        return data.items as AuditLog[];
      } catch (err) {
        if ((err as any)?.response?.status === 404) {
          throw new Error('NOT_IMPLEMENTED');
        }
        throw err;
      }
    },
    refetchInterval: 120000,
  });

  const logs = logsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Audit Log</h1>
          <p className="text-sm text-slate-500">Track critical administrative actions for compliance and troubleshooting.</p>
        </div>
        <button type="button" className="btn-outline text-sm" onClick={() => logsQuery.refetch()}>Refresh</button>
      </div>

      {logsQuery.isError && (logsQuery.error as Error).message === 'NOT_IMPLEMENTED' && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-800">
          Audit endpoints are not ready yet. Implement <code>GET /api/admin/audit-logs</code> with pagination and filters.
        </div>
      )}

      {logsQuery.isError && (logsQuery.error as Error).message !== 'NOT_IMPLEMENTED' && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-6 text-red-700">
          Failed to load audit logs. {(logsQuery.error as Error).message}
        </div>
      )}

      {!logsQuery.isError && (
        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-left text-slate-500">
              <tr>
                <th className="px-6 py-3">Time</th>
                <th className="px-6 py-3">Actor</th>
                <th className="px-6 py-3">Action</th>
                <th className="px-6 py-3">Module</th>
                <th className="px-6 py-3">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logsQuery.isLoading && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400">Loading audit log…</td>
                </tr>
              )}
              {!logsQuery.isLoading && logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400">No audit entries yet.</td>
                </tr>
              )}
              {logs.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-xs text-slate-500">{new Date(row.createdAt).toLocaleString()}</td>
                  <td className="px-6 py-4 text-xs text-slate-500">{row.actorEmail || '—'}</td>
                  <td className="px-6 py-4 text-slate-800">{row.action}</td>
                  <td className="px-6 py-4 text-xs text-slate-500">{row.module || '—'}</td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    <pre className="bg-slate-900/80 text-slate-100 rounded-md px-3 py-2 overflow-auto max-w-xs">
                      {JSON.stringify(row.metadata ?? {}, null, 2)}
                    </pre>
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
