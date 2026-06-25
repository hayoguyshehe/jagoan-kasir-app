import { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { OutletProvider } from "@/context/outlet-context";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <OutletProvider>
      <div className="flex h-screen items-center justify-center bg-slate-100 p-2 sm:p-4 lg:p-6">
        <div className="flex h-full w-full max-w-[1600px] overflow-hidden rounded-[2rem] bg-white shadow-xl shadow-slate-200/50">
          <div className="hidden lg:block lg:flex-shrink-0">
            <Sidebar />
          </div>
          <div className="flex w-0 flex-1 flex-col overflow-hidden bg-[#F8FAFC]">
            <Topbar />
            <main className="relative flex-1 overflow-y-auto focus:outline-none">
              <div className="py-6">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
                  {children}
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </OutletProvider>
  );
}
