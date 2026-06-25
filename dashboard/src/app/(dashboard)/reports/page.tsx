"use client";

import { useState, useEffect } from "react";
import { useOutletContext } from "@/context/outlet-context";
import { insforge } from "@/lib/insforge";
import { downloadCSV } from "@/lib/export";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, BarChart3, TrendingUp, DollarSign, FileSpreadsheet, Copy } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function ReportsPage() {
  const { outlets, selectedOutletId, setSelectedOutletId, userRole } = useOutletContext();
  const [dateRange, setDateRange] = useState("7days"); // today, 7days, 30days, all
  const [loading, setLoading] = useState(false);
  
  // Data States
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transactionItems, setTransactionItems] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // P&L Settings State
  const [usePl, setUsePl] = useState(false);
  const [plMethod, setPlMethod] = useState("BOM"); // BOM or PERCENT
  const [plPercent, setPlPercent] = useState("40");

  const primaryColor = process.env.NEXT_PUBLIC_PRIMARY_COLOR || "#000000";

  useEffect(() => {
    if (selectedOutletId) {
      fetchData();
    } else {
      setTransactions([]);
      setTransactionItems([]);
    }
  }, [selectedOutletId, dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Date filter logic
      let dateFilter = new Date();
      if (dateRange === "today") {
        dateFilter.setHours(0, 0, 0, 0);
      } else if (dateRange === "7days") {
        dateFilter.setDate(dateFilter.getDate() - 7);
      } else if (dateRange === "30days") {
        dateFilter.setDate(dateFilter.getDate() - 30);
      } else {
        dateFilter = new Date("2000-01-01"); // Effectively 'all'
      }

      // Fetch transactions
      const { data: txns } = await insforge.database
        .from("transactions")
        .select(`*, users(name)`)
        .eq("outlet_id", selectedOutletId)
        .eq("status", "COMPLETED")
        .gte("created_at", dateFilter.toISOString())
        .order("created_at", { ascending: false });

      if (txns) setTransactions(txns);

      // Fetch transaction items if we have txns
      if (txns && txns.length > 0) {
        const txnIds = txns.map(t => t.id);
        const { data: items } = await insforge.database
          .from("transaction_items")
          .select("*")
          .in("transaction_id", txnIds);
        if (items) setTransactionItems(items);
      } else {
        setTransactionItems([]);
      }

      // Fetch products and recipes for P&L
      const { data: prods } = await insforge.database
        .from("products")
        .select("id, name, price, type")
        .eq("outlet_id", selectedOutletId);
      if (prods) setProducts(prods);

      const { data: recs } = await insforge.database
        .from("product_recipes")
        .select("product_id, material_id, quantity");
      if (recs) setRecipes(recs);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // Data Processing
  // ==========================================

  // 1. Sales Data
  const totalRevenue = transactions.reduce((sum, t) => sum + t.total_amount, 0);
  const totalDiscounts = transactions.reduce((sum, t) => sum + (t.discount_amount || 0), 0);
  const aov = transactions.length > 0 ? totalRevenue / transactions.length : 0;

  // Group by day for chart
  const salesByDay = transactions.reduce((acc: any, t) => {
    const date = new Date(t.created_at).toLocaleDateString("id-ID", { month: "short", day: "numeric" });
    if (!acc[date]) acc[date] = 0;
    acc[date] += t.total_amount;
    return acc;
  }, {});
  const chartData = Object.keys(salesByDay).map(date => ({
    date,
    revenue: salesByDay[date]
  })).reverse();

  // 2. Best Sellers
  const productSales = transactionItems.reduce((acc: any, item) => {
    const key = `${item.product_id}_${item.serve_type || 'NONE'}`;
    if (!acc[key]) {
      acc[key] = {
        name: item.product_name,
        serveType: item.serve_type,
        qty: 0,
        revenue: 0
      };
    }
    acc[key].qty += item.quantity;
    acc[key].revenue += item.subtotal;
    return acc;
  }, {});
  
  const bestSellers = Object.values(productSales)
    .sort((a: any, b: any) => b.qty - a.qty)
    .slice(0, 50); // Top 50

  // 3. Profit & Loss (P&L) Calculation
  let totalCogs = 0;
  let plDetails: any[] = [];

  if (usePl) {
    if (plMethod === "PERCENT") {
      const marginDecimal = parseFloat(plPercent) / 100 || 0;
      const cogsDecimal = 1 - marginDecimal;
      totalCogs = totalRevenue * cogsDecimal;
      
      // Calculate per transaction
      plDetails = transactions.map(t => ({
        id: t.id.split('-')[0],
        date: new Date(t.created_at).toLocaleString("id-ID"),
        revenue: t.total_amount,
        cogs: t.total_amount * cogsDecimal,
        profit: t.total_amount * marginDecimal,
        margin: `${plPercent}%`
      }));
    } else {
      // BOM Method
      const materialMap = new Map(products.filter(p => p.type === 'MATERIAL').map(p => [p.id, p]));
      
      // Calculate COGS per product based on recipe
      const productCogs = new Map();
      products.forEach(p => {
        const itemRecipes = recipes.filter(r => r.product_id === p.id);
        let cogs = 0;
        itemRecipes.forEach(r => {
          const mat = materialMap.get(r.material_id);
          // Assuming MATERIAL price in DB is price per unit.
          // In a real app, you might have "cost" vs "price". We use price as cost for materials.
          if (mat) {
            cogs += (mat.price * r.quantity);
          }
        });
        productCogs.set(p.id, cogs);
      });

      // Calculate total COGS from sold items
      let totalCalculatedCogs = 0;
      plDetails = transactions.map(t => {
        const tItems = transactionItems.filter(i => i.transaction_id === t.id);
        let tCogs = 0;
        tItems.forEach(i => {
          tCogs += (productCogs.get(i.product_id) || 0) * i.quantity;
        });
        
        totalCalculatedCogs += tCogs;
        const profit = t.total_amount - tCogs;
        const margin = t.total_amount > 0 ? ((profit / t.total_amount) * 100).toFixed(1) : "0";

        return {
          id: t.id.split('-')[0],
          date: new Date(t.created_at).toLocaleString("id-ID"),
          revenue: t.total_amount,
          cogs: tCogs,
          profit: profit,
          margin: `${margin}%`
        };
      });
      totalCogs = totalCalculatedCogs;
    }
  }

  const grossProfit = totalRevenue - totalCogs;
  const overallMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : "0";

  // ==========================================
  // Exports
  // ==========================================
  const exportSales = () => {
    const data = transactions.map(t => ({
      ID: t.id,
      Date: new Date(t.created_at).toLocaleString("id-ID"),
      Staff: t.users?.name || "Unknown",
      Total: t.total_amount,
      Discount: t.discount_amount || 0,
      Method: t.payment_method
    }));
    downloadCSV(data, `Sales_Report_${dateRange}.csv`);
  };

  const exportBestSellers = () => {
    const data = bestSellers.map((b: any) => ({
      Product: b.name,
      Type: b.serveType || "-",
      Sold_Qty: b.qty,
      Revenue: b.revenue
    }));
    downloadCSV(data, `BestSellers_${dateRange}.csv`);
  };

  const exportPL = () => {
    downloadCSV(plDetails, `ProfitLoss_${dateRange}.csv`);
  };

  // Google Sheets Helper (Copy to clipboard as TSV)
  const copyToGoogleSheets = (data: any[]) => {
    if (!data || !data.length) return;
    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(h => row[h]).join('\t'));
    const tsv = [headers.join('\t'), ...rows].join('\n');
    navigator.clipboard.writeText(tsv).then(() => {
      alert("Data berhasil disalin! Silakan buka Google Sheets kosong dan tekan Ctrl+V (Paste).");
    });
  };

  const ExportButton = ({ data, filename }: { data: any[], filename: string }) => (
    <DropdownMenu>
      <DropdownMenuTrigger 
        className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-50"
        disabled={data.length === 0}
      >
        <Download className="h-4 w-4" /> Export
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-white">
        <DropdownMenuLabel>Pilih Format</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => downloadCSV(data, filename)} className="cursor-pointer">
          <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
          MS Excel (.csv)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => copyToGoogleSheets(data)} className="cursor-pointer">
          <Copy className="h-4 w-4 mr-2 text-blue-600" />
          Google Sheets (Copy Paste)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Reports & Analytics</h1>
          <p className="text-slate-500 mt-1">Pantau performa penjualan dan keuangan outlet.</p>
        </div>

        <div className="flex gap-3">
          <Select value={dateRange} onValueChange={(val) => setDateRange(val || "7days")}>
            <SelectTrigger className="w-[150px] bg-white">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hari Ini</SelectItem>
              <SelectItem value="7days">7 Hari Terakhir</SelectItem>
              <SelectItem value="30days">30 Hari Terakhir</SelectItem>
              <SelectItem value="all">Semua Waktu</SelectItem>
            </SelectContent>
          </Select>

          {userRole === "OWNER" && (
            <Select
              value={selectedOutletId || "none"}
              onValueChange={(val) => {
                if (val && val !== "none") setSelectedOutletId(val);
              }}
            >
              <SelectTrigger className="w-[200px] bg-white">
                <SelectValue placeholder="Pilih Outlet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" disabled>Pilih Outlet</SelectItem>
                {outlets.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {!selectedOutletId ? (
        <Card className="border-dashed border-2 shadow-none">
          <CardContent className="flex flex-col items-center justify-center h-64 text-slate-500">
            <BarChart3 className="h-12 w-12 mb-4 opacity-20" />
            <p>Silakan pilih outlet untuk melihat laporan.</p>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="h-64 flex items-center justify-center">Loading data...</div>
      ) : (
        <Tabs defaultValue="sales" className="space-y-6">
          <TabsList className="bg-white border p-1 rounded-xl shadow-sm">
            <TabsTrigger value="sales" className="rounded-lg px-6">Penjualan</TabsTrigger>
            <TabsTrigger value="products" className="rounded-lg px-6">Produk Terlaris</TabsTrigger>
            <TabsTrigger value="pl" className="rounded-lg px-6">Laba Rugi</TabsTrigger>
          </TabsList>

          {/* TAB 1: SALES */}
          <TabsContent value="sales" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">Total Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold" style={{ color: primaryColor }}>
                    Rp {totalRevenue.toLocaleString("id-ID")}
                  </div>
                  {totalDiscounts > 0 && (
                    <p className="text-sm text-red-500 mt-1">Diskon: -Rp {totalDiscounts.toLocaleString("id-ID")}</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">Total Transaksi</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">{transactions.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">Rata-rata Transaksi (AOV)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">
                    Rp {Math.round(aov).toLocaleString("id-ID")}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Trend Penjualan Harian</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tickFormatter={(value) => `Rp${value/1000}k`}
                      />
                      <Tooltip 
                        formatter={(value: any) => [`Rp ${Number(value).toLocaleString('id-ID')}`, 'Revenue']}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                      />
                      <Bar dataKey="revenue" fill={primaryColor} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400">Tidak ada data transaksi</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Riwayat Transaksi</CardTitle>
                  <CardDescription>Detail transaksi pada periode terpilih.</CardDescription>
                </div>
                <ExportButton 
                  data={transactions.map(t => ({
                    Tanggal: new Date(t.created_at).toLocaleString("id-ID"),
                    ID: t.id,
                    Kasir: t.users?.name || "Unknown",
                    Total: t.total_amount,
                    Diskon: t.discount_amount || 0,
                    Metode: t.payment_method
                  }))} 
                  filename={`Sales_Report_${dateRange}.csv`} 
                />
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>No. Transaksi</TableHead>
                      <TableHead>Kasir</TableHead>
                      <TableHead>Metode</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.slice(0, 10).map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>{new Date(t.created_at).toLocaleString("id-ID")}</TableCell>
                        <TableCell className="font-mono text-xs">{t.id.split('-')[0]}</TableCell>
                        <TableCell>{t.users?.name || "Unknown"}</TableCell>
                        <TableCell>{t.payment_method}</TableCell>
                        <TableCell className="text-right font-medium">Rp {t.total_amount.toLocaleString("id-ID")}</TableCell>
                      </TableRow>
                    ))}
                    {transactions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-slate-500">Tidak ada transaksi</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                {transactions.length > 10 && (
                  <div className="text-center pt-4 text-sm text-slate-500">
                    Menampilkan 10 dari {transactions.length} transaksi. Export untuk melihat semua.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: BEST SELLERS */}
          <TabsContent value="products" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Produk Terlaris</CardTitle>
                  <CardDescription>Peringkat produk berdasarkan jumlah terjual (Qty).</CardDescription>
                </div>
                <ExportButton 
                  data={bestSellers.map((b: any) => ({
                    Produk: b.name,
                    Tipe: b.serveType || "-",
                    Terjual: b.qty,
                    Revenue: b.revenue
                  }))} 
                  filename={`BestSellers_${dateRange}.csv`} 
                />
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Peringkat</TableHead>
                      <TableHead>Produk</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead className="text-center">Terjual (Qty)</TableHead>
                      <TableHead className="text-right">Total Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bestSellers.map((b: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-bold text-slate-500">#{index + 1}</TableCell>
                        <TableCell className="font-medium text-slate-900">{b.name}</TableCell>
                        <TableCell>
                          {b.serveType ? (
                            <span className="text-xs bg-slate-100 px-2 py-1 rounded-md text-slate-600">
                              {b.serveType === 'HOT' ? '🔥 Hot' : '❄️ Cold'}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-center font-bold text-slate-900">{b.qty}</TableCell>
                        <TableCell className="text-right text-slate-600">Rp {b.revenue.toLocaleString("id-ID")}</TableCell>
                      </TableRow>
                    ))}
                    {bestSellers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-slate-500">Tidak ada data penjualan produk</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: PROFIT & LOSS */}
          <TabsContent value="pl" className="space-y-6">
            <Card className="border-2 border-indigo-100 bg-indigo-50/30">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-indigo-900 flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Pengaturan Laba Rugi
                    </CardTitle>
                    <CardDescription className="text-indigo-700/70">
                      Aktifkan fitur Laba Rugi (P&L) dan pilih metode kalkulasi HPP.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="pl-mode" className="font-bold text-indigo-900">Aktifkan P&L</Label>
                    <Switch id="pl-mode" checked={usePl} onCheckedChange={setUsePl} />
                  </div>
                </div>
              </CardHeader>
              
              {usePl && (
                <CardContent>
                  <div className="p-4 bg-white rounded-xl border border-indigo-100">
                    <Label className="mb-3 block text-sm font-bold text-slate-700">Metode Kalkulasi Harga Pokok Penjualan (HPP)</Label>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div 
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${plMethod === 'BOM' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300'}`}
                        onClick={() => setPlMethod('BOM')}
                      >
                        <div className="font-bold text-slate-900 mb-1">Otomatis via Resep (BOM)</div>
                        <p className="text-xs text-slate-500">
                          HPP dihitung otomatis berdasarkan komposisi bahan baku di tabel Resep (BOM). Pastikan bahan baku memiliki harga beli yang valid.
                        </p>
                      </div>
                      
                      <div 
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${plMethod === 'PERCENT' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300'}`}
                        onClick={() => setPlMethod('PERCENT')}
                      >
                        <div className="font-bold text-slate-900 mb-1">Persentase Global</div>
                        <p className="text-xs text-slate-500 mb-3">
                          Laba dihitung pukul rata sekian persen dari total pendapatan kotor (Revenue).
                        </p>
                        {plMethod === 'PERCENT' && (
                          <div className="flex items-center gap-2">
                            <Input 
                              type="number" 
                              value={plPercent} 
                              onChange={(e) => setPlPercent(e.target.value)}
                              className="w-20 h-8" 
                            />
                            <span className="text-sm font-bold text-slate-600">% Laba Bersih</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {usePl ? (
              <>
                <div className="grid gap-6 md:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-slate-500">Gross Revenue</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-slate-900">Rp {totalRevenue.toLocaleString("id-ID")}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-slate-500">Total HPP (COGS)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-500">- Rp {Math.round(totalCogs).toLocaleString("id-ID")}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-slate-500">Gross Profit (Laba)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">Rp {Math.round(grossProfit).toLocaleString("id-ID")}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-slate-500">Profit Margin</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-slate-900">{overallMargin}%</div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Rincian Margin per Transaksi</CardTitle>
                      <CardDescription>Berdasarkan metode: {plMethod === 'BOM' ? 'Resep Bahan Baku' : `Margin Global ${plPercent}%`}</CardDescription>
                    </div>
                    <ExportButton data={plDetails} filename={`ProfitLoss_${dateRange}.csv`} />
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>ID</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-right">HPP (COGS)</TableHead>
                          <TableHead className="text-right">Laba</TableHead>
                          <TableHead className="text-right">Margin</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {plDetails.slice(0, 10).map((d: any) => (
                          <TableRow key={d.id}>
                            <TableCell>{d.date}</TableCell>
                            <TableCell className="font-mono text-xs">{d.id}</TableCell>
                            <TableCell className="text-right">Rp {d.revenue.toLocaleString("id-ID")}</TableCell>
                            <TableCell className="text-right text-red-500">Rp {Math.round(d.cogs).toLocaleString("id-ID")}</TableCell>
                            <TableCell className="text-right text-green-600 font-bold">Rp {Math.round(d.profit).toLocaleString("id-ID")}</TableCell>
                            <TableCell className="text-right font-medium">{d.margin}</TableCell>
                          </TableRow>
                        ))}
                        {plDetails.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-6 text-slate-500">Tidak ada data transaksi</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <DollarSign className="h-16 w-16 mb-4 opacity-20" />
                <p>Fitur Laba Rugi dinonaktifkan.</p>
                <p className="text-sm">Aktifkan toggle di atas untuk mulai melihat analisis profitabilitas.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
