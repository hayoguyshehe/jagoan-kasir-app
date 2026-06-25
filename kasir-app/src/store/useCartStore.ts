import { create } from 'zustand';

export interface CartItem {
  product: any;
  quantity: number;
  notes?: string;
  serveType?: 'HOT' | 'COLD';
  addons?: any[];
  discountAmount?: number;
}

interface CartState {
  items: CartItem[];
  voucherCode: string | null;
  globalDiscount: number;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  setItemDiscount: (productId: string, discount: number) => void;
  setVoucherCode: (code: string | null) => void;
  setGlobalDiscount: (discount: number) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  voucherCode: null,
  globalDiscount: 0,
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
  setItemDiscount: (productId, discount) => set((state) => ({
    items: state.items.map((item) => 
      item.product.id === productId ? { ...item, discountAmount: discount } : item
    )
  })),
  setVoucherCode: (code) => set({ voucherCode: code }),
  setGlobalDiscount: (discount) => set({ globalDiscount: discount }),
  clearCart: () => set({ items: [], voucherCode: null, globalDiscount: 0 }),
  totalItems: () => {
    return get().items.reduce((total, item) => total + item.quantity, 0);
  },
  totalPrice: () => {
    const itemTotal = get().items.reduce((total, item) => total + (item.product.price * item.quantity) - (item.discountAmount || 0), 0);
    return Math.max(0, itemTotal - get().globalDiscount);
  }
}));
