import { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from '../store/authStore';
import { ADMIN_ROLE_ERROR, adminDefaultRoute, isAdminRole } from '../config/appConfig';
import AdminLayout from './components/AdminLayout';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const OrderDetailPage = lazy(() => import('./pages/OrderDetailPage'));
const MenuPage = lazy(() => import('./pages/MenuPage'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'));
const AdminProfilePage = lazy(() => import('./pages/AdminProfilePage'));
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'));

function FullPageLoader({ message }: { message: string }) {
  return (
    <div className="min-h-screen grid place-items-center bg-slate-100 text-slate-600">
      <div className="text-center space-y-3">
        <div className="animate-spin h-10 w-10 rounded-full border-4 border-brand-primary/20 border-t-brand-primary mx-auto" aria-hidden="true" />
        <p className="font-medium" role="status" aria-live="polite">{message}</p>
      </div>
    </div>
  );
}

function UnauthorizedNotice() {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen grid place-items-center bg-slate-100 text-slate-600">
      <div className="bg-white shadow-xl rounded-lg p-8 max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold text-slate-800">Access restricted</h1>
        <p className="text-sm">{ADMIN_ROLE_ERROR}</p>
        <button type="button" className="btn-primary" onClick={() => logout()}>Sign out</button>
      </div>
    </div>
  );
}

function AdminProtectedRoutes() {
  const location = useLocation();
  const { user, fetchMe, loading } = useAuth();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let ignore = false;
    if (checked) return;
    (async () => {
      try {
        await fetchMe();
      } finally {
        if (!ignore) setChecked(true);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [checked, fetchMe]);

  if (!checked || loading) {
    return <FullPageLoader message="Authenticating…" />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!isAdminRole(user.role)) {
    return <UnauthorizedNotice />;
  }

  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
}

export default function AdminApp() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Suspense
        fallback={
          <FullPageLoader message="Loading admin console…" />
        }
      >
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={<AdminLoginPage />} />
          <Route element={<AdminProtectedRoutes />}>
            <Route index element={<Navigate to={adminDefaultRoute} replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/:orderId" element={<OrderDetailPage />} />
            <Route path="/menu" element={<MenuPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/account" element={<AdminProfilePage />} />
            <Route path="/audit-logs" element={<AuditLogsPage />} />
            <Route path="*" element={<Navigate to={adminDefaultRoute} replace />} />
          </Route>
        </Routes>
      </Suspense>
    </AnimatePresence>
  );
}
