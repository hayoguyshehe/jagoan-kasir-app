"use client";

import { useEffect, useState } from "react";
import { UserCheck, UserX, Plus, Key } from "lucide-react";
import { insforge } from "@/lib/insforge";
import { useOutletContext } from "@/context/outlet-context";
import { OutletSelector } from "@/components/layout/outlet-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type User = any;

export default function StaffPage() {
  const { selectedOutletId } = useOutletContext();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isResetDialog, setIsResetDialog] = useState(false);
  
  // Form state
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState("STAFF");

  useEffect(() => {
    fetchUsers();
  }, [selectedOutletId]);

  const fetchUsers = async () => {
    setLoading(true);
    let query = insforge.database
      .from("users")
      .select("*, outlet:outlets(name)")
      .order("created_at", { ascending: false });
      
    if (selectedOutletId) {
      query = query.eq('outlet_id', selectedOutletId);
    }

    const { data, error } = await query;
      
    if (!error && data) {
      setUsers(data);
    }
    setLoading(false);
  };

  const toggleActiveStatus = async (id: string, currentStatus: boolean) => {
    if (!confirm(`Are you sure you want to ${currentStatus ? "deactivate" : "activate"} this user?`)) return;
    
    const { error } = await insforge.database
        .from("users")
      .update({ is_active: !currentStatus })
      .eq("id", id);
      
    if (!error) {
      fetchUsers();
    }
  };

  const generatePin = () => {
    const newPin = Math.floor(100000 + Math.random() * 900000).toString();
    setPin(newPin);
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || pin.length < 6) return alert("PIN must be at least 6 digits");
    
    try {
      const res = await insforge.functions.invoke('manage-users', {
        body: {
          action: 'create_staff',
          name,
          pin,
          role,
          outletId: selectedOutletId
        }
      });
      if (res.error) throw res.error;
      alert("Staff created successfully!");
      setIsDialogOpen(false);
      fetchUsers();
    } catch (err: any) {
      alert("Failed to create staff: " + err.message);
    }
  };

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff || !pin || pin.length < 6) return alert("PIN must be at least 6 digits");
    
    try {
      const res = await insforge.functions.invoke('manage-users', {
        body: {
          action: 'reset_pin',
          staffId: selectedStaff.id,
          pin
        }
      });
      if (res.error) throw res.error;
      alert("PIN reset successfully!");
      setIsResetDialog(false);
      fetchUsers();
    } catch (err: any) {
      alert("Failed to reset PIN: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
          <p className="text-sm text-gray-500">
            Create staff accounts with auto-generated PINs.
          </p>
        </div>
        <div className="flex gap-4">
          <OutletSelector />
          <Button onClick={() => { setName(""); generatePin(); setIsDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Staff
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-white dark:bg-gray-950">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Outlet</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center h-24">Loading...</TableCell></TableRow>
            ) : users.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center h-24">No users found.</TableCell></TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {user.role}
                    </span>
                  </TableCell>
                  <TableCell>{user.outlet?.name || "-"}</TableCell>
                  <TableCell>
                    {user.is_active ? (
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800">Active</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-800">Inactive</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => { setSelectedStaff(user); generatePin(); setIsResetDialog(true); }}
                    >
                      <Key className="mr-2 h-4 w-4" /> Reset PIN
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => toggleActiveStatus(user.id, user.is_active)}
                      className={user.is_active ? "text-red-600" : "text-green-600"}
                    >
                      {user.is_active ? <UserX className="mr-2 h-4 w-4" /> : <UserCheck className="mr-2 h-4 w-4" />}
                      {user.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Staff</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateStaff} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Nickname</Label>
              <Input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Budi" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <select className="flex h-10 w-full rounded-md border border-input px-3 py-2 text-sm" value={role} onChange={e => setRole(e.target.value)}>
                <option value="STAFF">Staff (Kasir)</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Generated PIN</Label>
              <div className="flex gap-2">
                <Input value={pin} readOnly className="font-mono text-lg font-bold tracking-widest text-center" />
                <Button type="button" variant="outline" onClick={generatePin}>Regenerate</Button>
              </div>
              <p className="text-xs text-gray-500">Share this PIN with the staff. They will use their Nickname and PIN to log into the Cashier App.</p>
            </div>
            <Button type="submit" className="w-full">Create Staff</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isResetDialog} onOpenChange={setIsResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset PIN for {selectedStaff?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleResetPin} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>New Generated PIN</Label>
              <div className="flex gap-2">
                <Input value={pin} readOnly className="font-mono text-lg font-bold tracking-widest text-center" />
                <Button type="button" variant="outline" onClick={generatePin}>Regenerate</Button>
              </div>
            </div>
            <Button type="submit" className="w-full">Reset PIN</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
