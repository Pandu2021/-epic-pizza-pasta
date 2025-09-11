import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CartItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
  image?: string;
};

type CartState = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'qty'>, qty?: number) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clear: () => void;
  count: () => number;
  total: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item, qty = 1) => {
        const items = [...get().items];
        const idx = items.findIndex((it) => it.id === item.id);
        if (idx >= 0) {
          items[idx] = { ...items[idx], qty: items[idx].qty + qty };
        } else {
          items.push({ ...item, qty });
        }
        set({ items });
      },
      removeItem: (id) => set({ items: get().items.filter((i) => i.id !== id) }),
      updateQty: (id, qty) => {
        if (qty <= 0) return set({ items: get().items.filter((i) => i.id !== id) });
        set({ items: get().items.map((i) => (i.id === id ? { ...i, qty } : i)) });
      },
      clear: () => set({ items: [] }),
      count: () => get().items.reduce((n, it) => n + it.qty, 0),
      total: () => get().items.reduce((sum, it) => sum + it.qty * it.price, 0)
    }),
    { name: 'epic-pizza-cart' }
  )
);
