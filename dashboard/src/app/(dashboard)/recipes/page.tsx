"use client";

import { useEffect, useState } from "react";
import { ListPlus, Trash2 } from "lucide-react";
import { insforge } from "@/lib/insforge";
import { useOutletContext } from "@/context/outlet-context";
import { OutletSelector } from "@/components/layout/outlet-selector";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type Product = any;
type RecipeItem = any;

export default function RecipesPage() {
  const { selectedOutletId } = useOutletContext();
  const [menus, setMenus] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedMenu, setSelectedMenu] = useState<Product | null>(null);
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // New Recipe Form
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [serveType, setServeType] = useState<"HOT" | "COLD" | "ALL">("ALL");

  useEffect(() => {
    if (selectedOutletId) {
      fetchData();
    } else {
      setMenus([]);
      setMaterials([]);
      setLoading(false);
    }
  }, [selectedOutletId]);

  const fetchData = async () => {
    if (!selectedOutletId) return;
    setLoading(true);

    const { data: menuData } = await insforge.database
      .from("products")
      .select("*")
      .eq("outlet_id", selectedOutletId)
      .eq("product_type", "MENU")
      .order("name");

    const { data: materialData } = await insforge.database
      .from("products")
      .select("*")
      .eq("outlet_id", selectedOutletId)
      .in("product_type", ["MATERIAL", "ACCESSORY"])
      .order("name");

    if (menuData) setMenus(menuData);
    if (materialData) setMaterials(materialData);
    setLoading(false);
  };

  const handleManageRecipe = async (menu: Product) => {
    setSelectedMenu(menu);
    const { data } = await insforge.database
      .from("product_recipes")
      .select(`
        id, product_id, material_id, quantity, serve_type,
        material:products!product_recipes_material_id_fkey(name)
      `)
      .eq("product_id", menu.id);

    setRecipes(data || []);
    setIsDialogOpen(true);
  };

  const handleAddRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMenu || !selectedMaterialId || !quantity) return;

    const payload = {
      product_id: selectedMenu.id,
      material_id: selectedMaterialId,
      quantity: parseFloat(quantity),
      serve_type: serveType === "ALL" ? null : serveType,
    };

    const { data, error } = await insforge.database
      .from("product_recipes")
      .insert(payload)
      .select(`
        id, product_id, material_id, quantity, serve_type,
        material:products!product_recipes_material_id_fkey(name)
      `)
      .single();

    if (error) {
      alert("Gagal menambah resep: " + error.message);
      return;
    }
    if (data) {
      setRecipes([...recipes, data]);
      setQuantity("");
      setSelectedMaterialId("");
    }
  };

  const handleDeleteRecipe = async (id: string) => {
    const { error } = await insforge.database.from("product_recipes").delete().eq("id", id);
    if (!error) {
      setRecipes(recipes.filter((r) => r.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Resep / BOM</h1>
        <OutletSelector />
      </div>

      {!selectedOutletId ? (
        <div className="flex flex-col items-center justify-center h-64 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 dark:bg-gray-900">
          <p className="text-lg font-medium text-gray-500">Pilih outlet terlebih dahulu</p>
          <p className="text-sm text-gray-400 mt-1">Gunakan dropdown di atas untuk memilih outlet</p>
        </div>
      ) : (
        <>
          <div className="rounded-md border bg-white dark:bg-gray-950">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Menu</TableHead>
                  <TableHead>Serve Type</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={3} className="text-center h-24">Memuat...</TableCell></TableRow>
                ) : menus.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center h-24">Belum ada menu. Tambahkan produk bertipe MENU terlebih dahulu.</TableCell></TableRow>
                ) : (
                  menus.map((menu) => (
                    <TableRow key={menu.id}>
                      <TableCell className="font-medium">{menu.name}</TableCell>
                      <TableCell>{menu.serve_type}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => handleManageRecipe(menu)}>
                          <ListPlus className="mr-2 h-4 w-4" /> Kelola Resep
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Resep untuk: {selectedMenu?.name}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-6 pt-4">
                <div>
                  <h3 className="text-sm font-semibold mb-4">Bahan Saat Ini</h3>
                  {recipes.length === 0 ? (
                    <p className="text-sm text-gray-500">Belum ada bahan ditambahkan.</p>
                  ) : (
                    <ul className="space-y-2">
                      {recipes.map((r) => (
                        <li key={r.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded-md border dark:bg-gray-900">
                          <div>
                            <span className="font-medium">{r.material?.name}</span>
                            <span className="ml-2 text-gray-500">× {r.quantity}</span>
                            {r.serve_type && (
                              <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded">
                                Hanya {r.serve_type}
                              </span>
                            )}
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleDeleteRecipe(r.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="bg-gray-50 p-4 rounded-md border dark:bg-gray-900">
                  <h3 className="text-sm font-semibold mb-4">Tambah Bahan</h3>
                  <form onSubmit={handleAddRecipe} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Bahan</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={selectedMaterialId}
                        onChange={(e) => setSelectedMaterialId(e.target.value)}
                        required
                      >
                        <option value="" disabled>Pilih bahan...</option>
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Jumlah</Label>
                        <Input type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Kondisi</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={serveType}
                          onChange={(e) => setServeType(e.target.value as any)}
                        >
                          <option value="ALL">Semua (Hot & Cold)</option>
                          <option value="HOT">Hanya Hot</option>
                          <option value="COLD">Hanya Cold</option>
                        </select>
                      </div>
                    </div>
                    <Button type="submit" className="w-full" style={{ backgroundColor: process.env.NEXT_PUBLIC_PRIMARY_COLOR }}>
                      Tambah ke Resep
                    </Button>
                  </form>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
