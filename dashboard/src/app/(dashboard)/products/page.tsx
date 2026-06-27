"use client";

import { useEffect, useState } from "react";
import { Plus, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getContrastColor } from "@/lib/utils";
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
import { Image as ImageIcon } from "lucide-react";

type Product = any;

export default function ProductsPage() {
  const { selectedOutletId } = useOutletContext();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("MENU");
  const [serveType, setServeType] = useState("BOTH");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (selectedOutletId) {
      fetchProducts();
    } else {
      setProducts([]);
      setLoading(false);
    }
  }, [selectedOutletId]);

  const fetchProducts = async () => {
    if (!selectedOutletId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("outlet_id", selectedOutletId)
      .order("name");

    if (error) {
      console.error(error);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setType("MENU");
    setServeType("BOTH");
    setPrice("");
    setStock("");
    setLowStockThreshold("5");
    setImageFile(null);
    setImagePreview(null);
  };

  const handleEdit = (p: Product) => {
    setEditingId(p.id);
    setName(p.name);
    setType(p.product_type);
    setServeType(p.serve_type || "BOTH");
    setPrice(p.price?.toString() || "");
    setStock(p.stock?.toString() || "0");
    setLowStockThreshold(p.low_stock_threshold?.toString() || "5");
    setImagePreview(p.image_url || null);
    setImageFile(null);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus produk ini?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (!error) fetchProducts();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOutletId) {
      alert("Pilih outlet terlebih dahulu.");
      return;
    }

    let finalImageUrl = editingId ? products.find(p => p.id === editingId)?.image_url : null;

    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `products/${selectedOutletId}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('foto')
        .upload(filePath, imageFile);

      if (uploadError) {
        console.error("UPLOAD ERROR:", uploadError);
        alert("Gagal upload foto: " + uploadError.message);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from('foto').getPublicUrl(filePath);
      finalImageUrl = publicUrlData?.publicUrl || '';
    }

    const payload = {
      outlet_id: selectedOutletId,
      name,
      product_type: type,
      serve_type: type === "MENU" ? serveType : "BOTH",
      price: price ? parseInt(price) : 0,
      stock: parseInt(stock) || 0,
      low_stock_threshold: parseInt(lowStockThreshold) || 5,
      is_active: true,
      ...(finalImageUrl && { image_url: finalImageUrl }),
    };

    if (editingId) {
      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", editingId);
      if (error) {
        console.error("UPDATE ERROR:", error);
        alert("Gagal update: " + error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from("products")
        .insert(payload);
      if (error) {
        console.error("INSERT ERROR:", error);
        alert("Gagal insert: " + error.message);
        return;
      }
    }

    setIsDialogOpen(false);
    resetForm();
    fetchProducts();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Produk</h1>
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
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
              {/* @ts-ignore */}
              <DialogTrigger asChild>
                <Button style={{ backgroundColor: process.env.NEXT_PUBLIC_PRIMARY_COLOR, color: getContrastColor(process.env.NEXT_PUBLIC_PRIMARY_COLOR) }}>
                  <Plus className="mr-2 h-4 w-4" /> Tambah Produk
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingId ? "Edit Produk" : "Tambah Produk Baru"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Nama Produk</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipe Produk</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                      >
                        <option value="MENU">Menu</option>
                        <option value="ACCESSORY">Accessory</option>
                        <option value="MATERIAL">Material / Bahan Baku</option>
                      </select>
                    </div>
                    {type === "MENU" && (
                      <div className="space-y-2">
                        <Label>Serve Type</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={serveType}
                          onChange={(e) => setServeType(e.target.value)}
                        >
                          <option value="BOTH">Both (Hot & Cold)</option>
                          <option value="HOT">Hot Only</option>
                          <option value="COLD">Cold Only</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Harga (Rp)</Label>
                      <Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Stok Awal</Label>
                      <Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Batas Peringatan Stok Menipis</Label>
                      <Input type="number" min="0" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} required />
                      <p className="text-xs text-gray-500">Notifikasi muncul jika stok ≤ batas ini</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Foto Produk</Label>
                    <div className="flex items-center gap-4">
                      {imagePreview && (
                        <img src={imagePreview} alt="Preview" className="h-16 w-16 object-cover rounded-md border" />
                      )}
                      <Input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setImageFile(file);
                            setImagePreview(URL.createObjectURL(file));
                          }
                        }} 
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button type="submit" style={{ backgroundColor: process.env.NEXT_PUBLIC_PRIMARY_COLOR, color: getContrastColor(process.env.NEXT_PUBLIC_PRIMARY_COLOR) }}>
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
                  <TableHead>Nama</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Serve</TableHead>
                  <TableHead>Harga</TableHead>
                  <TableHead>Stok</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">Memuat...</TableCell>
                  </TableRow>
                ) : products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">Belum ada produk di outlet ini.</TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium flex items-center gap-3">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="h-10 w-10 object-cover rounded-md bg-gray-100" />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-gray-100 flex items-center justify-center text-gray-400">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                        )}
                        {product.name}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                          {product.product_type}
                        </span>
                      </TableCell>
                      <TableCell>{product.serve_type}</TableCell>
                      <TableCell>{product.price ? `Rp ${product.price.toLocaleString("id-ID")}` : "-"}</TableCell>
                      <TableCell>{product.stock}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(product)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(product.id)}>
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
