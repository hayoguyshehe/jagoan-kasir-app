// @ts-nocheck
import { useEffect, useState } from 'react';
import { ShoppingCart, Plus, Minus, Search, SlidersHorizontal, Heart, Trash2 } from 'lucide-react';
import { insforge } from '../lib/insforge';
import { useCartStore } from '../store/useCartStore';

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
    <div className="flex h-full w-full flex-col md:flex-row bg-[#F8FAFC]">
      {/* LEFT COLUMN: Main POS Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header / Search Area */}
        <div className="bg-transparent p-6 pb-2 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input 
              type="text" 
              placeholder="Search food..." 
              className="w-full rounded-2xl bg-white shadow-sm py-3.5 pl-12 pr-4 outline-none focus:ring-2 border-0"
              style={{ '--tw-ring-color': primaryColor } as any}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button 
            className="hidden sm:flex items-center gap-2 px-6 py-3.5 rounded-2xl text-white font-medium shadow-sm transition-transform active:scale-95"
            style={{ backgroundColor: primaryColor }}
          >
            Filter
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>

        {/* Categories (Mocked for visual) */}
        <div className="px-6 py-4">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Explore Categories</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {['All', 'Coffee', 'Tea', 'Snacks', 'Dessert'].map((cat, idx) => (
              <button 
                key={cat}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl whitespace-nowrap font-medium transition-all duration-200 border ${
                  idx === 0 
                    ? 'bg-white shadow-sm' 
                    : 'bg-transparent border-transparent text-gray-500 hover:bg-white hover:shadow-sm hover:text-gray-900'
                }`}
                style={idx === 0 ? { borderColor: primaryColor, color: primaryColor, backgroundColor: `${primaryColor}08` } : {}}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto px-6 pb-24 md:pb-6">
          <div className="flex gap-6 border-b border-gray-200 mb-6">
            <button className="pb-3 border-b-2 font-bold text-gray-900" style={{ borderBottomColor: primaryColor }}>
              Popular
            </button>
            <button className="pb-3 text-gray-500 font-medium hover:text-gray-900 transition-colors">
              Recent
            </button>
          </div>

          {loading ? (
            <div className="flex h-40 items-center justify-center">Loading...</div>
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product) => (
                <div 
                  key={product.id} 
                  className="flex flex-col rounded-3xl bg-white p-4 shadow-sm border border-gray-100 group transition-all duration-300 hover:shadow-md"
                >
                  {/* Mock Image Area */}
                  <div className="aspect-square w-full rounded-2xl bg-gray-50 mb-4 relative overflow-hidden flex items-center justify-center">
                    <span className="text-gray-300 font-medium text-4xl">
                      {product.name.charAt(0)}
                    </span>
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 leading-tight mb-1 truncate" title={product.name}>
                      {product.name}
                    </h3>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="font-bold text-lg" style={{ color: primaryColor }}>
                        Rp {product.price?.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-auto">
                    <button className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Heart className="h-5 w-5" />
                    </button>
                    <button 
                      onClick={() => addToCart({ product, quantity: 1, serveType: 'HOT' })}
                      className="flex-1 h-11 rounded-2xl text-white font-bold text-sm shadow-sm transition-transform active:scale-95 flex items-center justify-center"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Order Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Invoice / Cart (Desktop) */}
      <div className="hidden md:flex w-80 lg:w-96 flex-col bg-white border-l border-gray-100 shadow-xl z-20 rounded-l-[2rem] my-4 mr-4 overflow-hidden h-[calc(100vh-2rem)]">
        <div className="p-6 border-b border-gray-50">
          <h2 className="text-2xl font-bold text-gray-900">Invoice</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cartItems.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-gray-400 space-y-4">
              <ShoppingCart className="h-16 w-16 opacity-20" />
              <p>No items in order</p>
            </div>
          ) : (
            cartItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-4 group">
                <div className="h-16 w-16 rounded-2xl bg-gray-50 flex items-center justify-center flex-shrink-0 border border-gray-100">
                  <span className="text-xl font-bold text-gray-300">{item.product.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-gray-900 truncate">{item.product.name}</h4>
                  <div className="text-sm font-semibold" style={{ color: primaryColor }}>
                    Rp {item.product.price?.toLocaleString('id-ID')}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-1">
                    <button 
                      onClick={() => updateQuantity(item.product.id, Math.max(0, item.quantity - 1))}
                      className="h-6 w-6 rounded-lg bg-white flex items-center justify-center shadow-sm text-gray-500 hover:text-gray-900"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-4 text-center font-bold text-sm">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      className="h-6 w-6 rounded-lg bg-white flex items-center justify-center shadow-sm text-gray-500 hover:text-gray-900"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-gray-50/50">
          <div className="space-y-3 mb-6">
            <h3 className="font-bold text-gray-900 mb-4">Payment Summary</h3>
            <div className="flex justify-between text-gray-500 font-medium">
              <span>Sub Total</span>
              <span className="text-gray-900">Rp {cartTotal.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-gray-500 font-medium">
              <span>Tax (0%)</span>
              <span className="text-gray-900">Rp 0</span>
            </div>
            <div className="flex justify-between font-bold text-xl pt-3 border-t border-gray-200 mt-2">
              <span>Total Payment</span>
              <span style={{ color: primaryColor }}>Rp {cartTotal.toLocaleString('id-ID')}</span>
            </div>
          </div>
          
          <button 
            onClick={handleProcessTransaction}
            disabled={cartItems.length === 0}
            className="w-full rounded-2xl py-4 text-white font-bold text-lg shadow-lg shadow-current/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{ backgroundColor: primaryColor }}
          >
            <ShoppingCart className="h-5 w-5" />
            Place An Order Now
          </button>
        </div>
      </div>

      {/* MOBILE CART OVERLAY */}
      {isCartOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col bg-gray-900/50 backdrop-blur-sm">
          <div className="mt-auto h-[85%] rounded-t-3xl bg-white p-5 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between pb-4">
              <h2 className="text-2xl font-bold">Current Order</h2>
              <button onClick={() => setIsCartOpen(false)} className="rounded-full bg-gray-100 p-2 hover:bg-gray-200 transition-colors">
                <Minus className="h-6 w-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto py-2 space-y-4">
              {cartItems.length === 0 ? (
                <div className="text-center text-gray-400 py-10 flex flex-col items-center gap-4">
                  <ShoppingCart className="h-12 w-12 opacity-50" />
                  <p>Cart is empty</p>
                </div>
              ) : (
                cartItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div className="flex-1 pr-4">
                      <div className="font-bold text-gray-900 leading-tight mb-1">{item.product.name}</div>
                      <div className="text-sm font-semibold" style={{ color: primaryColor }}>Rp {item.product.price?.toLocaleString('id-ID')}</div>
                    </div>
                    <div className="flex items-center gap-3 bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                      <button 
                        onClick={() => updateQuantity(item.product.id, Math.max(0, item.quantity - 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="font-bold w-6 text-center">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-gray-100 mt-2">
              <div className="flex justify-between font-bold text-2xl mb-6">
                <span>Total</span>
                <span style={{ color: primaryColor }}>Rp {cartTotal.toLocaleString('id-ID')}</span>
              </div>
              <button 
                onClick={handleProcessTransaction}
                disabled={cartItems.length === 0}
                className="w-full rounded-2xl py-4 text-white font-bold text-lg disabled:opacity-50 active:scale-95 transition-transform shadow-lg"
                style={{ backgroundColor: primaryColor }}
              >
                Place Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Cart Button (Mobile Only) */}
      {!isCartOpen && cartItems.length > 0 && (
        <div className="md:hidden fixed bottom-24 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-40">
          <button 
            onClick={() => setIsCartOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl px-6 py-4 text-white shadow-xl active:scale-95 transition-transform"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                <ShoppingCart className="h-6 w-6" />
              </div>
              <div className="flex flex-col items-start">
                <span className="font-bold">{cartItems.length} items</span>
                <span className="text-xs opacity-80">View Cart</span>
              </div>
            </div>
            <span className="font-bold text-lg">Rp {cartTotal.toLocaleString('id-ID')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
