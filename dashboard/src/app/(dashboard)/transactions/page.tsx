"use client";

import { useEffect, useState, Fragment } from "react";
import { XCircle, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/dialog";

type Transaction = any;

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTxn, setExpandedTxn] = useState<string | null>(null);

  // Void state
  const [isVoidDialogOpen, setIsVoidDialogOpen] = useState(false);
  const [selectedTxnId, setSelectedTxnId] = useState("");
  const [voidPin, setVoidPin] = useState("");
  const [voidReason, setVoidReason] = useState("");

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    const { data, error } = await insforge.database
      .from("transactions")
      .select("*, staff:users!transactions_staff_id_fkey(email), cycle:business_cycles(status), transaction_items(*)")
      .order("created_at", { ascending: false })
      .limit(100);
      
    if (!error && data) {
      setTransactions(data);
    }
    setLoading(false);
  };

  const handleOpenVoidDialog = (id: string) => {
    setSelectedTxnId(id);
    setVoidPin("");
    setVoidReason("");
    setIsVoidDialogOpen(true);
  };

  const handleVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTxnId || !voidPin || !voidReason) return;

    try {
      const response = await insforge.functions.invoke("void-transaction", {
        body: {
          transactionId: selectedTxnId,
          pin: voidPin,
          reason: voidReason
        }
      });

      if (response.error) throw response.error;
      
      setIsVoidDialogOpen(false);
      fetchTransactions();
      alert("Transaction voided successfully and stock restored.");
    } catch (err: any) {
      alert(err.message || "Failed to void transaction. Check your PIN.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Transactions History</h1>
      </div>

      <div className="rounded-md border bg-white dark:bg-gray-950">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Transaction ID</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center h-24">Loading...</TableCell></TableRow>
            ) : transactions.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center h-24">No transactions found.</TableCell></TableRow>
            ) : (
              transactions.map((txn) => (
                <Fragment key={txn.id}>
                  <TableRow className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900" onClick={() => setExpandedTxn(expandedTxn === txn.id ? null : txn.id)}>
                    <TableCell>
                      {expandedTxn === txn.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </TableCell>
                    <TableCell>{new Date(txn.created_at).toLocaleString("id-ID")}</TableCell>
                    <TableCell className="font-medium text-xs">{txn.id}</TableCell>
                    <TableCell>{txn.staff?.email || "Unknown"}</TableCell>
                    <TableCell>Rp {txn.total_amount?.toLocaleString("id-ID") || 0}</TableCell>
                    <TableCell>{txn.payment_method}</TableCell>
                    <TableCell>
                      {txn.status === "COMPLETED" ? (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800">
                          Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-800">
                          Voided
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {txn.status === "COMPLETED" && (
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleOpenVoidDialog(txn.id); }} className="text-red-500 hover:text-red-600">
                          <XCircle className="mr-2 h-4 w-4" /> Void
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {expandedTxn === txn.id && (
                    <TableRow className="bg-gray-50/50 dark:bg-gray-900/50">
                      <TableCell colSpan={8} className="p-0">
                        <div className="p-4 pl-14">
                          <h4 className="text-sm font-semibold mb-2">Order Items:</h4>
                          <div className="rounded-md border bg-white dark:bg-gray-950">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Product Name</TableHead>
                                  <TableHead>Serve Type</TableHead>
                                  <TableHead>Qty</TableHead>
                                  <TableHead>Price</TableHead>
                                  <TableHead className="text-right">Subtotal</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {txn.transaction_items?.map((item: any) => (
                                  <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.product_name}</TableCell>
                                    <TableCell>{item.serve_type || '-'}</TableCell>
                                    <TableCell>{item.quantity}</TableCell>
                                    <TableCell>Rp {item.price?.toLocaleString("id-ID")}</TableCell>
                                    <TableCell className="text-right font-semibold">Rp {item.subtotal?.toLocaleString("id-ID")}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                          {txn.status === 'VOIDED' && txn.void_reason && (
                            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-md text-sm text-red-800">
                              <span className="font-bold">Void Reason:</span> {txn.void_reason}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isVoidDialogOpen} onOpenChange={setIsVoidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void Transaction</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleVoid} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Reason for Voiding</Label>
              <Input value={voidReason} onChange={e => setVoidReason(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Your PIN</Label>
              <Input type="password" value={voidPin} onChange={e => setVoidPin(e.target.value)} required />
            </div>
            <Button type="submit" variant="destructive" className="w-full">
              Confirm Void & Restore Stock
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
