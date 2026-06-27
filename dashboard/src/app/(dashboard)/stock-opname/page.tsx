"use client";

import { useEffect, useState } from "react";
import { ListPlus } from "lucide-react";
import { insforge } from "@/lib/insforge";
import { getContrastColor } from "@/lib/utils";
import { useOutletContext } from "@/context/outlet-context";
import { OutletSelector } from "@/components/layout/outlet-selector";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

type Log = any;
type Product = any;

export default function StockOpnamePage() {
  const { selectedOutletId, userId } = useOutletContext();
  const [logs, setLogs] = useState<Log[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form State
  const [selectedProductId, setSelectedProductId] = useState("");
  const [newStock, setNewStock] = useState("");
  const [adjustmentType, setAdjustmentType] = useState("CORRECTION");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (selectedOutletId) {
      fetchData();
    } else {
      setLogs([]);
      setProducts([]);
      setLoading(false);
    }
  }, [selectedOutletId]);

  const fetchData = async () => {
    if (!selectedOutletId) return;
    setLoading(true);
    
    const { data: logsData } = await insforge
      .from("stock_adjustment_logs")
      .select("*, product:products(name), user:users(email)")
      .eq("outlet_id", selectedOutletId)
      .order("created_at", { ascending: false });
      
    const { data: productsData } = await insforge
      .from("products")
      .select("*")
      .eq("outlet_id", selectedOutletId)
      .order("name");

    if (logsData) setLogs(logsData);
    if (productsData) setProducts(productsData);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedOutletId || !userId || !selectedProductId) {
      alert("Pilih outlet dan produk terlebih dahulu.");
      return;
    }

    try {
      // Because Edge Function stock-opname doesn't exist yet, we do direct DB insert for now.
      const targetProduct = products.find(p => p.id === selectedProductId);
      if (!targetProduct) throw new Error("Produk tidak ditemukan");

      const oldStock = targetProduct.stock;
      const parsedNewStock = parseInt(newStock);

      // 1. Insert to stock_adjustment_logs
      const { error: logError } = await insforge
        .from("stock_adjustment_logs")
        .insert({
          product_id: selectedProductId,
          outlet_id: selectedOutletId,
          adjusted_by: userId,
          old_stock: oldStock,
          new_stock: parsedNewStock,
          adjustment_type: adjustmentType,
          reason,
        });
      
      if (logError) throw logError;

      // 2. Update stock in products table
      const { error: updateError } = await insforge
        .from("products")
        .update({ stock: parsedNewStock })
        .eq("id", selectedProductId);

      if (updateError) throw updateError;
      
      setIsDialogOpen(false);
      setSelectedProductId("");
      setNewStock("");
      setAdjustmentType("CORRECTION");
      setReason("");
      fetchData();
    } catch (err: any) {
      alert(err.message || "Gagal melakukan stok opname");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Stock Opname Logs</h1>
        <OutletSelector />
      </div>

      {!selectedOutletId ? (
        <div className="flex flex-col items-center justify-center h-64 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 dark:bg-gray-900">
          <p className="text-lg font-medium text-gray-500">Pilih outlet terlebih dahulu</p>
          <p className="text-sm text-gray-400 mt-1">Gunakan dropdown di atas untuk memilih outlet</p>
        </div>
      ) : (
        <>
          <div className="flex justify-end">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              {/* @ts-ignore */}
              <DialogTrigger asChild>
                <Button style={{ backgroundColor: process.env.NEXT_PUBLIC_PRIMARY_COLOR, color: getContrastColor(process.env.NEXT_PUBLIC_PRIMARY_COLOR) }}>
                  <ListPlus className="mr-2 h-4 w-4" /> Stok Opname Baru
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Lakukan Stok Opname</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Produk</Label>
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      required
                    >
                      <option value="" disabled>Pilih produk...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (Stok saat ini: {p.stock})</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Stok Fisik (Aktual)</Label>
                      <Input 
                        type="number" 
                        value={newStock} 
                        onChange={(e) => setNewStock(e.target.value)} 
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipe Penyesuaian</Label>
                      <select 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                        value={adjustmentType}
                        onChange={(e) => setAdjustmentType(e.target.value)}
                      >
                        <option value="CORRECTION">Correction (Koreksi salah catat)</option>
                        <option value="RESTOCK">Restock (Barang masuk)</option>
                        <option value="DAMAGE">Damage (Barang rusak)</option>
                        <option value="LOSS">Loss (Barang hilang)</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Alasan / Catatan</Label>
                    <Input value={reason} onChange={e => setReason(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" style={{ backgroundColor: process.env.NEXT_PUBLIC_PRIMARY_COLOR, color: getContrastColor(process.env.NEXT_PUBLIC_PRIMARY_COLOR) }}>
                    Simpan Stok Opname
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="rounded-md border bg-white dark:bg-gray-950">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Produk</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Stok Lama</TableHead>
                  <TableHead>Stok Baru</TableHead>
                  <TableHead>Alasan</TableHead>
                  <TableHead>Oleh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center h-24">Memuat...</TableCell></TableRow>
                ) : logs.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center h-24">Belum ada riwayat stok opname.</TableCell></TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{new Date(log.created_at).toLocaleString("id-ID")}</TableCell>
                      <TableCell className="font-medium">{log.product?.name}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                          {log.adjustment_type}
                        </span>
                      </TableCell>
                      <TableCell>{log.old_stock}</TableCell>
                      <TableCell className="font-bold">{log.new_stock}</TableCell>
                      <TableCell>{log.reason || "-"}</TableCell>
                      <TableCell>{log.user?.email || "Unknown"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
