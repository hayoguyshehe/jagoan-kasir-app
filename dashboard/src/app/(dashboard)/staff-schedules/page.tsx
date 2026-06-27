"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getContrastColor } from "@/lib/utils";
import { useOutletContext } from "@/context/outlet-context";
import { OutletSelector } from "@/components/layout/outlet-selector";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CalendarDays, Plus, User, Clock, Calendar as CalendarIcon, Trash2 } from "lucide-react";

type Staff = {
  id: string;
  email: string;
};

type Schedule = {
  id: string;
  user_id: string;
  schedule_date: string;
  shift_start: string | null;
  shift_end: string | null;
  is_off: boolean;
  notes: string | null;
  user?: { email: string };
};

export default function StaffSchedulesPage() {
  const { selectedOutletId, userId } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [formDate, setFormDate] = useState("");
  const [formStaffId, setFormStaffId] = useState("");
  const [formStart, setFormStart] = useState("08:00");
  const [formEnd, setFormEnd] = useState("16:00");
  const [formIsOff, setFormIsOff] = useState(false);
  const [formNotes, setFormNotes] = useState("");

  useEffect(() => {
    if (selectedOutletId) {
      fetchData();
    } else {
      setStaff([]);
      setSchedules([]);
      setLoading(false);
    }
  }, [selectedOutletId, selectedMonth, selectedYear]);

  const fetchData = async () => {
    if (!selectedOutletId) return;
    setLoading(true);

    // Fetch all staff users (role = STAFF)
    const { data: staffData } = await supabase
      .from("users")
      .select("id, email")
      .eq("role", "STAFF");

    if (staffData) setStaff(staffData);

    // Fetch schedules for the selected month/year
    const startDate = new Date(selectedYear, selectedMonth, 1).toISOString().split("T")[0];
    const endDate = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split("T")[0];

    const { data: schedData } = await supabase
      .from("staff_schedules")
      .select("*, user:users(email)")
      .eq("outlet_id", selectedOutletId)
      .gte("schedule_date", startDate)
      .lte("schedule_date", endDate);

    if (schedData) setSchedules(schedData);
    setLoading(false);
  };

  const openNewScheduleDialog = (dateStr: string) => {
    setEditingScheduleId(null);
    setFormDate(dateStr);
    setFormStaffId("");
    setFormStart("08:00");
    setFormEnd("16:00");
    setFormIsOff(false);
    setFormNotes("");
    setIsDialogOpen(true);
  };

  const openEditScheduleDialog = (sched: Schedule) => {
    setEditingScheduleId(sched.id);
    setFormDate(sched.schedule_date);
    setFormStaffId(sched.user_id);
    setFormStart(sched.shift_start ? sched.shift_start.substring(0, 5) : "08:00");
    setFormEnd(sched.shift_end ? sched.shift_end.substring(0, 5) : "16:00");
    setFormIsOff(sched.is_off);
    setFormNotes(sched.notes || "");
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus jadwal ini?")) return;
    const { error } = await supabase.from("staff_schedules").delete().eq("id", id);
    if (!error) fetchData();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOutletId || !userId || !formStaffId || !formDate) return;

    const payload = {
      user_id: formStaffId,
      outlet_id: selectedOutletId,
      schedule_date: formDate,
      shift_start: formIsOff ? null : formStart,
      shift_end: formIsOff ? null : formEnd,
      is_off: formIsOff,
      notes: formNotes,
      created_by: userId,
    };

    if (editingScheduleId) {
      const { error } = await supabase
        .from("staff_schedules")
        .update(payload)
        .eq("id", editingScheduleId);

      if (error) {
        alert("Gagal update jadwal: " + error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from("staff_schedules")
        .insert(payload);

      if (error) {
        if (error.code === '23505') {
          alert("Gagal: Staff tersebut sudah memiliki jadwal di tanggal ini untuk outlet yang sama.");
        } else {
          alert("Gagal menambah jadwal: " + error.message);
        }
        return;
      }
    }

    setIsDialogOpen(false);
    fetchData();
  };

  // Calendar logic
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  // Group schedules by date
  const schedulesByDate = schedules.reduce((acc, curr) => {
    if (!acc[curr.schedule_date]) acc[curr.schedule_date] = [];
    acc[curr.schedule_date].push(curr);
    return acc;
  }, {} as Record<string, Schedule[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Jadwal Staff</h1>
        <OutletSelector />
      </div>

      {!selectedOutletId ? (
        <div className="flex flex-col items-center justify-center h-64 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 dark:bg-gray-900">
          <p className="text-lg font-medium text-gray-500">Pilih outlet terlebih dahulu</p>
          <p className="text-sm text-gray-400 mt-1">Gunakan dropdown di atas untuk memilih outlet</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4 bg-white p-4 rounded-lg border dark:bg-gray-950">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-gray-500" />
              <select
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              >
                {months.map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              >
                {[selectedYear - 1, selectedYear, selectedYear + 1].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-lg border shadow-sm overflow-hidden dark:bg-gray-950">
            <div className="grid grid-cols-7 border-b bg-gray-50 dark:bg-gray-900">
              {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
                <div key={d} className="px-2 py-3 text-center text-xs font-semibold text-gray-500">
                  {d}
                </div>
              ))}
            </div>

            {loading ? (
              <div className="p-12 text-center text-gray-500">Memuat jadwal...</div>
            ) : (
              <div className="grid grid-cols-7 auto-rows-[120px]">
                {/* Offset for first day of month */}
                {Array.from({ length: (new Date(selectedYear, selectedMonth, 1).getDay() + 6) % 7 }).map((_, i) => (
                  <div key={`empty-${i}`} className="border-b border-r bg-gray-50/50 dark:bg-gray-900/50"></div>
                ))}
                
                {days.map((day) => {
                  const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const daySchedules = schedulesByDate[dateStr] || [];

                  return (
                    <div key={day} className="border-b border-r p-2 relative group overflow-y-auto custom-scrollbar">
                      <div className="text-right text-xs font-medium text-gray-400 mb-1">{day}</div>
                      
                      <div className="space-y-1">
                        {daySchedules.map((s) => (
                          <div 
                            key={s.id} 
                            onClick={() => openEditScheduleDialog(s)}
                            className={`px-1.5 py-1 text-xs rounded border cursor-pointer hover:opacity-80 transition-opacity truncate ${
                              s.is_off 
                                ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400' 
                                : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400'
                            }`}
                            title={`${s.user?.email} - ${s.is_off ? 'OFF' : `${s.shift_start?.substring(0,5)} - ${s.shift_end?.substring(0,5)}`}`}
                          >
                            <span className="font-semibold">{s.user?.email.split('@')[0]}</span>
                            <br />
                            {s.is_off ? (
                              <span className="text-[10px] font-bold">OFF</span>
                            ) : (
                              <span className="text-[10px]">{s.shift_start?.substring(0,5)} - {s.shift_end?.substring(0,5)}</span>
                            )}
                          </div>
                        ))}
                      </div>

                      <button 
                        onClick={() => openNewScheduleDialog(dateStr)}
                        className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 p-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600 transition-opacity dark:bg-gray-800 dark:hover:bg-gray-700"
                        title="Tambah Jadwal"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingScheduleId ? "Edit Jadwal" : "Tambah Jadwal Baru"}</DialogTitle>
                <p className="text-sm text-gray-500">Tanggal: {formDate}</p>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Staff</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formStaffId}
                    onChange={(e) => setFormStaffId(e.target.value)}
                    required
                    disabled={!!editingScheduleId} // Cannot change user when editing
                  >
                    <option value="" disabled>Pilih staff...</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>{s.email}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-center gap-2 py-2">
                  <input 
                    type="checkbox" 
                    id="is_off" 
                    checked={formIsOff}
                    onChange={(e) => setFormIsOff(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="is_off" className="cursor-pointer">Tandai sebagai Hari Libur (OFF)</Label>
                </div>

                {!formIsOff && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Mulai Shift</Label>
                      <Input type="time" value={formStart} onChange={(e) => setFormStart(e.target.value)} required={!formIsOff} />
                    </div>
                    <div className="space-y-2">
                      <Label>Akhir Shift</Label>
                      <Input type="time" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} required={!formIsOff} />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Catatan (Opsional)</Label>
                  <Input value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Misal: Shift backup" />
                </div>

                <div className="flex justify-between pt-4">
                  {editingScheduleId ? (
                    <Button type="button" variant="destructive" onClick={() => handleDelete(editingScheduleId)}>
                      <Trash2 className="h-4 w-4 mr-2" /> Hapus
                    </Button>
                  ) : <div></div>}
                  <Button type="submit" style={{ backgroundColor: process.env.NEXT_PUBLIC_PRIMARY_COLOR, color: getContrastColor(process.env.NEXT_PUBLIC_PRIMARY_COLOR) }}>
                    Simpan Jadwal
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
