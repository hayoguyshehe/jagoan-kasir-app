"use client";

import { useEffect, useState } from "react";
import { Plus, Edit, Trash2 } from "lucide-react";
import { insforge } from "@/lib/insforge";
import { useOutletContext } from "@/context/outlet-context";
import { OutletSelector } from "@/components/layout/outlet-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export default function VouchersPage() {
  const { selectedOutletId } = useOutletContext();
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState("NOMINAL");
  const [discountValue, setDiscountValue] = useState("");
  const [minPurchase, setMinPurchase] = useState("0");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [validUntil, setValidUntil] = useState("");

  useEffect(() => {
    if (selectedOutletId) {
      fetchVouchers();
    } else {
      setVouchers([]);
      setLoading(false);
    }
  }, [selectedOutletId]);

  const fetchVouchers = async () => {
    if (!selectedOutletId) return;
    setLoading(true);
    const { data, error } = await insforge.database
      .from("vouchers")
      .select("*")
      .eq("outlet_id", selectedOutletId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setVouchers(data || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setEditingId(null);
    setCode("");
    setDiscountType("NOMINAL");
    setDiscountValue("");
    setMinPurchase("0");
    setMaxDiscount("");
    setValidUntil("");
  };

  const handleEdit = (v: any) => {
    setEditingId(v.id);
    setCode(v.code);
    setDiscountType(v.discount_type);
    setDiscountValue(v.discount_value.toString());
    setMinPurchase(v.min_purchase.toString());
    setMaxDiscount(v.max_discount ? v.max_discount.toString() : "");
    setValidUntil(v.valid_until ? new Date(v.valid_until).toISOString().slice(0, 16) : "");
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus voucher ini?")) return;
    const { error } = await insforge.database.from("vouchers").delete().eq("id", id);
    if (!error) fetchVouchers();
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await insforge.database.from("vouchers").update({ is_active: !currentStatus }).eq("id", id);
    if (!error) fetchVouchers();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOutletId) {
      alert("Pilih outlet terlebih dahulu.");
      return;
    }

    const payload = {
      outlet_id: selectedOutletId,
      code: code.toUpperCase().trim(),
      discount_type: discountType,
      discount_value: parseInt(discountValue) || 0,
      min_purchase: parseInt(minPurchase) || 0,
      max_discount: maxDiscount ? parseInt(maxDiscount) : null,
      valid_until: validUntil ? new Date(validUntil).toISOString() : null,
      is_active: true,
    };

    if (editingId) {
      const { error } = await insforge.database
        .from("vouchers")
        .update(payload)
        .eq("id", editingId);
      if (error) {
        alert("Gagal update: " + error.message);
        return;
      }
    } else {
      const { error } = await insforge.database
        .from("vouchers")
        .insert(payload);
      if (error) {
        alert("Gagal insert: " + error.message);
        return;
      }
    }

    setIsDialogOpen(false);
    resetForm();
    fetchVouchers();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Manajemen Voucher</h1>
        <OutletSelector />
      </div>

      {!selectedOutletId ? (
        <div className="flex flex-col items-center justify-center h-64 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 dark:bg-gray-900">
          <p className="text-lg font-medium text-gray-500">Pilih outlet terlebih dahulu</p>
        </div>
      ) : (
        <>
          <div className="flex justify-end">
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button style={{ backgroundColor: process.env.NEXT_PUBLIC_PRIMARY_COLOR }}>
                  <Plus className="mr-2 h-4 w-4" /> Tambah Voucher
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingId ? "Edit Voucher" : "Tambah Voucher Baru"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Kode Promo</Label>
                    <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="MANTAP10" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipe Diskon</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={discountType}
                        onChange={(e) => setDiscountType(e.target.value)}
                      >
                        <option value="NOMINAL">Nominal (Rp)</option>
                        <option value="PERCENTAGE">Persentase (%)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Nilai Diskon</Label>
                      <Input type="number" min="0" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Min. Pembelian (Rp)</Label>
                      <Input type="number" min="0" value={minPurchase} onChange={(e) => setMinPurchase(e.target.value)} />
                    </div>
                    {discountType === 'PERCENTAGE' && (
                      <div className="space-y-2">
                        <Label>Maks. Diskon (Rp) - Opsional</Label>
                        <Input type="number" min="0" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Berlaku Hingga</Label>
                    <Input type="datetime-local" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button type="submit" style={{ backgroundColor: process.env.NEXT_PUBLIC_PRIMARY_COLOR }}>
                      Simpan
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="rounded-md border bg-white dark:bg-gray-950">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Nilai</TableHead>
                  <TableHead>Min. Beli</TableHead>
                  <TableHead>Berlaku Hingga</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24">Memuat...</TableCell>
                  </TableRow>
                ) : vouchers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24">Belum ada voucher di outlet ini.</TableCell>
                  </TableRow>
                ) : (
                  vouchers.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-bold text-emerald-600">{v.code}</TableCell>
                      <TableCell>{v.discount_type}</TableCell>
                      <TableCell>
                        {v.discount_type === 'NOMINAL' 
                          ? `Rp ${v.discount_value.toLocaleString("id-ID")}` 
                          : `${v.discount_value}%`}
                      </TableCell>
                      <TableCell>Rp {v.min_purchase.toLocaleString("id-ID")}</TableCell>
                      <TableCell>{v.valid_until ? new Date(v.valid_until).toLocaleDateString("id-ID") : 'Selamanya'}</TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          className={`h-6 px-2 text-xs font-bold rounded-full ${v.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'}`}
                          onClick={() => toggleActive(v.id, v.is_active)}
                        >
                          {v.is_active ? 'Aktif' : 'Nonaktif'}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(v)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(v.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
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
