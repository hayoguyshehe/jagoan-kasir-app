"use client";

import { useEffect, useState } from "react";
import { Plus, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getContrastColor } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Outlet = any;

export default function SettingsPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [userRole, setUserRole] = useState("STAFF");
  
  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Check if user is OWNER
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: userRecord } = await supabase.from("users").select("role").eq("id", userData.user.id).single();
      if (userRecord) setUserRole(userRecord.role);
    }
    
    const { data, error } = await supabase
        .from("outlets")
      .select("*")
      .order("name");
    
    if (!error && data) {
      setOutlets(data);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setAddress("");
    setPhone("");
  };

  const handleEdit = (o: Outlet) => {
    setEditingId(o.id);
    setName(o.name);
    setAddress(o.address || "");
    setPhone(o.phone || "");
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this outlet? This might break transactions tied to it.")) return;
    const { error } = await supabase.from("outlets").delete().eq("id", id);
    if (!error) {
      fetchData();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      name,
      address,
      phone
    };

    if (editingId) {
      await supabase.from("outlets").update(payload).eq("id", editingId);
    } else {
      await supabase.from("outlets").insert(payload);
    }

    setIsDialogOpen(false);
    resetForm();
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Settings & Outlets</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Outlets Management</CardTitle>
            <CardDescription>Manage your store branches. Only Owners can create or edit outlets.</CardDescription>
          </div>
          {userRole === "OWNER" && (
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              {/* @ts-ignore */}
<DialogTrigger asChild>
                <Button style={{ backgroundColor: process.env.NEXT_PUBLIC_PRIMARY_COLOR, color: getContrastColor(process.env.NEXT_PUBLIC_PRIMARY_COLOR) }}>
                  <Plus className="mr-2 h-4 w-4" /> Add Outlet
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingId ? "Edit Outlet" : "Add New Outlet"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Outlet Name</Label>
                    <Input value={name} onChange={e => setName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input value={address} onChange={e => setAddress(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button type="submit" style={{ backgroundColor: process.env.NEXT_PUBLIC_PRIMARY_COLOR, color: getContrastColor(process.env.NEXT_PUBLIC_PRIMARY_COLOR) }}>
                      Save Outlet
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Outlet Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Phone</TableHead>
                {userRole === "OWNER" && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-24">Loading...</TableCell>
                </TableRow>
              ) : outlets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-24">No outlets found.</TableCell>
                </TableRow>
              ) : (
                outlets.map((outlet) => (
                  <TableRow key={outlet.id}>
                    <TableCell className="font-medium">{outlet.name}</TableCell>
                    <TableCell>{outlet.address || "-"}</TableCell>
                    <TableCell>{outlet.phone || "-"}</TableCell>
                    {userRole === "OWNER" && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(outlet)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(outlet.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
          <CardDescription>Current application settings from environment.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>Brand Name:</strong> {process.env.NEXT_PUBLIC_BRAND_NAME}</p>
          <p><strong>Primary Color:</strong> {process.env.NEXT_PUBLIC_PRIMARY_COLOR}</p>
          <p><strong>InsForge URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL}</p>
        </CardContent>
      </Card>
    </div>
  );
}
