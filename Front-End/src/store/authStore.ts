import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { endpoints } from '../services/api';

export type AuthUser = { id: string; email: string; name?: string; role?: string; phone?: string };

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  fetchMe: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

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
          set({ user, loading: false });
        } catch (e: any) {
          set({ user: null, loading: false });
        }
      },
      async login(email: string, password: string) {
        set({ loading: true, error: null });
        try {
          const res = await endpoints.login({ email, password });
          if (res.data?.ok) {
            // After login, fetch profile to populate store
            await get().fetchMe();
            set({ loading: false });
            return true;
          } else {
            set({ error: 'Invalid credentials', loading: false });
            return false;
          }
        } catch (e: any) {
          set({ error: e?.response?.data?.message || 'Login failed', loading: false });
          return false;
        }
      },
      async logout() {
        try { await endpoints.logout(); } catch {}
        set({ user: null });
      }
    }),
    { name: 'epic-pizza-auth', partialize: (state) => ({ user: state.user }) }
  )
);
