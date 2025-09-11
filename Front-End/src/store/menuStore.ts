import { create } from 'zustand';
import { api } from '../services/api';

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
};

type State = {
  items: MenuItem[];
  loading: boolean;
  fetchMenu: () => Promise<void>;
};

export const useMenu = create<State>((set) => ({
  items: [],
  loading: false,
  fetchMenu: async () => {
    set({ loading: true });
    try {
      const res = await api.get('/menu');
      const items = (res.data as any[]).map((it) => ({
        id: it.id as string,
        name: (it.name?.en || it.name) as string,
        description: (it.description?.en || '') as string,
        price: (it.basePrice ?? it.priceL ?? it.priceXL ?? 0) as number,
      }));
      set({ items, loading: false });
    } catch (e) {
      set({ loading: false });
      console.error('Failed to fetch menu', e);
    }
  }
}));
