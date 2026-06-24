"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, ShoppingCart, Users, Settings, Activity, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

const menuItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Products", href: "/products", icon: Package },
  { name: "Recipes (BOM)", href: "/recipes", icon: Activity },
  { name: "Stock Opname", href: "/stock-opname", icon: Package },
  { name: "Staff Schedules", href: "/staff-schedules", icon: CalendarDays },
  { name: "Transactions", href: "/transactions", icon: ShoppingCart },
  { name: "Staff", href: "/staff", icon: Users },
  { name: "Settings", href: "/settings", icon: Settings },
];

const brandColor = process.env.NEXT_PUBLIC_PRIMARY_COLOR || '#000000';

export function Sidebar() {
  const pathname = usePathname();
  const brandName = process.env.NEXT_PUBLIC_BRAND_NAME || "Jagoan Kasir";

  return (
    <div className="flex h-full w-64 flex-col border-r bg-white">
      {/* Brand header with colored accent bar */}
      <div
        className="flex h-14 items-center border-b px-4"
        style={{ borderBottomColor: brandColor, borderBottomWidth: '3px' }}
      >
        <span className="text-lg font-bold" style={{ color: brandColor }}>
          {brandName}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="grid gap-1 px-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  !isActive && "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                )}
                style={isActive ? {
                  backgroundColor: `${brandColor}14`,
                  color: brandColor,
                } : undefined}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
