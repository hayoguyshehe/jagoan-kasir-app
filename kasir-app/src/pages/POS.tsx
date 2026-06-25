// @ts-nocheck
import { useEffect, useState, useRef } from 'react';
import { ShoppingCart, Plus, Minus, Search, SlidersHorizontal, Heart, X, Check, Percent, DollarSign, Printer, Share2, MessageCircle, Flame, Snowflake, Wifi, WifiOff } from 'lucide-react';
import { insforge } from '../lib/insforge';
import { useCartStore } from '../store/useCartStore';
import { db } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// Receipt Component (Struk Visual)
// ============================================
function ReceiptView({ transaction, cartItems, cartTotal, discountAmount, discountType, paymentMethod, paidAmount, changeAmount, brandName, outletInfo, staffEmail, onClose, onShareWhatsApp }) {
  const receiptRef = useRef(null);
  const primaryColor = import.meta.env.VITE_PRIMARY_COLOR || '#000000';

  const handleShareWhatsApp = async () => {
    // Try native share first, fallback to wa.me link
    try {
      if (navigator.share) {
        const receiptText = generateReceiptText();
        await navigator.share({
          title: `Struk ${brandName}`,
          text: receiptText,
        });
      } else {
        const receiptText = encodeURIComponent(generateReceiptText());
        window.open(`https://wa.me/?text=${receiptText}`, '_blank');
      }
    } catch (err) {
      // User cancelled share or error
      const receiptText = encodeURIComponent(generateReceiptText());
      window.open(`https://wa.me/?text=${receiptText}`, '_blank');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const generateReceiptText = () => {
    const divider = '================================';
    const lines = [
      divider,
      `      ${brandName}`,
      outletInfo?.address ? `     ${outletInfo.address}` : '',
      outletInfo?.phone ? `      ${outletInfo.phone}` : '',
      divider,
      `Tanggal : ${new Date().toLocaleString('id-ID')}`,
      `Kasir   : ${staffEmail || '-'}`,
      `No      : ${transaction?.id?.split('-')[0] || 'TXN'}`,
      divider,
      ...cartItems.map(item => 
        `${item.product.name}${item.serveType ? ` ${item.serveType}` : ''} x${item.quantity}  Rp ${(item.product.price * item.quantity).toLocaleString('id-ID')}`
      ),
      '--------------------------------',
      `Subtotal            Rp ${cartTotal.toLocaleString('id-ID')}`,
      discountAmount > 0 ? `Diskon              Rp -${discountAmount.toLocaleString('id-ID')}` : '',
      '--------------------------------',
      `TOTAL               Rp ${(cartTotal - discountAmount).toLocaleString('id-ID')}`,
      `Bayar (${paymentMethod})   Rp ${paidAmount.toLocaleString('id-ID')}`,
      paymentMethod === 'CASH' ? `Kembalian            Rp ${changeAmount.toLocaleString('id-ID')}` : '',
      divider,
      '    Terima Kasih! 🙏',
      divider,
    ].filter(Boolean);
    return lines.join('\n');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Receipt Content */}
        <div ref={receiptRef} className="p-8 print:p-4">
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-extrabold" style={{ color: primaryColor }}>{brandName}</h2>
            {outletInfo?.address && <p className="text-sm text-gray-500 mt-1">{outletInfo.address}</p>}
            {outletInfo?.phone && <p className="text-sm text-gray-500">{outletInfo.phone}</p>}
          </div>

          <div className="border-t-2 border-dashed border-gray-300 my-4"></div>
          
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Tanggal</span>
            <span>{new Date().toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Kasir</span>
            <span>{staffEmail || '-'}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600 mb-4">
            <span>No. Transaksi</span>
            <span className="font-mono">{transaction?.id?.split('-')[0] || 'TXN'}</span>
          </div>

          <div className="border-t-2 border-dashed border-gray-300 my-4"></div>

          {/* Items */}
          <div className="space-y-3">
            {cartItems.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{item.product.name}</p>
                  {item.serveType && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {item.serveType === 'HOT' ? '🔥 Hot' : '❄️ Cold'}
                    </span>
                  )}
                  <p className="text-sm text-gray-500">
                    {item.quantity} × Rp {item.product.price.toLocaleString('id-ID')}
                  </p>
                </div>
                <span className="font-bold text-gray-900">
                  Rp {(item.product.price * item.quantity).toLocaleString('id-ID')}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t-2 border-dashed border-gray-300 my-4"></div>

          {/* Totals */}
          <div className="space-y-2">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>Rp {cartTotal.toLocaleString('id-ID')}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-red-500">
                <span>Diskon</span>
                <span>- Rp {discountAmount.toLocaleString('id-ID')}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-extrabold pt-2 border-t border-gray-200" style={{ color: primaryColor }}>
              <span>TOTAL</span>
              <span>Rp {(cartTotal - discountAmount).toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Bayar ({paymentMethod})</span>
              <span>Rp {paidAmount.toLocaleString('id-ID')}</span>
            </div>
            {paymentMethod === 'CASH' && changeAmount > 0 && (
              <div className="flex justify-between font-bold text-green-600">
                <span>Kembalian</span>
                <span>Rp {changeAmount.toLocaleString('id-ID')}</span>
              </div>
            )}
          </div>

          <div className="border-t-2 border-dashed border-gray-300 my-6"></div>
          
          <p className="text-center text-gray-500 text-sm">Terima Kasih! 🙏</p>
        </div>

        {/* Action Buttons (hidden on print) */}
        <div className="p-6 pt-0 flex gap-3 print:hidden">
          <button
            onClick={handleShareWhatsApp}
            className="flex-1 flex items-center justify-center gap-2 h-14 rounded-2xl bg-green-500 text-white font-bold shadow-lg active:scale-95 transition-transform"
          >
            <MessageCircle className="h-5 w-5" />
            WhatsApp
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 h-14 rounded-2xl bg-gray-100 text-gray-900 font-bold active:scale-95 transition-transform"
          >
            <Printer className="h-5 w-5" />
            Print
          </button>
        </div>
        <div className="p-6 pt-0 print:hidden">
          <button
            onClick={onClose}
            className="w-full h-14 rounded-2xl font-bold text-white active:scale-95 transition-transform"
            style={{ backgroundColor: primaryColor }}
          >
            Transaksi Baru
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Serve Type Picker Modal
// ============================================
function ServeTypePicker({ product, onSelect, onCancel, primaryColor }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8">
        <h3 className="text-xl font-extrabold text-center text-gray-900 mb-2">Pilih Suhu</h3>
        <p className="text-center text-gray-500 mb-8">{product.name}</p>
        
        <div className="flex gap-4">
          <button
            onClick={() => onSelect('HOT')}
            className="flex-1 flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-orange-200 bg-orange-50 hover:border-orange-400 hover:bg-orange-100 transition-all active:scale-95"
          >
            <Flame className="h-10 w-10 text-orange-500" />
            <span className="font-bold text-orange-700 text-lg">Hot</span>
          </button>
          <button
            onClick={() => onSelect('COLD')}
            className="flex-1 flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-blue-200 bg-blue-50 hover:border-blue-400 hover:bg-blue-100 transition-all active:scale-95"
          >
            <Snowflake className="h-10 w-10 text-blue-500" />
            <span className="font-bold text-blue-700 text-lg">Cold</span>
          </button>
        </div>

        <button
          onClick={onCancel}
          className="w-full mt-6 py-3 text-gray-500 font-medium hover:text-gray-900 transition-colors"
        >
          Batal
        </button>
      </div>
    </div>
  );
}

// ============================================
// Checkout / Payment Modal
// ============================================
function CheckoutModal({ cartItems, cartTotal, primaryColor, onClose, onConfirm }) {
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paidAmount, setPaidAmount] = useState('');
  const [discountType, setDiscountType] = useState('nominal'); // 'nominal' or 'percent'
  const [discountInput, setDiscountInput] = useState('');
  const qrisImage = import.meta.env.VITE_OUTLET_QRIS_IMAGE || '';

  const discountAmount = discountType === 'percent' 
    ? Math.round(cartTotal * (parseFloat(discountInput || '0') / 100))
    : parseInt(discountInput || '0');
  
  const finalTotal = Math.max(0, cartTotal - discountAmount);
  const paid = parseInt(paidAmount || '0');
  const changeAmount = Math.max(0, paid - finalTotal);
  const canProcess = paymentMethod === 'QRIS_STATIC' 
    ? true 
    : paid >= finalTotal;

  const quickAmounts = [finalTotal, ...([50000, 100000, 150000, 200000].filter(a => a > finalTotal))].slice(0, 4);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-extrabold text-gray-900">Pembayaran</h2>
            <button onClick={onClose} className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Discount Section */}
          <div className="mb-6 p-4 rounded-2xl bg-gray-50 border border-gray-100">
            <label className="text-sm font-bold text-gray-700 mb-3 block">Diskon (opsional)</label>
            <div className="flex gap-2">
              <div className="flex bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setDiscountType('nominal')}
                  className={`px-3 py-2 text-sm font-bold transition-colors ${discountType === 'nominal' ? 'text-white' : 'text-gray-500'}`}
                  style={discountType === 'nominal' ? { backgroundColor: primaryColor } : {}}
                >
                  Rp
                </button>
                <button
                  onClick={() => setDiscountType('percent')}
                  className={`px-3 py-2 text-sm font-bold transition-colors ${discountType === 'percent' ? 'text-white' : 'text-gray-500'}`}
                  style={discountType === 'percent' ? { backgroundColor: primaryColor } : {}}
                >
                  %
                </button>
              </div>
              <input
                type="number"
                inputMode="numeric"
                placeholder={discountType === 'percent' ? 'Contoh: 10' : 'Contoh: 5000'}
                value={discountInput}
                onChange={e => setDiscountInput(e.target.value)}
                className="flex-1 rounded-xl bg-white border border-gray-200 px-4 py-2 text-right font-bold focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': primaryColor }}
              />
            </div>
            {discountAmount > 0 && (
              <p className="mt-2 text-sm text-red-500 font-medium">
                Potongan: - Rp {discountAmount.toLocaleString('id-ID')}
              </p>
            )}
          </div>

          {/* Total */}
          <div className="flex justify-between items-center mb-6 p-4 rounded-2xl" style={{ backgroundColor: `${primaryColor}10` }}>
            <span className="font-bold text-gray-700 text-lg">Total Bayar</span>
            <span className="text-3xl font-extrabold" style={{ color: primaryColor }}>
              Rp {finalTotal.toLocaleString('id-ID')}
            </span>
          </div>

          {/* Payment Method */}
          <div className="mb-6">
            <label className="text-sm font-bold text-gray-700 mb-3 block">Metode Pembayaran</label>
            <div className="flex gap-3">
              <button
                onClick={() => setPaymentMethod('CASH')}
                className={`flex-1 p-4 rounded-2xl border-2 font-bold text-center transition-all ${
                  paymentMethod === 'CASH' ? 'border-current shadow-sm' : 'border-gray-200 text-gray-500'
                }`}
                style={paymentMethod === 'CASH' ? { borderColor: primaryColor, color: primaryColor, backgroundColor: `${primaryColor}08` } : {}}
              >
                💵 Tunai
              </button>
              <button
                onClick={() => { setPaymentMethod('QRIS_STATIC'); setPaidAmount(String(finalTotal)); }}
                className={`flex-1 p-4 rounded-2xl border-2 font-bold text-center transition-all ${
                  paymentMethod === 'QRIS_STATIC' ? 'border-current shadow-sm' : 'border-gray-200 text-gray-500'
                }`}
                style={paymentMethod === 'QRIS_STATIC' ? { borderColor: primaryColor, color: primaryColor, backgroundColor: `${primaryColor}08` } : {}}
              >
                📱 QRIS
              </button>
            </div>
          </div>

          {/* Cash: Input Nominal + Quick Amounts */}
          {paymentMethod === 'CASH' && (
            <div className="mb-6">
              <label className="text-sm font-bold text-gray-700 mb-3 block">Nominal Bayar</label>
              <input
                type="number"
                inputMode="numeric"
                placeholder="Masukkan nominal..."
                value={paidAmount}
                onChange={e => setPaidAmount(e.target.value)}
                className="w-full h-16 rounded-2xl bg-gray-50 border border-gray-200 px-6 text-2xl font-extrabold text-right focus:outline-none focus:ring-2 focus:bg-white transition-all"
                style={{ '--tw-ring-color': primaryColor }}
              />
              <div className="flex gap-2 mt-3">
                {quickAmounts.map(amount => (
                  <button
                    key={amount}
                    onClick={() => setPaidAmount(String(amount))}
                    className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-bold text-gray-700 hover:bg-gray-200 transition-colors active:scale-95"
                  >
                    {amount >= 1000 ? `${(amount / 1000).toLocaleString('id-ID')}K` : amount}
                  </button>
                ))}
              </div>
              {paid > 0 && paid >= finalTotal && (
                <div className="mt-4 p-4 rounded-2xl bg-green-50 border border-green-200 flex justify-between items-center">
                  <span className="font-bold text-green-700">Kembalian</span>
                  <span className="text-2xl font-extrabold text-green-600">
                    Rp {changeAmount.toLocaleString('id-ID')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* QRIS: Show QR Image */}
          {paymentMethod === 'QRIS_STATIC' && (
            <div className="mb-6 text-center">
              {qrisImage ? (
                <img src={qrisImage} alt="QRIS" className="mx-auto w-64 h-64 object-contain rounded-2xl border border-gray-200 p-2 bg-white" />
              ) : (
                <div className="mx-auto w-64 h-64 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-sm">
                  Gambar QRIS belum diatur<br/>di .env (VITE_OUTLET_QRIS_IMAGE)
                </div>
              )}
              <p className="mt-3 text-sm text-gray-500">Minta pelanggan scan QR Code di atas</p>
            </div>
          )}

          {/* Confirm Button */}
          <button
            onClick={() => onConfirm({ paymentMethod, paidAmount: paid || finalTotal, discountAmount, changeAmount, finalTotal })}
            disabled={!canProcess}
            className="w-full h-16 rounded-2xl text-white text-lg font-extrabold shadow-lg disabled:opacity-40 disabled:shadow-none active:scale-95 transition-all flex items-center justify-center gap-2"
            style={{ backgroundColor: primaryColor }}
          >
            <Check className="h-6 w-6" />
            Proses Pembayaran
          </button>
        </div>
      </div>
    </div>
  );
}


// ============================================
// Main POS Component
// ============================================
export default function POS() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [outletId, setOutletId] = useState(null);
  const [outletInfo, setOutletInfo] = useState(null);
  const [staffEmail, setStaffEmail] = useState('');

  // Offline/Online status
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Read products from Dexie (Offline-First)
  const products = useLiveQuery(
    () => outletId ? db.products.where('outlet_id').equals(outletId).toArray() : [],
    [outletId],
    []
  );

  // Serve Type Picker state
  const [serveTypeProduct, setServeTypeProduct] = useState(null);

  // Checkout modal state
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Receipt state
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTransaction, setLastTransaction] = useState(null);
  const [lastCartItems, setLastCartItems] = useState([]);
  const [lastCartTotal, setLastCartTotal] = useState(0);
  const [lastPaymentInfo, setLastPaymentInfo] = useState({});

  const cartItems = useCartStore((state) => state.items);
  const addToCart = useCartStore((state) => state.addItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const setItemDiscount = useCartStore((state) => state.setItemDiscount);
  const clearCart = useCartStore((state) => state.clearCart);
  const cartTotal = useCartStore((state) => state.totalPrice());

  const primaryColor = import.meta.env.VITE_PRIMARY_COLOR || '#000000';
  const brandName = import.meta.env.VITE_BRAND_NAME || 'Kasir';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: userData } = await insforge.auth.getCurrentUser();
      if (!userData.user) return;
      
      setStaffEmail(userData.user.email || '');

      const { data: userRecord } = await insforge.database
        .from("users")
        .select("outlet_id")
        .eq("id", userData.user.id)
        .single();
        
      if (userRecord?.outlet_id) {
        setOutletId(userRecord.outlet_id);
        
        // Fetch outlet info for receipt
        const { data: outlet } = await insforge.database
          .from('outlets')
          .select('name, address, phone')
          .eq('id', userRecord.outlet_id)
          .single();
        if (outlet) setOutletInfo(outlet);
      }

      // Fetch MENUs and ADDONs from server if online
      if (navigator.onLine) {
        const { data } = await insforge.database
          .from('products')
          .select('*')
          .in('type', ['MENU', 'ADDON'])
          .eq('is_active', true)
          .order('name');

        if (data) {
          // Sync to Dexie
          const localProducts = data.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            type: p.type,
            stock: p.stock,
            image_url: p.image_url,
            category_id: p.category_id,
            outlet_id: p.outlet_id
          }));
          await db.products.bulkPut(localProducts);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = (products || []).filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  // Handle product tap — check serve_type
  const handleProductTap = (product) => {
    if (product.serve_type === 'BOTH') {
      setServeTypeProduct(product);
    } else {
      addToCart({ product, quantity: 1, serveType: product.serve_type === 'HOT' ? 'HOT' : product.serve_type === 'COLD' ? 'COLD' : undefined });
    }
  };

  // Handle serve type selection
  const handleServeTypeSelect = (serveType) => {
    if (serveTypeProduct) {
      addToCart({ product: serveTypeProduct, quantity: 1, serveType });
      setServeTypeProduct(null);
    }
  };

  const handleProcessTransaction = async (paymentInfo) => {
    if (cartItems.length === 0 || !outletId) return;

    try {
      const { data: userData } = await insforge.auth.getCurrentUser();
      const transactionId = uuidv4();
      const payload = {
        id: transactionId,
        outletId,
        staffId: userData?.user?.id || staffEmail, // Fallback for offline if id missing
        items: cartItems.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          serveType: item.serveType || null,
          notes: item.notes || null,
          priceAtTime: item.product.price
        })),
        paymentMethod: paymentInfo.paymentMethod,
        taxAmount: 0,
        discountAmount: paymentInfo.discountAmount || 0
      };

      if (navigator.onLine) {
        // Try to process online
        try {
          const response = await insforge.functions.invoke('process-transaction', {
            body: payload
          });
          if (response.error) throw response.error;
          setLastTransaction(response.data?.transaction || { id: transactionId });
        } catch (serverErr) {
          console.error("Server error or timeout:", serverErr);
          // Fallback to offline queue
          await saveToOfflineQueue(transactionId, payload);
          setLastTransaction({ id: transactionId, isOffline: true });
        }
      } else {
        // Force offline queue
        await saveToOfflineQueue(transactionId, payload);
        setLastTransaction({ id: transactionId, isOffline: true });
      }

      // Show receipt
      setLastCartItems([...cartItems]);
      setLastCartTotal(cartTotal);
      setLastPaymentInfo(paymentInfo);
      
      clearCart();
      setIsCartOpen(false);
      setIsCheckoutOpen(false);
      setShowReceipt(true);
    } catch (err) {
      alert(err.message || 'Transaction failed');
    }
  };

  const saveToOfflineQueue = async (id, payload) => {
    await db.offline_transactions.add({
      id: id,
      cycleId: payload.cycleId || 'OFFLINE',
      staffId: payload.staffId,
      outletId: payload.outletId,
      paymentMethod: payload.paymentMethod,
      items: payload.items,
      status: 'PENDING',
      createdAt: Date.now()
    });
  };

  const handleCloseReceipt = () => {
    setShowReceipt(false);
    setLastTransaction(null);
    setLastCartItems([]);
    setLastCartTotal(0);
    setLastPaymentInfo({});
  };

  return (
    <div className="flex h-full w-full flex-col md:flex-row bg-[#F8FAFC]">
      {/* LEFT COLUMN: Main POS Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header / Search Area */}
        <div className="bg-transparent p-6 pb-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 text-green-600 shadow-sm" title="Online & Connected">
                <Wifi className="w-5 h-5" />
              </div>
            ) : (
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 text-red-600 shadow-sm" title="Offline Mode">
                <WifiOff className="w-5 h-5" />
              </div>
            )}
          </div>
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input 
              type="text" 
              placeholder="Search food..." 
              className="w-full rounded-2xl bg-white shadow-sm py-3.5 pl-12 pr-4 outline-none focus:ring-2 border-0"
              style={{ '--tw-ring-color': primaryColor }}
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

        {/* Categories */}
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
                  {/* Image Area */}
                  <div className="aspect-square w-full rounded-2xl bg-gray-50 mb-4 relative overflow-hidden flex items-center justify-center">
                    <span className="text-gray-300 font-medium text-4xl">
                      {product.name.charAt(0)}
                    </span>
                    {/* Serve type badge */}
                    {product.serve_type === 'BOTH' && (
                      <div className="absolute top-2 right-2 flex gap-1">
                        <span className="bg-orange-100 text-orange-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">🔥</span>
                        <span className="bg-blue-100 text-blue-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">❄️</span>
                      </div>
                    )}
                    {product.serve_type === 'HOT' && (
                      <span className="absolute top-2 right-2 bg-orange-100 text-orange-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">🔥 Hot</span>
                    )}
                    {product.serve_type === 'COLD' && (
                      <span className="absolute top-2 right-2 bg-blue-100 text-blue-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">❄️ Cold</span>
                    )}
                    {/* Stock warning */}
                    {product.stock <= 0 && (
                      <div className="absolute bottom-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Stok {product.stock}
                      </div>
                    )}
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
                      onClick={() => handleProductTap(product)}
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
                  {item.serveType && (
                    <span className="text-xs text-gray-500">
                      {item.serveType === 'HOT' ? '🔥 Hot' : '❄️ Cold'}
                    </span>
                  )}
                  <div className="text-sm font-semibold" style={{ color: primaryColor }}>
                    Rp {item.product.price?.toLocaleString('id-ID')}
                  </div>
                  {item.discountAmount > 0 && (
                    <div className="text-xs font-bold text-red-500">
                      Diskon: -Rp {item.discountAmount.toLocaleString('id-ID')}
                    </div>
                  )}
                  <button 
                    onClick={() => {
                      const disc = prompt('Masukkan diskon (Rp) untuk item ini:', item.discountAmount || '0');
                      if (disc !== null) setItemDiscount(item.product.id, parseInt(disc) || 0);
                    }}
                    className="text-[10px] text-gray-400 hover:text-gray-700 mt-1"
                  >
                    Set Diskon
                  </button>
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
            <div className="flex justify-between font-bold text-xl pt-3 border-t border-gray-200 mt-2">
              <span>Total Payment</span>
              <span style={{ color: primaryColor }}>Rp {cartTotal.toLocaleString('id-ID')}</span>
            </div>
          </div>
          
          <button 
            onClick={() => setIsCheckoutOpen(true)}
            disabled={cartItems.length === 0}
            className="w-full rounded-2xl py-4 text-white font-bold text-lg shadow-lg shadow-current/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{ backgroundColor: primaryColor }}
          >
            <ShoppingCart className="h-5 w-5" />
            Bayar Sekarang
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
                      {item.serveType && (
                        <span className="text-xs text-gray-500 mr-2">
                          {item.serveType === 'HOT' ? '🔥 Hot' : '❄️ Cold'}
                        </span>
                      )}
                      <div className="text-sm font-semibold" style={{ color: primaryColor }}>Rp {item.product.price?.toLocaleString('id-ID')}</div>
                      {item.discountAmount > 0 && (
                        <div className="text-xs font-bold text-red-500">
                          Diskon: -Rp {item.discountAmount.toLocaleString('id-ID')}
                        </div>
                      )}
                      <button 
                        onClick={() => {
                          const disc = prompt('Masukkan diskon (Rp) untuk item ini:', item.discountAmount || '0');
                          if (disc !== null) setItemDiscount(item.product.id, parseInt(disc) || 0);
                        }}
                        className="text-[10px] text-gray-400 hover:text-gray-700 mt-1"
                      >
                        Set Diskon
                      </button>
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
                onClick={() => { setIsCartOpen(false); setIsCheckoutOpen(true); }}
                disabled={cartItems.length === 0}
                className="w-full rounded-2xl py-4 text-white font-bold text-lg disabled:opacity-50 active:scale-95 transition-transform shadow-lg"
                style={{ backgroundColor: primaryColor }}
              >
                Bayar Sekarang
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

      {/* MODALS */}
      {serveTypeProduct && (
        <ServeTypePicker
          product={serveTypeProduct}
          onSelect={handleServeTypeSelect}
          onCancel={() => setServeTypeProduct(null)}
          primaryColor={primaryColor}
        />
      )}

      {isCheckoutOpen && (
        <CheckoutModal
          cartItems={cartItems}
          cartTotal={cartTotal}
          primaryColor={primaryColor}
          onClose={() => setIsCheckoutOpen(false)}
          onConfirm={handleProcessTransaction}
        />
      )}

      {showReceipt && (
        <ReceiptView
          transaction={lastTransaction}
          cartItems={lastCartItems}
          cartTotal={lastCartTotal}
          discountAmount={lastPaymentInfo.discountAmount || 0}
          paymentMethod={lastPaymentInfo.paymentMethod || 'CASH'}
          paidAmount={lastPaymentInfo.paidAmount || 0}
          changeAmount={lastPaymentInfo.changeAmount || 0}
          brandName={brandName}
          outletInfo={outletInfo}
          staffEmail={staffEmail}
          onClose={handleCloseReceipt}
        />
      )}
    </div>
  );
}
