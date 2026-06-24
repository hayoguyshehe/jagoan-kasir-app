import { create } from 'zustand';

export interface CartItem {
  product: any;
  quantity: number;
  notes?: string;
  serveType?: 'HOT' | 'COLD';
  addons?: any[];
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  addItem: (newItem) => set((state) => {
    const existingIndex = state.items.findIndex(
      (item) => item.product.id === newItem.product.id && item.serveType === newItem.serveType
    );
    
    if (existingIndex >= 0) {
      const updatedItems = [...state.items];
      updatedItems[existingIndex].quantity += newItem.quantity;
      return { items: updatedItems };
    }
    
    return { items: [...state.items, newItem] };
  }),
  removeItem: (productId) => set((state) => ({
    items: state.items.filter((item) => item.product.id !== productId)
  })),
  updateQuantity: (productId, quantity) => set((state) => ({
    items: state.items.map((item) => 
      item.product.id === productId ? { ...item, quantity } : item
    )
  })),
  clearCart: () => set({ items: [] }),
  totalItems: () => {
    return get().items.reduce((total, item) => total + item.quantity, 0);
  },
  totalPrice: () => {
    return get().items.reduce((total, item) => total + (item.product.price * item.quantity), 0);
  }
}));
