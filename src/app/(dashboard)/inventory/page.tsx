"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, Column } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { RequirePermission } from "@/components/shared/require-permission";
import { formatCurrency } from "@/lib/order-utils";

interface InvRow {
  id: string; item_name: string; description: string | null; category: string | null;
  cost: number | null; status: string; serial_number: string | null; purchase_date: string | null;
  assigned_user: { id: string; name: string } | null;
  [key: string]: unknown;
}

export default function InventoryPage() {
  const { hasPermission } = usePermissions();
  const [items, setItems] = useState<InvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formCost, setFormCost] = useState("");
  const [formSerial, setFormSerial] = useState("");
  const [formStatus, setFormStatus] = useState("active");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/inventory");
      if (res.ok) { const json = await res.json(); setItems(json.data || []); }
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openCreate() {
    setEditId(null); setFormName(""); setFormDesc(""); setFormCategory(""); setFormCost(""); setFormSerial(""); setFormStatus("active");
    setDialogOpen(true);
  }

  function openEdit(item: InvRow) {
    setEditId(item.id); setFormName(item.item_name); setFormDesc(item.description || "");
    setFormCategory(item.category || ""); setFormCost(item.cost ? String(item.cost) : "");
    setFormSerial(item.serial_number || ""); setFormStatus(item.status);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formName) return;
    setSaving(true);
    try {
      const payload = { item_name: formName, description: formDesc || undefined, category: formCategory || undefined, cost: formCost ? parseFloat(formCost) : undefined, serial_number: formSerial || undefined, status: formStatus };
      const url = editId ? `/api/inventory/${editId}` : "/api/inventory";
      const method = editId ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) { toast.success(editId ? "Updated" : "Added"); setDialogOpen(false); fetchData(); }
      else { const json = await res.json(); toast.error(json.error || "Failed"); }
    } catch { toast.error("An error occurred"); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/inventory/${deleteId}`, { method: "DELETE" });
      if (res.ok) { toast.success("Deleted"); fetchData(); }
    } catch { toast.error("Failed"); }
    finally { setDeleteId(null); }
  }

  const statusColors: Record<string, string> = { active: "default", retired: "secondary", under_repair: "outline" };

  const columns: Column<InvRow>[] = [
    { key: "item_name", header: "Item", render: (i) => <span className="font-medium">{i.item_name}</span> },
    { key: "category", header: "Category", render: (i) => i.category ? <Badge variant="outline">{i.category}</Badge> : <span>-</span> },
    { key: "serial_number", header: "Serial #", render: (i) => <span className="font-mono text-sm">{i.serial_number || "-"}</span> },
    { key: "cost", header: "Cost", render: (i) => i.cost ? formatCurrency(i.cost) : "-" },
    { key: "status", header: "Status", render: (i) => <Badge variant={statusColors[i.status] as "default" | "secondary" | "outline"}>{i.status.replace("_", " ")}</Badge> },
    {
      key: "assigned", header: "Assigned To",
      render: (i) => { const u = Array.isArray(i.assigned_user) ? i.assigned_user[0] : i.assigned_user; return <span className="text-sm">{(u as Record<string, string>)?.name || "Unassigned"}</span>; },
    },
    {
      key: "actions", header: "", className: "w-20",
      render: (i) => (
        <div className="flex gap-1">
          {hasPermission("inventory", "edit") && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(i)}><Pencil className="h-3 w-3" /></Button>}
          {hasPermission("inventory", "delete") && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(i.id)}><Trash2 className="h-3 w-3" /></Button>}
        </div>
      ),
    },
  ];

  return (
    <RequirePermission module="inventory">
    <div className="space-y-6">
      <PageHeader title="Tech Inventory" description="Manage technology equipment and assets">
        {hasPermission("inventory", "create") && <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add Item</Button>}
      </PageHeader>

      {/* Summary Cards */}
      {items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="stat-card"><div className="text-sm text-muted-foreground">Total Items</div><div className="text-2xl font-bold">{items.length}</div></div>
          <div className="stat-card"><div className="text-sm text-muted-foreground">Active</div><div className="text-2xl font-bold text-success">{items.filter((i: Record<string, unknown>) => i.status === "active").length}</div></div>
          <div className="stat-card"><div className="text-sm text-muted-foreground">Under Repair</div><div className="text-2xl font-bold text-warning">{items.filter((i: Record<string, unknown>) => i.status === "under_repair").length}</div></div>
          <div className="stat-card"><div className="text-sm text-muted-foreground">Total Value</div><div className="text-2xl font-bold">${items.reduce((s: number, i: Record<string, unknown>) => s + Number(i.cost || 0), 0).toLocaleString()}</div></div>
        </div>
      )}

      <DataTable columns={columns} data={items} loading={loading} emptyMessage="No inventory items." />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Edit" : "Add"} Inventory Item</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Item Name</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g., Dell Monitor 27'" /></div>
            <div className="space-y-2"><Label>Description</Label><Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} /></div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2"><Label>Category</Label><Input value={formCategory} onChange={(e) => setFormCategory(e.target.value)} placeholder="e.g., Monitor" /></div>
              <div className="space-y-2"><Label>Serial Number</Label><Input value={formSerial} onChange={(e) => setFormSerial(e.target.value)} /></div>
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2"><Label>Cost (USD)</Label><Input type="number" min="0" step="0.01" value={formCost} onChange={(e) => setFormCost(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formStatus} onValueChange={(v) => v && setFormStatus(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                    <SelectItem value="under_repair">Under Repair</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !formName}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editId ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Item</AlertDialogTitle><AlertDialogDescription>Remove this item from inventory?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </RequirePermission>
  );
}
