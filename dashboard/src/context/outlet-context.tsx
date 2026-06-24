"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { insforge } from "@/lib/insforge";

type Outlet = {
  id: string;
  name: string;
  address?: string;
  phone?: string;
};

type OutletContextType = {
  outlets: Outlet[];
  selectedOutletId: string | null;
  setSelectedOutletId: (id: string) => void;
  userRole: string;
  userId: string | null;
  loading: boolean;
};

const OutletContext = createContext<OutletContextType>({
  outlets: [],
  selectedOutletId: null,
  setSelectedOutletId: () => {},
  userRole: "STAFF",
  userId: null,
  loading: true,
});

export function OutletProvider({ children }: { children: ReactNode }) {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState("STAFF");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const { data: authData } = await insforge.auth.getCurrentUser();
        if (!authData?.user) return;

        setUserId(authData.user.id);

        // Fetch user's role and outlet
        const { data: userRecord } = await insforge.database
          .from("users")
          .select("role, outlet_id")
          .eq("id", authData.user.id)
          .single();

        if (!userRecord) return;

        setUserRole(userRecord.role);

        // Fetch outlets
        const { data: outletData } = await insforge.database
          .from("outlets")
          .select("id, name, address, phone")
          .order("name");

        if (outletData) {
          setOutlets(outletData);

          // Auto-select outlet for Admin (locked to their outlet)
          if (userRecord.role === "ADMIN" && userRecord.outlet_id) {
            setSelectedOutletId(userRecord.outlet_id);
          }
          // For Owner, no auto-select — they must choose
        }
      } catch (err) {
        console.error("OutletContext init error:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  return (
    <OutletContext.Provider
      value={{
        outlets,
        selectedOutletId,
        setSelectedOutletId,
        userRole,
        userId,
        loading,
      }}
    >
      {children}
    </OutletContext.Provider>
  );
}

export function useOutletContext() {
  return useContext(OutletContext);
}
