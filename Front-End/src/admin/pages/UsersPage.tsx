import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { adminEndpoints } from '../../services/api';

type AdminUser = { id: string; email: string; role: string; name?: string | null; phone?: string | null; createdAt?: string };

export default function UsersPage() {
  const [roleFilter, setRoleFilter] = useState('all');

  const usersQuery = useQuery<AdminUser[]>({
    queryKey: ['admin', 'users', roleFilter],
    queryFn: async () => {
      const { data } = await adminEndpoints.listUsers();
      if (!Array.isArray(data)) return [];
      const rows = data as AdminUser[];
      if (roleFilter === 'all') return rows;
      return rows.filter((row) => row.role === roleFilter);
    },
    refetchInterval: 60000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await adminEndpoints.deleteUser(id);
    },
    onSuccess: () => usersQuery.refetch(),
  });

  const users: AdminUser[] = usersQuery.data ?? [];

  const handleDelete = async (user: AdminUser) => {
    if (!window.confirm(`Delete user ${user.email}? This cannot be undone.`)) return;
    try {
      await deleteMutation.mutateAsync(user.id);
      window.alert('User removed.');
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to delete user. Ensure backend roles guard allows this action.';
      window.alert(message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Users & Roles</h1>
          <p className="text-sm text-slate-500">Manage staff access. Only admin role can add or remove operators.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="roleFilter" className="text-slate-500">Role</label>
          <select id="roleFilter" className="input" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="staff">Staff</option>
            <option value="customer">Customer</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-left text-slate-500">
            <tr>
              <th className="px-6 py-3">User</th>
              <th className="px-6 py-3">Role</th>
              <th className="px-6 py-3">Phone</th>
              <th className="px-6 py-3">Created</th>
              <th className="px-6 py-3" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usersQuery.isLoading && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-slate-400">Loading users…</td>
              </tr>
            )}
            {!usersQuery.isLoading && users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-slate-400">No users match the selected filter.</td>
              </tr>
            )}
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-800">{user.name || user.email}</div>
                  <div className="text-xs text-slate-500">{user.email}</div>
                </td>
                <td className="px-6 py-4 capitalize">{user.role}</td>
                <td className="px-6 py-4 text-xs text-slate-500">{user.phone || '—'}</td>
                <td className="px-6 py-4 text-xs text-slate-500">{user.createdAt ? new Date(user.createdAt).toLocaleString() : '—'}</td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button type="button" className="btn-outline text-xs" onClick={() => window.alert('Editing users will be handled in upcoming iterations.')}>Edit</button>
                  <button
                    type="button"
                    className="btn-outline text-xs"
                    onClick={() => handleDelete(user)}
                    disabled={deleteMutation.isPending}
                  >
                    Remove
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
