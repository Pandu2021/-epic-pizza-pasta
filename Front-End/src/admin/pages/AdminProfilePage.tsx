import { useState } from 'react';
import { useAuth } from '../../store/authStore';

export default function AdminProfilePage() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Admin account</h1>
        <p className="text-sm text-slate-500">Your credentials for the operations console. Contact the platform owner to change roles.</p>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-600" htmlFor="admin-email">Email</label>
          <input id="admin-email" className="input mt-1" value={user?.email ?? ''} readOnly aria-readonly="true" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600" htmlFor="admin-name">Display name</label>
          <input id="admin-name" className="input mt-1" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600" htmlFor="admin-phone">Phone</label>
          <input id="admin-phone" className="input mt-1" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Contact number" />
        </div>
        <p className="text-xs text-slate-500">Profile updates are handled in the customer portal for now. Future iterations will sync admin-specific metadata.</p>
      </section>
    </div>
  );
}
