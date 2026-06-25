"use client";

import { useEffect, useState } from "react";
import { insforge } from "@/lib/insforge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShoppingCart, DollarSign, Package, Users } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

export default function DashboardHome() {
  const [stats, setStats] = useState({
    totalTransactions: 0,
    totalRevenue: 0,
    totalProducts: 0,
    activeStaff: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [txnRes, revRes, prodRes, staffRes] = await Promise.all([
          insforge.database.from("transactions").select("id", { count: "exact" }),
          insforge.database.from("transactions").select("total_amount").eq("status", "COMPLETED"),
          insforge.database.from("products").select("id", { count: "exact" }),
          insforge.database.from("users").select("id", { count: "exact" }).eq("role", "STAFF").eq("is_active", true)
        ]);

        const totalRevenue = revRes.data?.reduce((acc, curr) => acc + (curr.total_amount || 0), 0) || 0;

        // Group transactions by date for chart
        const grouped = (revRes.data || []).reduce((acc: any, curr: any) => {
          const date = new Date(curr.created_at).toLocaleDateString();
          if (!acc[date]) acc[date] = 0;
          acc[date] += curr.total_amount || 0;
          return acc;
        }, {});
        
        const cData = Object.keys(grouped).map(date => ({
          name: date,
          total: grouped[date]
        }));

        setChartData(cData);

        setStats({
          totalTransactions: txnRes.count || 0,
          totalRevenue,
          totalProducts: prodRes.count || 0,
          activeStaff: staffRes.count || 0
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return <div className="animate-pulse flex space-x-4">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Welcome back 👋</h1>
      </div>
      
      <div>
        <h2 className="text-xl font-bold mb-4 text-slate-800">Overview</h2>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-[1.5rem] border-none shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Total Revenue</p>
                  <h3 className="text-2xl font-bold text-slate-900">Rp {stats.totalRevenue.toLocaleString("id-ID")}</h3>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                  <DollarSign className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-[1.5rem] border-none shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Transactions</p>
                  <h3 className="text-2xl font-bold text-slate-900">+{stats.totalTransactions}</h3>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                  <ShoppingCart className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-[1.5rem] border-none shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Products</p>
                  <h3 className="text-2xl font-bold text-slate-900">{stats.totalProducts}</h3>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                  <Package className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-[1.5rem] border-none shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Active Staff</p>
                  <h3 className="text-2xl font-bold text-slate-900">{stats.activeStaff}</h3>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 rounded-[1.5rem] border-none shadow-[0_4px_24px_rgba(0,0,0,0.02)] p-2">
          <CardHeader>
            <CardTitle className="text-xl">Revenue Overview</CardTitle>
            <CardDescription>Daily revenue from completed transactions</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full mt-4">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `Rp${value}`}
                    />
                    <Tooltip cursor={{ fill: "rgba(0,0,0,0.05)" }} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                    <Bar dataKey="total" fill={process.env.NEXT_PUBLIC_PRIMARY_COLOR || "#03619B"} radius={[8, 8, 8, 8]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-gray-500">
                  No data available yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
