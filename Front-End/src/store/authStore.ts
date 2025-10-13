import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { endpoints } from '../services/api';
import { ADMIN_ROLE_ERROR, isAdminApp, isAdminRole } from '../config/appConfig';

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  role?: string;
  phone?: string;
  lineUserId?: string;
  emailVerified?: boolean;
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  fetchMe: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

const STORAGE_KEY = isAdminApp ? 'epic-pizza-admin-auth' : 'epic-pizza-auth';
export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      loading: false,
      error: null,
      async fetchMe() {
        if (get().loading) return;
        set({ loading: true, error: null });
        try {
          const res = await endpoints.me();
          const user = (res.data?.user || null) as AuthUser | null;
          if (user && isAdminApp && !isAdminRole(user.role)) {
            set({ user: null, loading: false, error: ADMIN_ROLE_ERROR });
            return;
          }
          set({ user, loading: false });
        } catch {
          set({ user: null, loading: false });
        }
      },
      async login(email: string, password: string) {
        set({ loading: true, error: null });
        try {
          const payload: { email: string; password: string; context?: 'admin' } = { email, password };
          if (isAdminApp) payload.context = 'admin';
          const res = await endpoints.login(payload);
          if (res.data?.ok) {
            const loginUser = (res.data?.user || null) as AuthUser | null;
            if (loginUser) {
              if (isAdminApp && !isAdminRole(loginUser.role)) {
                await get().logout();
                set({ loading: false, error: ADMIN_ROLE_ERROR, user: null });
                return false;
              }
              set({ user: loginUser, error: null });
            }

            // After login, fetch profile to populate store in case backend info changed
            await get().fetchMe();
            const { user } = get();
            if (isAdminApp && !isAdminRole(user?.role)) {
              await get().logout();
              set({ loading: false, error: ADMIN_ROLE_ERROR });
              return false;
            }
            set({ loading: false, error: null });
            return true;
          } else {
            const reason = res.data?.reason;
            const errMsg = isAdminApp && (reason === 'insufficient_role' || reason === 'not_allowed')
              ? ADMIN_ROLE_ERROR
              : 'Invalid credentials';
            set({ error: errMsg, loading: false });
            return false;
          }
        } catch (err: any) {
          set({ error: err?.response?.data?.message || 'Login failed', loading: false });
          return false;
        }
      },
      async logout() {
        try { await endpoints.logout(); } catch {}
        set({ user: null, error: null });
      }
    }),
    { name: STORAGE_KEY, partialize: (state) => ({ user: state.user }) }
  )
);
