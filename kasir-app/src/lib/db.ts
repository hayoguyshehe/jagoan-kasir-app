import Dexie, { type EntityTable } from 'dexie';

// Define the interfaces for the tables
export interface OfflineProduct {
  id: string;
  name: string;
  price: number;
  type: string;
  stock: number;
  image_url?: string;
  category_id?: string;
  outlet_id: string;
}

export interface OfflineTransaction {
  id: string; // The generated UUID
  cycleId: string;
  staffId: string;
  outletId: string;
  paymentMethod: 'CASH' | 'QRIS_STATIC';
  items: Array<{
    productId: string;
    quantity: number;
    serveType: 'HOT' | 'COLD' | null;
  }>;
  voucherCode?: string | null;
  globalDiscount?: number;
  status: 'PENDING' | 'SYNCED' | 'FAILED';
  createdAt: number; // timestamp
}

// Setup the database
const db = new Dexie('JagoanKasirDB') as Dexie & {
  products: EntityTable<OfflineProduct, 'id'>;
  offline_transactions: EntityTable<OfflineTransaction, 'id'>;
};

// Define the schema
db.version(1).stores({
  products: 'id, name, type, category_id, outlet_id', // Primary key and indexed props
  offline_transactions: 'id, status, createdAt'
});

export { db };
