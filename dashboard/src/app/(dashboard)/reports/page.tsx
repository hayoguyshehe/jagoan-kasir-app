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
import { Download, BarChart3, TrendingUp, DollarSign, FileSpreadsheet, Copy, Printer } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, subDays, startOfMonth, endOfMonth, startOfYear } from "date-fns";

export default function ReportsPage() {
  const { outlets, selectedOutletId, setSelectedOutletId, userRole } = useOutletContext();
  
  const [dateRange, setDateRange] = useState("today"); // today, 3days, 7days, thismonth, custom, all
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Data States from RPC
  const [chartData, setChartData] = useState<any[]>([]);
  const [bestSellers, setBestSellers] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalRevenue: 0, totalTransactions: 0, totalDiscounts: 0 });

  const primaryColor = process.env.NEXT_PUBLIC_PRIMARY_COLOR || "#000000";

  useEffect(() => {
    if (selectedOutletId) {
      if (dateRange === "custom" && (!customStart || !customEnd)) {
        return; // Wait for valid custom dates
      }
      fetchData();
    } else {
      setChartData([]);
      setBestSellers([]);
      setStats({ totalRevenue: 0, totalTransactions: 0, totalDiscounts: 0 });
    }
  }, [selectedOutletId, dateRange, customStart, customEnd]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let start_date = new Date();
      let end_date = new Date();
      
      start_date.setHours(0, 0, 0, 0);
      end_date.setHours(23, 59, 59, 999);

      if (dateRange === "today") {
        // already set
      } else if (dateRange === "3days") {
        start_date = subDays(start_date, 2);
      } else if (dateRange === "7days") {
        start_date = subDays(start_date, 6);
      } else if (dateRange === "thismonth") {
        start_date = startOfMonth(new Date());
        end_date = endOfMonth(new Date());
      } else if (dateRange === "all") {
        start_date = new Date("2000-01-01");
      } else if (dateRange === "custom") {
        start_date = new Date(customStart);
        start_date.setHours(0, 0, 0, 0);
        end_date = new Date(customEnd);
        end_date.setHours(23, 59, 59, 999);
      }

      const { data, error } = await insforge.rpc("get_sales_report", {
        p_outlet_id: selectedOutletId,
        p_start_date: start_date.toISOString(),
        p_end_date: end_date.toISOString()
      });

      if (error) throw error;

      if (data) {
        setChartData(data.chartData || []);
        setBestSellers(data.bestSellers || []);
        setStats(data.stats || { totalRevenue: 0, totalTransactions: 0, totalDiscounts: 0 });
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const exportSales = () => {
    const data = chartData.map(d => ({
      Periode: d.date,
      Total_Transaksi: d.transactions,
      Revenue: d.revenue
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

  const copyToGoogleSheets = (data: any[]) => {
    if (!data || !data.length) return;
    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(h => row[h]).join('\t'));
    const tsv = [headers.join('\t'), ...rows].join('\n');
    navigator.clipboard.writeText(tsv).then(() => {
      alert("Data berhasil disalin! Silakan paste di Google Sheets.");
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
    <>
      <style>{`
        @media print {
          nav, sidebar, header { display: none !important; }
          .print-hide { display: none !important; }
          .print-full { width: 100% !important; max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
        }
      `}</style>
      
      <div className="space-y-6 pb-20 print-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Reports & Analytics</h1>
            <p className="text-slate-500 mt-1">Pantau performa penjualan secara akurat (Zona Waktu WIB).</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 print-hide">
            <Select value={dateRange} onValueChange={(val) => setDateRange(val)}>
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hari Ini</SelectItem>
                <SelectItem value="3days">3 Hari Terakhir</SelectItem>
                <SelectItem value="7days">7 Hari Terakhir</SelectItem>
                <SelectItem value="thismonth">Bulan Ini</SelectItem>
                <SelectItem value="all">Semua Waktu</SelectItem>
                <SelectItem value="custom">Kustom (Pilih Tanggal)</SelectItem>
              </SelectContent>
            </Select>

            {dateRange === "custom" && (
              <div className="flex items-center gap-2">
                <Input 
                  type="date" 
                  value={customStart} 
                  onChange={(e) => setCustomStart(e.target.value)} 
                  className="w-36 bg-white"
                />
                <span className="text-sm text-slate-500">s/d</span>
                <Input 
                  type="date" 
                  value={customEnd} 
                  onChange={(e) => setCustomEnd(e.target.value)} 
                  className="w-36 bg-white"
                />
              </div>
            )}

            {userRole === "OWNER" && (
              <Select
                value={selectedOutletId || "none"}
                onValueChange={(val) => {
                  if (val && val !== "none") setSelectedOutletId(val);
                }}
              >
                <SelectTrigger className="w-[180px] bg-white">
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

            <Button variant="outline" onClick={() => window.print()} className="ml-2 gap-2">
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        </div>

        {!selectedOutletId ? (
          <Card className="border-dashed border-2 shadow-none print-hide">
            <CardContent className="flex flex-col items-center justify-center h-64 text-slate-500">
              <BarChart3 className="h-12 w-12 mb-4 opacity-20" />
              <p>Silakan pilih outlet untuk melihat laporan.</p>
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="h-64 flex items-center justify-center">Memuat laporan dari server...</div>
        ) : (
          <Tabs defaultValue="sales" className="space-y-6">
            <TabsList className="bg-white border p-1 rounded-xl shadow-sm print-hide">
              <TabsTrigger value="sales" className="rounded-lg px-6">Penjualan</TabsTrigger>
              <TabsTrigger value="products" className="rounded-lg px-6">Produk Terlaris</TabsTrigger>
            </TabsList>

            {/* TAB 1: SALES */}
            <TabsContent value="sales" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">Total Pendapatan Kotor</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold" style={{ color: primaryColor }}>
                      Rp {stats.totalRevenue.toLocaleString("id-ID")}
                    </div>
                    {stats.totalDiscounts > 0 && (
                      <p className="text-sm text-red-500 mt-1">Total Diskon: -Rp {stats.totalDiscounts.toLocaleString("id-ID")}</p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">Total Transaksi Selesai</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-slate-900">{stats.totalTransactions}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">Rata-rata Transaksi (AOV)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-slate-900">
                      Rp {stats.totalTransactions > 0 ? Math.round(stats.totalRevenue / stats.totalTransactions).toLocaleString("id-ID") : 0}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Trend Penjualan Berdasarkan Waktu</CardTitle>
                    <CardDescription>
                      {(dateRange === "all" || (dateRange === "custom" && customStart && customEnd && (new Date(customEnd).getTime() - new Date(customStart).getTime()) > 31 * 24 * 60 * 60 * 1000)) 
                        ? "Dikelompokkan berdasarkan Bulan" 
                        : "Dikelompokkan berdasarkan Hari"}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="h-[350px]">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tickFormatter={(value) => `Rp${value/1000}k`}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip 
                          formatter={(value: any, name: string) => {
                            if (name === 'revenue') return [`Rp ${Number(value).toLocaleString('id-ID')}`, 'Pendapatan'];
                            return [value, 'Transaksi'];
                          }}
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
                    <CardTitle>Ringkasan per Periode</CardTitle>
                  </div>
                  <div className="print-hide">
                    <ExportButton data={chartData} filename={`Sales_Summary_${dateRange}.csv`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Periode (Waktu)</TableHead>
                        <TableHead className="text-center">Total Transaksi</TableHead>
                        <TableHead className="text-right">Total Pendapatan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {chartData.map((d: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{d.date}</TableCell>
                          <TableCell className="text-center">{d.transactions}</TableCell>
                          <TableCell className="text-right font-bold text-slate-900">Rp {d.revenue.toLocaleString("id-ID")}</TableCell>
                        </TableRow>
                      ))}
                      {chartData.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-6 text-slate-500">Tidak ada data</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: BEST SELLERS */}
            <TabsContent value="products" className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Top 50 Produk Terlaris</CardTitle>
                    <CardDescription>Peringkat produk berdasarkan jumlah terjual (Qty) pada rentang waktu terpilih.</CardDescription>
                  </div>
                  <div className="print-hide">
                    <ExportButton 
                      data={bestSellers} 
                      filename={`BestSellers_${dateRange}.csv`} 
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Peringkat</TableHead>
                        <TableHead>Produk</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead className="text-center">Terjual (Qty)</TableHead>
                        <TableHead className="text-right">Total Pendapatan</TableHead>
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
          </Tabs>
        )}
      </div>
    </>
  );
}
