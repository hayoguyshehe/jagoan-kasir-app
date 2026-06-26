import { useEffect, useState } from 'react';
import { RefreshCcw, XCircle, ChevronDown, ChevronUp, Printer } from 'lucide-react';
import { printReceipt } from '../lib/printer';
import { insforge } from '../lib/insforge';

export default function History() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTxn, setExpandedTxn] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    const { data: userData } = await insforge.auth.getCurrentUser();
    
    if (userData.user) {
      const { data } = await insforge.database
        .from('transactions')
        .select('*, transaction_items(*)')
        .eq('staff_id', userData.user.id)
        .order('created_at', { ascending: false })
        .limit(20);
        
      if (data) setTransactions(data);
    }
    setLoading(false);
  };

  const handleVoid = async (txnId: string) => {
    const pin = prompt("Enter your PIN to void this transaction:");
    if (!pin) return;
    
    const reason = prompt("Enter reason for voiding:");
    if (!reason) return;

    try {
      const session = await insforge.auth.getSession();
      const token = session.data.session?.access_token;
      
      const res = await fetch(`${import.meta.env.VITE_DASHBOARD_URL}/api/functions/void-transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          transactionId: txnId,
          pin,
          reason
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error! status: ${res.status}`);
      }
      
      alert('Transaction voided successfully!');
      fetchHistory();
    } catch (err: any) {
      alert(err.message || 'Failed to void transaction.');
    }
  };

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shift History</h1>
        <button onClick={fetchHistory} className="rounded-full bg-gray-100 p-2">
          <RefreshCcw className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {loading ? (
          <div className="text-center text-gray-500 py-10">Loading...</div>
        ) : transactions.length === 0 ? (
          <div className="text-center text-gray-500 py-10">No recent transactions.</div>
        ) : (
          transactions.map(txn => (
            <div 
              key={txn.id} 
              className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden"
            >
              <div 
                className="flex justify-between items-start p-4 cursor-pointer"
                onClick={() => setExpandedTxn(expandedTxn === txn.id ? null : txn.id)}
              >
                <div>
                  <div className="font-semibold text-gray-900 flex items-center gap-2">
                    {expandedTxn === txn.id ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
                    Rp {txn.total_amount?.toLocaleString('id-ID')}
                  </div>
                  <div className="text-xs text-gray-500 ml-6">{new Date(txn.created_at).toLocaleString('id-ID')}</div>
                  <div className="text-xs text-gray-400 ml-6 mt-1">ID: {txn.id.split('-')[0]}...</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-2 py-1 text-[10px] font-bold rounded-md ${
                    txn.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {txn.status}
                  </span>
                  
                  {txn.status === 'COMPLETED' && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleVoid(txn.id); }}
                      className="flex items-center text-xs font-semibold text-red-500 bg-red-50 px-2 py-1 rounded"
                    >
                      <XCircle className="h-3 w-3 mr-1" /> Void
                    </button>
                  )}
                </div>
              </div>
              
              {expandedTxn === txn.id && (
                <div className="bg-gray-50 p-4 border-t border-gray-100">
                  <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Order Items</h4>
                  <div className="space-y-2">
                    {txn.transaction_items?.map((item: any) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <div>
                          <div className="font-medium text-gray-900">
                            {item.quantity}x {item.product_name}
                          </div>
                          {item.serve_type && <div className="text-xs text-gray-500">{item.serve_type}</div>}
                        </div>
                        <div className="font-semibold text-gray-900">
                          Rp {item.subtotal?.toLocaleString('id-ID')}
                        </div>
                      </div>
                    ))}
                  </div>
                  {txn.status === 'VOIDED' && txn.void_reason && (
                    <div className="mt-3 p-2 bg-red-100 text-red-800 text-xs rounded border border-red-200">
                      <strong>Void Reason:</strong> {txn.void_reason}
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t border-gray-200 flex justify-end">
                    <button 
                      onClick={(e) => { e.stopPropagation(); printReceipt(txn, txn.transaction_items, import.meta.env.VITE_BRAND_NAME || 'Kasir App'); }}
                      className="flex items-center text-xs font-semibold text-gray-600 bg-white border border-gray-300 px-3 py-1.5 rounded-md hover:bg-gray-50"
                    >
                      <Printer className="h-3 w-3 mr-1.5" /> Cetak Struk
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
