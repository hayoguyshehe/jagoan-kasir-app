"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Package, ShoppingCart, Users, Settings, Activity, CalendarDays, Smartphone, Download, BarChart, ShieldAlert, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

const menuItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Products", href: "/products", icon: Package },
  { name: "Recipes (BOM)", href: "/recipes", icon: Activity },
  { name: "Stock Opname", href: "/stock-opname", icon: Package },
  { name: "Staff Schedules", href: "/staff-schedules", icon: CalendarDays },
  { name: "Transactions", href: "/transactions", icon: ShoppingCart },
  { name: "Vouchers", href: "/vouchers", icon: Tag },
  { name: "Reports", href: "/reports", icon: BarChart },
  { name: "Staff", href: "/staff", icon: Users },
  { name: "Security", href: "/security", icon: ShieldAlert },
  { name: "Settings", href: "/settings", icon: Settings },
];

const brandColor = process.env.NEXT_PUBLIC_PRIMARY_COLOR || '#000000';

export function Sidebar() {
  const pathname = usePathname();
  const brandName = process.env.NEXT_PUBLIC_BRAND_NAME || "Jagoan Kasir";

  // Accent color for active state (Lime Green)
  const accentColor = "#D4F870";

  return (
    <div 
      className="flex h-full w-64 flex-col bg-slate-900"
      style={{ backgroundColor: brandColor }}
    >
      {/* Brand header */}
      <div className="flex h-20 items-center px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 mr-3">
          <Activity className="h-6 w-6 text-white" />
        </div>
        <span className="text-xl font-bold text-white tracking-tight">
          {brandName}
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto py-6">
        <nav className="grid gap-2 px-4">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-4 rounded-full px-4 py-3 text-sm font-medium transition-all duration-200",
                  !isActive && "text-white/70 hover:bg-white/10 hover:text-white"
                )}
                style={isActive ? {
                  backgroundColor: accentColor,
                  color: "#0f172a", // dark text for the lime background
                  boxShadow: `0 4px 14px 0 ${accentColor}40`
                } : undefined}
              >
                <item.icon className={cn("h-5 w-5", isActive ? "text-[#0f172a]" : "text-white/70")} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Download App Promo Card */}
      <div className="p-4 mb-4">
        <div 
          className="relative overflow-hidden rounded-2xl p-5 text-slate-900"
          style={{ backgroundColor: accentColor }}
        >
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/20" />
          <div className="absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-white/20" />
          
          <div className="relative z-10">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
              <Smartphone className="h-5 w-5 text-slate-900" />
            </div>
            <h4 className="mb-1 font-bold leading-tight">Download our<br/>mobile app</h4>
            <p className="mb-4 text-xs font-medium text-slate-700">For Kasir & Staff</p>
            <Button size="sm" variant="outline" className="w-full gap-2 border-slate-900/10 bg-white/50 text-slate-900 hover:bg-white">
              <Download className="h-3.5 w-3.5" />
              Get APK
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
