"use client";

import { useOutletContext } from "@/context/outlet-context";
import { Store } from "lucide-react";

export function OutletSelector() {
  const { outlets, selectedOutletId, setSelectedOutletId, userRole, loading } =
    useOutletContext();

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 animate-pulse">
        <Store className="h-4 w-4" />
        Memuat outlet...
      </div>
    );
  }

  // Admin is locked to their outlet
  if (userRole === "ADMIN") {
    const outlet = outlets.find((o) => o.id === selectedOutletId);
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-gray-50 px-3 py-2 text-sm dark:bg-gray-900">
        <Store className="h-4 w-4 text-gray-500" />
        <span className="font-medium">{outlet?.name || "Outlet tidak ditemukan"}</span>
        <span className="text-xs text-gray-400">(Admin — outlet tetap)</span>
      </div>
    );
  }

  // Owner gets a dropdown
  return (
    <div className="flex items-center gap-2">
      <Store className="h-4 w-4 text-gray-500" />
      <select
        className="flex h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
        value={selectedOutletId || ""}
        onChange={(e) => setSelectedOutletId(e.target.value)}
      >
        <option value="" disabled>
          — Pilih Outlet —
        </option>
        {outlets.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}
