import { useEffect, useState } from 'react';
import { RefreshCcw, XCircle } from 'lucide-react';
import { insforge } from '../lib/insforge';

export default function History() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    const { data: userData } = await insforge.auth.getCurrentUser();
    
    if (userData.user) {
      const { data } = await insforge.database
        .from('transactions')
        .select('*')
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
      const response = await insforge.functions.invoke('void-transaction', {
        body: {
          transactionId: txnId,
          pin,
          reason
        }
      });

      if (response.error) throw response.error;
      
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
            <div key={txn.id} className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-semibold text-gray-900">Rp {txn.total_amount?.toLocaleString('id-ID')}</div>
                  <div className="text-xs text-gray-500">{new Date(txn.created_at).toLocaleString('id-ID')}</div>
                  <div className="text-xs text-gray-400 mt-1">ID: {txn.id.split('-')[0]}...</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-2 py-1 text-[10px] font-bold rounded-md ${
                    txn.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {txn.status}
                  </span>
                  
                  {txn.status === 'COMPLETED' && (
                    <button 
                      onClick={() => handleVoid(txn.id)}
                      className="flex items-center text-xs font-semibold text-red-500"
                    >
                      <XCircle className="h-4 w-4 mr-1" /> Void
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
