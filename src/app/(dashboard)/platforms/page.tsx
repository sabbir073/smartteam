"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTable, Column } from "@/components/shared/data-table";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { RequirePermission } from "@/components/shared/require-permission";

interface PlatformRow {
  id: string;
  name: string;
  charge_percentage: number;
  is_active: boolean;
  [key: string]: unknown;
}

export default function PlatformsPage() {
  const { hasPermission } = usePermissions();
  const [platforms, setPlatforms] = useState<PlatformRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formCharge, setFormCharge] = useState("0");
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/platforms");
      if (res.ok) {
        const json = await res.json();
        setPlatforms(json.data || []);
      }
    } catch { toast.error("Failed to load platforms"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openCreate() {
    setEditId(null);
    setFormName("");
    setFormCharge("0");
    setFormActive(true);
    setDialogOpen(true);
  }

  function openEdit(p: PlatformRow) {
    setEditId(p.id);
    setFormName(p.name);
    setFormCharge(String(p.charge_percentage));
    setFormActive(p.is_active);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const payload = { name: formName, charge_percentage: parseFloat(formCharge) || 0, is_active: formActive };
      const url = editId ? `/api/platforms/${editId}` : "/api/platforms";
      const method = editId ? "PATCH" : "POST";

      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) {
        toast.success(editId ? "Platform updated" : "Platform created");
        setDialogOpen(false);
        fetchData();
      } else {
        const json = await res.json();
        toast.error(json.error || "Failed to save");
      }
    } catch { toast.error("An error occurred"); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/platforms/${deleteId}`, { method: "DELETE" });
      if (res.ok) { toast.success("Platform deleted"); fetchData(); }
      else { const json = await res.json(); toast.error(json.error || "Failed to delete"); }
    } catch { toast.error("An error occurred"); }
    finally { setDeleteId(null); }
  }

  const columns: Column<PlatformRow>[] = [
    { key: "name", header: "Platform Name", render: (p) => <span className="font-medium">{p.name}</span> },
    { key: "charge_percentage", header: "Platform Charge", render: (p) => <Badge variant="outline">{p.charge_percentage}%</Badge> },
    { key: "is_active", header: "Status", render: (p) => <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Active" : "Inactive"}</Badge> },
    {
      key: "actions", header: "", className: "w-24",
      render: (p) => (
        <div className="flex items-center gap-1">
          {hasPermission("platforms", "edit") && (
            <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
          )}
          {hasPermission("platforms", "delete") && (
            <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <RequirePermission module="platforms">
    <div className="space-y-6">
      <PageHeader title="Platforms" description="Manage freelancing platforms and their charge percentages">
        {hasPermission("platforms", "create") && (
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add Platform</Button>
        )}
      </PageHeader>

      <DataTable columns={columns} data={platforms} loading={loading} emptyMessage="No platforms configured." />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Edit" : "Add"} Platform</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pname">Platform Name</Label>
              <Input id="pname" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g., Fiverr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="charge">Charge Percentage (%)</Label>
              <Input id="charge" type="number" min="0" max="100" step="0.01" value={formCharge} onChange={(e) => setFormCharge(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formActive} onCheckedChange={setFormActive} />
              <Label>{formActive ? "Active" : "Inactive"}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Platform</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? Platforms with existing orders cannot be deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </RequirePermission>
  );
}
