// @ts-nocheck
import { useEffect, useState } from 'react';
import { ShoppingCart, Plus, Minus, Search } from 'lucide-react';
import { insforge } from '../lib/insforge';
import { useCartStore, type CartItem } from '../store/useCartStore';

export default function POS() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [outletId, setOutletId] = useState<string | null>(null);

  const cartItems = useCartStore((state) => state.items);
  const addToCart = useCartStore((state) => state.addItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const clearCart = useCartStore((state) => state.clearCart);
  const cartTotal = useCartStore((state) => state.totalPrice());

  const primaryColor = import.meta.env.VITE_PRIMARY_COLOR || '#000000';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: userData } = await insforge.auth.getCurrentUser();
      if (!userData.user) return;
      
      const { data: userRecord } = await insforge.database
        .from("users")
        .select("outlet_id")
        .eq("id", userData.user.id)
        .single();
        
      if (userRecord?.outlet_id) {
        setOutletId(userRecord.outlet_id);
      }

      // Fetch MENUs and ADDONs
      const { data } = await insforge.database
        .from('products')
        .select('*')
        .in('type', ['MENU', 'ADDON'])
        .eq('is_active', true)
        .order('name');

      if (data) setProducts(data);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const handleProcessTransaction = async () => {
    if (cartItems.length === 0 || !outletId) return;

    try {
      const { data: userData } = await insforge.auth.getCurrentUser();
      
      const payload = {
        outletId,
        staffId: userData.user?.id,
        items: cartItems.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          serveType: item.serveType || null,
          notes: item.notes || null,
          priceAtTime: item.product.price
        })),
        paymentMethod: 'CASH', // Hardcoded for now
        taxAmount: 0,
        discountAmount: 0
      };

      const response = await insforge.functions.invoke('process-transaction', {
        body: payload
      });

      if (response.error) throw response.error;
      
      alert('Transaction successful!');
      clearCart();
      setIsCartOpen(false);
    } catch (err: any) {
      alert(err.message || 'Transaction failed');
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input 
            type="text" 
            placeholder="Search menu..." 
            className="w-full rounded-full bg-gray-100 py-2 pl-10 pr-4 outline-none focus:ring-2"
            style={{ '--tw-ring-color': primaryColor } as any}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">Loading...</div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {filteredProducts.map((product) => (
              <div 
                key={product.id} 
                onClick={() => addToCart({ product, quantity: 1, serveType: 'HOT' })}
                className="flex flex-col rounded-xl bg-white p-4 shadow-sm active:scale-95 transition-transform"
              >
                <div className="flex-1">
                  <div className="text-xs font-semibold text-gray-500">{product.type}</div>
                  <h3 className="font-bold leading-tight mt-1">{product.name}</h3>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="font-bold text-gray-900" style={{ color: primaryColor }}>
                    Rp {product.price?.toLocaleString('id-ID')}
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                    <Plus className="h-4 w-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cart Modal/Overlay */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-900/50">
          <div className="mt-auto h-4/5 rounded-t-3xl bg-white p-4 shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-xl font-bold">Current Order</h2>
              <button onClick={() => setIsCartOpen(false)} className="rounded-full bg-gray-100 p-2">
                <Minus className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {cartItems.length === 0 ? (
                <div className="text-center text-gray-500 py-10">Cart is empty</div>
              ) : (
                cartItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-50 p-3 rounded-xl">
                    <div className="flex-1">
                      <div className="font-bold">{item.product.name}</div>
                      <div className="text-sm text-gray-500">Rp {item.product.price?.toLocaleString('id-ID')}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => updateQuantity(item.product.id, Math.max(0, item.quantity - 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="font-bold w-6 text-center">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between font-bold text-xl mb-4">
                <span>Total</span>
                <span>Rp {cartTotal.toLocaleString('id-ID')}</span>
              </div>
              <button 
                onClick={handleProcessTransaction}
                disabled={cartItems.length === 0}
                className="w-full rounded-full py-4 text-white font-bold text-lg disabled:opacity-50"
                style={{ backgroundColor: primaryColor }}
              >
                Process Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Cart Button (when not open) */}
      {!isCartOpen && cartItems.length > 0 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-[90%] max-w-sm">
          <button 
            onClick={() => setIsCartOpen(true)}
            className="flex w-full items-center justify-between rounded-full px-6 py-4 text-white shadow-lg"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-6 w-6" />
              <span className="font-bold">{cartItems.length} items</span>
            </div>
            <span className="font-bold">Rp {cartTotal.toLocaleString('id-ID')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
