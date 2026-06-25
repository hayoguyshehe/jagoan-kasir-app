"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, MonitorSmartphone } from "lucide-react";
import { insforge } from "@/lib/insforge";
import { useOutletContext } from "@/context/outlet-context";
import { OutletSelector } from "@/components/layout/outlet-selector";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SecurityLog = any;

export default function SecurityPage() {
  const { selectedOutletId } = useOutletContext();
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, [selectedOutletId]);

  const fetchLogs = async () => {
    setLoading(true);
    let query = insforge.database
      .from("security_logs")
      .select("*, outlet:outlets(name), staff:users!security_logs_staff_id_fkey(name)")
      .order("created_at", { ascending: false })
      .limit(50);
      
    if (selectedOutletId) {
      query = query.eq('outlet_id', selectedOutletId);
    }

    const { data, error } = await query;
      
    if (!error && data) {
      setLogs(data);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-red-600 flex items-center">
            <ShieldAlert className="mr-3 h-8 w-8" />
            Security Alerts
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor unrecognized device logins and suspicious activities.
          </p>
        </div>
        <OutletSelector />
      </div>

      <div className="rounded-md border bg-white dark:bg-gray-950">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Outlet</TableHead>
              <TableHead>Staff Name</TableHead>
              <TableHead>Event Type</TableHead>
              <TableHead>Device Info</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center h-24">Loading...</TableCell></TableRow>
            ) : logs.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center h-24 text-gray-500">No security alerts found. All clear!</TableCell></TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id} className="bg-red-50/30">
                  <TableCell className="font-medium">{new Date(log.created_at).toLocaleString("id-ID")}</TableCell>
                  <TableCell>{log.outlet?.name || "-"}</TableCell>
                  <TableCell>
                    {log.staff?.name || log.attempted_name}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-800">
                      {log.event_type.replace(/_/g, ' ')}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-gray-600 font-mono">
                    <div className="flex items-center">
                      <MonitorSmartphone className="mr-2 h-3 w-3" />
                      {log.device_info}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
