"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Pencil, Trash2, Loader2, Target } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { RequirePermission } from "@/components/shared/require-permission";
import { formatCurrency } from "@/lib/order-utils";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, addMonths } from "date-fns";

interface TargetRow {
  id: string;
  user_id: string;
  period_type: string;
  period_start: string;
  period_end: string;
  target_amount: number;
  achieved_amount: number;
  gap: number;
  achievement_percentage: number;
  users: { id: string; name: string; email: string; avatar_url: string | null } | null;
  [key: string]: unknown;
}

export default function TargetsPage() {
  const { hasPermission } = usePermissions();
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState("");

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formUserId, setFormUserId] = useState("");
  const [formPeriodType, setFormPeriodType] = useState("monthly");
  const [formAmount, setFormAmount] = useState("");
  const [formPeriodStart, setFormPeriodStart] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Users list
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  const fetchTargets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (periodFilter) params.set("period_type", periodFilter);
      const res = await fetch(`/api/targets?${params}`);
      if (res.ok) { const json = await res.json(); setTargets(json.data || []); }
    } catch { toast.error("Failed to load targets"); }
    finally { setLoading(false); }
  }, [periodFilter]);

  useEffect(() => {
    fetchTargets();
    fetch("/api/users?pageSize=200").then((r) => r.json())
      .then((json) => setUsers((json.data || []).map((u: { id: string; name: string }) => ({ id: u.id, name: u.name }))))
      .catch(() => {});
  }, [fetchTargets]);

  function openCreate() {
    setEditId(null);
    setFormUserId("");
    setFormPeriodType("monthly");
    setFormAmount("");
    const now = new Date();
    setFormPeriodStart(format(startOfMonth(now), "yyyy-MM-dd"));
    setDialogOpen(true);
  }

  function openEdit(t: TargetRow) {
    setEditId(t.id);
    setFormAmount(String(t.target_amount));
    setDialogOpen(true);
  }

  function computePeriodEnd(periodType: string, start: string): string {
    const d = new Date(start);
    switch (periodType) {
      case "monthly": return format(endOfMonth(d), "yyyy-MM-dd");
      case "quarterly": return format(endOfMonth(addMonths(d, 2)), "yyyy-MM-dd");
      case "yearly": return format(endOfYear(d), "yyyy-MM-dd");
      default: return format(endOfMonth(d), "yyyy-MM-dd");
    }
  }

  async function handleSave() {
    if (!formAmount) return;
    setSaving(true);
    try {
      if (editId) {
        // Update existing
        const res = await fetch(`/api/targets/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_amount: parseFloat(formAmount) }),
        });
        if (res.ok) { toast.success("Target updated"); setDialogOpen(false); fetchTargets(); }
        else { const json = await res.json(); toast.error(json.error || "Failed"); }
      } else {
        // Create new
        if (!formUserId) { toast.error("Select a user"); setSaving(false); return; }
        const periodEnd = computePeriodEnd(formPeriodType, formPeriodStart);
        const res = await fetch("/api/targets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: formUserId,
            period_type: formPeriodType,
            period_start: formPeriodStart,
            period_end: periodEnd,
            target_amount: parseFloat(formAmount),
          }),
        });
        if (res.ok) { toast.success("Target created"); setDialogOpen(false); fetchTargets(); }
        else { const json = await res.json(); toast.error(json.error || "Failed"); }
      }
    } catch { toast.error("An error occurred"); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/targets/${deleteId}`, { method: "DELETE" });
      if (res.ok) { toast.success("Target deleted"); fetchTargets(); }
      else { const json = await res.json(); toast.error(json.error || "Failed"); }
    } catch { toast.error("An error occurred"); }
    finally { setDeleteId(null); }
  }

  const columns: Column<TargetRow>[] = [
    {
      key: "user", header: "User",
      render: (t) => {
        const u = Array.isArray(t.users) ? t.users[0] : t.users;
        if (!u) return <span>-</span>;
        return (
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7"><AvatarImage src={(u as Record<string, string | null>).avatar_url || undefined} /><AvatarFallback className="text-[9px]">{(u as Record<string, string>).name?.[0]}</AvatarFallback></Avatar>
            <div>
              <p className="font-medium text-sm">{(u as Record<string, string>).name}</p>
              <p className="text-[11px] text-muted-foreground">{(u as Record<string, string>).email}</p>
            </div>
          </div>
        );
      },
    },
    { key: "period_type", header: "Period", render: (t) => <Badge variant="outline" className="capitalize">{t.period_type}</Badge> },
    { key: "period_start", header: "Duration", render: (t) => <span className="text-sm">{t.period_start} to {t.period_end}</span> },
    { key: "target_amount", header: "Target", render: (t) => <span className="font-medium">{formatCurrency(t.target_amount)}</span>, className: "text-right" },
    { key: "achieved_amount", header: "Achieved", render: (t) => <span className="font-medium text-green-600">{formatCurrency(t.achieved_amount)}</span>, className: "text-right" },
    {
      key: "progress", header: "Progress",
      render: (t) => (
        <div className="flex items-center gap-2 min-w-[140px]">
          <Progress value={Math.min(t.achievement_percentage, 100)} className="h-2 flex-1" />
          <span className={`text-xs font-medium w-12 text-right ${t.achievement_percentage >= 100 ? "text-green-600" : t.achievement_percentage >= 70 ? "text-yellow-600" : "text-destructive"}`}>
            {t.achievement_percentage}%
          </span>
        </div>
      ),
    },
    { key: "gap", header: "Gap", render: (t) => <span className={`text-sm ${t.gap <= 0 ? "text-green-600" : "text-destructive"}`}>{t.gap <= 0 ? "Achieved!" : formatCurrency(t.gap)}</span>, className: "text-right" },
    {
      key: "actions", header: "", className: "w-20",
      render: (t) => (
        <div className="flex items-center gap-1">
          {hasPermission("targets", "edit") && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}><Pencil className="h-3 w-3" /></Button>
          )}
          {hasPermission("targets", "delete") && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(t.id)}><Trash2 className="h-3 w-3" /></Button>
          )}
        </div>
      ),
    },
  ];

  // Summary cards
  const totalTarget = targets.reduce((s, t) => s + t.target_amount, 0);
  const totalAchieved = targets.reduce((s, t) => s + t.achieved_amount, 0);
  const overallPercentage = totalTarget > 0 ? Math.round((totalAchieved / totalTarget) * 1000) / 10 : 0;

  return (
    <RequirePermission module="targets">
    <div className="space-y-6">
      <PageHeader title="Targets" description="Revenue targets and achievement tracking">
        {hasPermission("targets", "create") && (
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Set Target</Button>
        )}
      </PageHeader>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Target</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(totalTarget)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Achieved</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(totalAchieved)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Overall Progress</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallPercentage}%</div>
            <Progress value={Math.min(overallPercentage, 100)} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v === "all" ? "" : (v || ""))}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Periods" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Periods</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
            <SelectItem value="yearly">Yearly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={targets} loading={loading} emptyMessage="No targets set yet." />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Edit Target" : "Set New Target"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            {!editId && (
              <>
                <div className="space-y-2">
                  <Label>User</Label>
                  <Select value={formUserId} onValueChange={(v) => setFormUserId(v || "")} items={Object.fromEntries(users.map(u => [u.id, u.name]))}>
                    <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                    <SelectContent>
                      {users.map((u) => <SelectItem key={u.id} value={u.id} label={u.name}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-2">
                    <Label>Period Type</Label>
                    <Select value={formPeriodType} onValueChange={(v) => v && setFormPeriodType(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Period Start</Label>
                    <Input type="date" value={formPeriodStart} onChange={(e) => setFormPeriodStart(e.target.value)} />
                  </div>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Target Amount (USD)</Label>
              <Input type="number" min="0" step="0.01" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="5000.00" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !formAmount}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editId ? "Update" : "Set Target"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Target</AlertDialogTitle><AlertDialogDescription>This will delete the target. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
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
