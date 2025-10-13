const rawAdminFlag = ((import.meta.env.VITE_IS_ADMIN ?? 'false') as string | boolean)
  .toString()
  .trim()
  .toLowerCase();

export const isAdminApp = rawAdminFlag === 'true' || rawAdminFlag === '1';

export const adminAllowedRoles = new Set(['admin', 'manager', 'staff']);

export const adminDefaultRoute = '/dashboard';
export const customerDefaultRoute = '/profile';
export const ADMIN_ROLE_ERROR = 'You do not have access to the admin console.';

export function isAdminRole(role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.toString().toLowerCase();
  return adminAllowedRoles.has(normalized);
}

export function getAdminUrl(): string | null {
  const envUrl = (import.meta.env.VITE_ADMIN_URL as string | undefined)?.trim();
  if (envUrl) return envUrl;

  if (isAdminApp && typeof window !== 'undefined') {
    return window.location.origin;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  const { location } = window;
  const host = location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  if (isLocal) {
    const port = location.port === '5174' ? location.port : '5174';
    return `${location.protocol}//${host}:${port}`;
  }

  if (host.startsWith('admin.')) {
    return `${location.protocol}//${host}`;
  }

  return `${location.protocol}//admin.${location.host}`;
}
