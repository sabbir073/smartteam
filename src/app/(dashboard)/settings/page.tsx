"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Plus, Pencil, Trash2, Loader2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { RequirePermission } from "@/components/shared/require-permission";

interface OrderStatus {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_default: boolean;
  is_terminal: boolean;
}

interface Department {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export default function SettingsPage() {
  const { hasPermission } = usePermissions();

  // Order Statuses
  const [statuses, setStatuses] = useState<OrderStatus[]>([]);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusEditId, setStatusEditId] = useState<string | null>(null);
  const [statusName, setStatusName] = useState("");
  const [statusColor, setStatusColor] = useState("#6b7280");
  const [statusOrder, setStatusOrder] = useState("0");
  const [statusDefault, setStatusDefault] = useState(false);
  const [statusTerminal, setStatusTerminal] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusDeleteId, setStatusDeleteId] = useState<string | null>(null);

  // Departments
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptLoading, setDeptLoading] = useState(true);
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [deptEditId, setDeptEditId] = useState<string | null>(null);
  const [deptName, setDeptName] = useState("");
  const [deptDesc, setDeptDesc] = useState("");
  const [deptSaving, setDeptSaving] = useState(false);
  const [deptDeleteId, setDeptDeleteId] = useState<string | null>(null);

  // Revenue Attribution
  const [attrMode, setAttrMode] = useState("operations");
  const [salesSplit, setSalesSplit] = useState("50");
  const [opsSplit, setOpsSplit] = useState("50");
  const [attrSaving, setAttrSaving] = useState(false);

  // Audit Retention
  const [retentionDays, setRetentionDays] = useState("365");
  const [retentionSaving, setRetentionSaving] = useState(false);

  const fetchStatuses = useCallback(async () => {
    try {
      const res = await fetch("/api/order-statuses");
      if (res.ok) { const json = await res.json(); setStatuses(json.data || []); }
    } catch { toast.error("Failed to load statuses"); }
    finally { setStatusLoading(false); }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch("/api/departments");
      if (res.ok) { const json = await res.json(); setDepartments(json.data || []); }
    } catch { toast.error("Failed to load departments"); }
    finally { setDeptLoading(false); }
  }, []);

  useEffect(() => {
    fetchStatuses();
    fetchDepartments();
    // Fetch revenue settings
    fetch("/api/revenue/settings").then((r) => r.json()).then((json) => {
      if (json.data) {
        setAttrMode(json.data.attribution_mode || "operations");
        setSalesSplit(String(json.data.sales_split_percentage || 50));
        setOpsSplit(String(json.data.operations_split_percentage || 50));
      }
    }).catch(() => {});
    // Fetch audit retention
    fetch("/api/settings").then((r) => r.json()).then((json) => {
      if (json.data?.audit_retention_days) setRetentionDays(String(json.data.audit_retention_days));
    }).catch(() => {});
  }, [fetchStatuses, fetchDepartments]);

  // === Order Status Handlers ===
  function openStatusCreate() {
    setStatusEditId(null); setStatusName(""); setStatusColor("#6b7280");
    setStatusOrder(String((statuses.length + 1) * 1)); setStatusDefault(false); setStatusTerminal(false);
    setStatusDialogOpen(true);
  }

  function openStatusEdit(s: OrderStatus) {
    setStatusEditId(s.id); setStatusName(s.name); setStatusColor(s.color);
    setStatusOrder(String(s.sort_order)); setStatusDefault(s.is_default); setStatusTerminal(s.is_terminal);
    setStatusDialogOpen(true);
  }

  async function handleStatusSave() {
    if (!statusName.trim()) return;
    setStatusSaving(true);
    try {
      const payload = { name: statusName, color: statusColor, sort_order: parseInt(statusOrder) || 0, is_default: statusDefault, is_terminal: statusTerminal };
      const url = statusEditId ? `/api/order-statuses/${statusEditId}` : "/api/order-statuses";
      const method = statusEditId ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) { toast.success(statusEditId ? "Status updated" : "Status created"); setStatusDialogOpen(false); fetchStatuses(); }
      else { const json = await res.json(); toast.error(json.error || "Failed to save"); }
    } catch { toast.error("An error occurred"); }
    finally { setStatusSaving(false); }
  }

  async function handleStatusDelete() {
    if (!statusDeleteId) return;
    try {
      const res = await fetch(`/api/order-statuses/${statusDeleteId}`, { method: "DELETE" });
      if (res.ok) { toast.success("Status deleted"); fetchStatuses(); }
      else { const json = await res.json(); toast.error(json.error || "Failed to delete"); }
    } catch { toast.error("An error occurred"); }
    finally { setStatusDeleteId(null); }
  }

  // === Department Handlers ===
  function openDeptCreate() {
    setDeptEditId(null); setDeptName(""); setDeptDesc(""); setDeptDialogOpen(true);
  }

  function openDeptEdit(d: Department) {
    setDeptEditId(d.id); setDeptName(d.name); setDeptDesc(d.description || ""); setDeptDialogOpen(true);
  }

  async function handleDeptSave() {
    if (!deptName.trim()) return;
    setDeptSaving(true);
    try {
      const payload = { name: deptName, description: deptDesc || null };
      const url = deptEditId ? `/api/departments/${deptEditId}` : "/api/departments";
      const method = deptEditId ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) { toast.success(deptEditId ? "Department updated" : "Department created"); setDeptDialogOpen(false); fetchDepartments(); }
      else { const json = await res.json(); toast.error(json.error || "Failed to save"); }
    } catch { toast.error("An error occurred"); }
    finally { setDeptSaving(false); }
  }

  async function handleDeptDelete() {
    if (!deptDeleteId) return;
    try {
      const res = await fetch(`/api/departments/${deptDeleteId}`, { method: "DELETE" });
      if (res.ok) { toast.success("Department deleted"); fetchDepartments(); }
      else { const json = await res.json(); toast.error(json.error || "Failed to delete"); }
    } catch { toast.error("An error occurred"); }
    finally { setDeptDeleteId(null); }
  }

  async function handleSaveAttribution() {
    setAttrSaving(true);
    try {
      const res = await fetch("/api/revenue/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attribution_mode: attrMode, sales_split_percentage: parseFloat(salesSplit), operations_split_percentage: parseFloat(opsSplit) }),
      });
      if (res.ok) toast.success("Revenue settings saved");
      else { const json = await res.json(); toast.error(json.error || "Failed"); }
    } catch { toast.error("An error occurred"); }
    finally { setAttrSaving(false); }
  }

  async function handleSaveRetention() {
    setRetentionSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audit_retention_days: parseInt(retentionDays) || 365 }),
      });
      if (res.ok) toast.success("Retention setting saved");
      else { const json = await res.json(); toast.error(json.error || "Failed"); }
    } catch { toast.error("An error occurred"); }
    finally { setRetentionSaving(false); }
  }

  const canEdit = hasPermission("settings", "edit");
  const canCreate = hasPermission("settings", "create");
  const canDelete = hasPermission("settings", "delete");

  return (
    <RequirePermission module="settings">
    <div className="space-y-6">
      <PageHeader title="Settings" description="System configuration and management" />

      <Tabs defaultValue="statuses">
        <TabsList>
          <TabsTrigger value="statuses">Order Statuses</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Attribution</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        {/* ORDER STATUSES TAB */}
        <TabsContent value="statuses" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Order Statuses</CardTitle>
                  <CardDescription>Define the lifecycle stages for orders</CardDescription>
                </div>
                {canCreate && (
                  <Button size="sm" onClick={openStatusCreate}><Plus className="mr-1 h-4 w-4" />Add Status</Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {statusLoading ? (
                <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}</div>
              ) : statuses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No order statuses configured.</p>
              ) : (
                <div className="space-y-2">
                  {statuses.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-md border">
                      <div className="flex items-center gap-3">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: s.color }} />
                        <span className="font-medium">{s.name}</span>
                        {s.is_default && <Badge variant="outline" className="text-[10px]">Default</Badge>}
                        {s.is_terminal && <Badge variant="secondary" className="text-[10px]">Terminal</Badge>}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground mr-2">Order: {s.sort_order}</span>
                        {canEdit && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openStatusEdit(s)}><Pencil className="h-3 w-3" /></Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setStatusDeleteId(s.id)}><Trash2 className="h-3 w-3" /></Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DEPARTMENTS TAB */}
        <TabsContent value="departments" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Departments</CardTitle>
                  <CardDescription>Organizational departments</CardDescription>
                </div>
                {canCreate && (
                  <Button size="sm" onClick={openDeptCreate}><Plus className="mr-1 h-4 w-4" />Add Department</Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {deptLoading ? (
                <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}</div>
              ) : departments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No departments configured.</p>
              ) : (
                <div className="space-y-2">
                  {departments.map((d) => (
                    <div key={d.id} className="flex items-center justify-between p-3 rounded-md border">
                      <div>
                        <span className="font-medium">{d.name}</span>
                        {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant={d.is_active ? "outline" : "secondary"}>{d.is_active ? "Active" : "Inactive"}</Badge>
                        {canEdit && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDeptEdit(d)}><Pencil className="h-3 w-3" /></Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeptDeleteId(d.id)}><Trash2 className="h-3 w-3" /></Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* REVENUE ATTRIBUTION TAB */}
        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Attribution</CardTitle>
              <CardDescription>Configure how revenue is attributed between sales and operations teams</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Attribution Mode</Label>
                <Select value={attrMode} onValueChange={(v) => v && setAttrMode(v)} disabled={!canEdit}>
                  <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">Sales (revenue credited to sales member)</SelectItem>
                    <SelectItem value="operations">Operations (revenue credited to operations member)</SelectItem>
                    <SelectItem value="split">Split (percentage-based split)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {attrMode === "split" && (
                <div className="grid gap-4 grid-cols-2 max-w-md">
                  <div className="space-y-2">
                    <Label>Sales Split (%)</Label>
                    <Input type="number" min="0" max="100" value={salesSplit} onChange={(e) => { setSalesSplit(e.target.value); setOpsSplit(String(100 - (parseFloat(e.target.value) || 0))); }} disabled={!canEdit} />
                  </div>
                  <div className="space-y-2">
                    <Label>Operations Split (%)</Label>
                    <Input type="number" min="0" max="100" value={opsSplit} onChange={(e) => { setOpsSplit(e.target.value); setSalesSplit(String(100 - (parseFloat(e.target.value) || 0))); }} disabled={!canEdit} />
                  </div>
                </div>
              )}
              {canEdit && (
                <Button onClick={handleSaveAttribution} disabled={attrSaving}>
                  {attrSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Attribution Settings
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SYSTEM TAB */}
        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit Log Retention</CardTitle>
              <CardDescription>Configure how long audit logs are retained before automatic cleanup</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 max-w-xs">
                <Label>Retention Period (days)</Label>
                <Input type="number" min="30" max="3650" value={retentionDays} onChange={(e) => setRetentionDays(e.target.value)} disabled={!canEdit} />
                <p className="text-xs text-muted-foreground">Logs older than this will be automatically deleted daily at 2:00 AM UTC.</p>
              </div>
              {canEdit && (
                <Button onClick={handleSaveRetention} disabled={retentionSaving}>
                  {retentionSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Retention Setting
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Status Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{statusEditId ? "Edit" : "Add"} Order Status</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Status Name</Label>
                <Input value={statusName} onChange={(e) => setStatusName(e.target.value)} placeholder="e.g., In Progress" />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={statusColor} onChange={(e) => setStatusColor(e.target.value)} className="h-10 w-10 rounded border cursor-pointer" />
                  <Input value={statusColor} onChange={(e) => setStatusColor(e.target.value)} className="flex-1" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Sort Order</Label>
              <Input type="number" value={statusOrder} onChange={(e) => setStatusOrder(e.target.value)} />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={statusDefault} onCheckedChange={setStatusDefault} />
                <Label>Default status (auto-assigned on new orders)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={statusTerminal} onCheckedChange={setStatusTerminal} />
                <Label>Terminal (order completed/cancelled)</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleStatusSave} disabled={statusSaving || !statusName.trim()}>
              {statusSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {statusEditId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Department Dialog */}
      <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{deptEditId ? "Edit" : "Add"} Department</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Department Name</Label>
              <Input value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="e.g., Engineering" />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input value={deptDesc} onChange={(e) => setDeptDesc(e.target.value)} placeholder="Brief description..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeptDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleDeptSave} disabled={deptSaving || !deptName.trim()}>
              {deptSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {deptEditId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmations */}
      <AlertDialog open={!!statusDeleteId} onOpenChange={() => setStatusDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order Status</AlertDialogTitle>
            <AlertDialogDescription>Statuses in use by orders cannot be deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleStatusDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deptDeleteId} onOpenChange={() => setDeptDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department</AlertDialogTitle>
            <AlertDialogDescription>This will remove the department. Users in this department will be unassigned.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeptDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </RequirePermission>
  );
}
