import { useEffect } from 'react';
import { db } from '../lib/db';
import { insforge } from '../lib/insforge';

export default function SyncManager() {
  useEffect(() => {
    const syncTransactions = async () => {
      if (!navigator.onLine) return;

      try {
        const pendingTxs = await db.offline_transactions.where('status').equals('PENDING').toArray();
        if (pendingTxs.length === 0) return;

        // Process sequentially
        for (const tx of pendingTxs) {
          try {
            const payload = {
              id: tx.id,
              outletId: tx.outletId,
              staffId: tx.staffId,
              items: tx.items,
              paymentMethod: tx.paymentMethod,
              taxAmount: 0,
              discountAmount: 0, // Should store this accurately in payload next iteration
              cycleId: tx.cycleId
            };

            const response = await insforge.functions.invoke('process-transaction', {
              body: payload
            });

            if (response.error) throw response.error;

            // Delete from queue on success
            await db.offline_transactions.delete(tx.id);
            console.log(`[Sync] Successfully synced transaction: ${tx.id}`);
          } catch (err) {
            console.error(`[Sync] Failed to sync transaction: ${tx.id}`, err);
          }
        }
      } catch (err) {
        console.error('[Sync] Error accessing local DB', err);
      }
    };

    // Listen to online event
    window.addEventListener('online', syncTransactions);
    
    // Also try to sync occasionally (every 30s) if online
    const intervalId = setInterval(syncTransactions, 30000);

    // Initial check
    syncTransactions();

    return () => {
      window.removeEventListener('online', syncTransactions);
      clearInterval(intervalId);
    };
  }, []);

  return null; // Headless component
}
