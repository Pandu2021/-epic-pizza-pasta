import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  ClipboardDocumentCheckIcon,
  CurrencyDollarIcon,
  DocumentMagnifyingGlassIcon,
  Cog6ToothIcon,
  UsersIcon,
  Squares2X2Icon,
  BookmarkSquareIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../store/authStore';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: Squares2X2Icon },
  { to: '/orders', label: 'Orders', icon: ClipboardDocumentCheckIcon },
  { to: '/menu', label: 'Menu', icon: BookmarkSquareIcon },
  { to: '/payments', label: 'Payments', icon: CurrencyDollarIcon },
  { to: '/users', label: 'Users & Roles', icon: UsersIcon },
  { to: '/audit-logs', label: 'Audit Logs', icon: DocumentMagnifyingGlassIcon },
  { to: '/settings', label: 'Settings', icon: Cog6ToothIcon },
];

type Props = { children: ReactNode };

export default function AdminLayout({ children }: Props) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex">
      <aside className="hidden md:flex md:flex-col w-64 bg-slate-900 text-slate-100">
        <div className="px-6 py-5 border-b border-white/10">
          <div className="text-lg font-semibold">Epic Pizza Admin</div>
          <div className="text-xs text-slate-300 mt-1">Operations Console</div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="px-4 py-5 border-t border-white/10 text-xs text-slate-400">
          Powered by Epic Pizza & Pasta
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="bg-white shadow-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Signed in as</div>
              <div className="font-semibold text-slate-800">{user?.name || user?.email}</div>
              {user?.role && <div className="text-xs uppercase tracking-wide text-slate-400">{user.role}</div>}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="btn-outline hidden sm:inline-flex items-center gap-2"
                onClick={() => navigate('/settings/account')}
              >
                <Cog6ToothIcon className="h-5 w-5" aria-hidden="true" /> Account
              </button>
              <button
                type="button"
                className="btn-outline inline-flex items-center gap-2"
                onClick={() => logout()}
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" aria-hidden="true" /> Sign out
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
