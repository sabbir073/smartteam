"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Pencil, Trash2, Loader2, GripVertical, Globe, Star,
  ListChecks, Building2, Settings2, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { TIMEZONE_OPTIONS } from "@/lib/timezone";
import { usePermissions } from "@/hooks/use-permissions";
import { RequirePermission } from "@/components/shared/require-permission";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface OrderStatus { id: string; name: string; color: string; sort_order: number; is_default: boolean; is_terminal: boolean; }
interface Department { id: string; name: string; description: string | null; is_active: boolean; }

const SECTIONS = [
  { id: "statuses", label: "Order Statuses", icon: ListChecks },
  { id: "departments", label: "Departments", icon: Building2 },
  { id: "special-orders", label: "Special Orders", icon: Star },
  { id: "system", label: "System", icon: Settings2 },
];

export default function SettingsPage() {
  const { hasPermission } = usePermissions();
  const [activeSection, setActiveSection] = useState("statuses");

  // State (same as before, condensed)
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

  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptLoading, setDeptLoading] = useState(true);
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [deptEditId, setDeptEditId] = useState<string | null>(null);
  const [deptName, setDeptName] = useState("");
  const [deptDesc, setDeptDesc] = useState("");
  const [deptSaving, setDeptSaving] = useState(false);
  const [deptDeleteId, setDeptDeleteId] = useState<string | null>(null);

  const [platformRates, setPlatformRates] = useState<{ id: string; name: string; bdt_conversion_rate: number }[]>([]);
  const [soCurrencyCode, setSoCurrencyCode] = useState("BDT");
  const [soCurrencySymbol, setSoCurrencySymbol] = useState("৳");
  const [soSettingsSaving, setSoSettingsSaving] = useState(false);

  const [timezone, setTimezone] = useState("UTC");
  const [timezoneSaving, setTimezoneSaving] = useState(false);
  const [retentionDays, setRetentionDays] = useState("365");
  const [retentionSaving, setRetentionSaving] = useState(false);

  const fetchStatuses = useCallback(async () => {
    try { const res = await fetch("/api/order-statuses"); if (res.ok) { const j = await res.json(); setStatuses(j.data || []); } }
    catch {} finally { setStatusLoading(false); }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try { const res = await fetch("/api/departments"); if (res.ok) { const j = await res.json(); setDepartments(j.data || []); } }
    catch {} finally { setDeptLoading(false); }
  }, []);

  useEffect(() => {
    fetchStatuses(); fetchDepartments();
    fetch("/api/platforms").then(r => r.json()).then(j => {
      setPlatformRates((j.data || []).map((p: any) => ({ id: p.id, name: p.name, bdt_conversion_rate: Number(p.bdt_conversion_rate || 110) })));
    }).catch(() => {});
    fetch("/api/settings").then(r => r.json()).then(j => {
      if (j.data?.audit_retention_days) setRetentionDays(String(j.data.audit_retention_days));
      if (j.data?.timezone) setTimezone(String(j.data.timezone).replace(/"/g, ""));
      if (j.data?.so_currency_code) setSoCurrencyCode(String(j.data.so_currency_code).replace(/"/g, ""));
      if (j.data?.so_currency_symbol) setSoCurrencySymbol(String(j.data.so_currency_symbol).replace(/"/g, ""));
    }).catch(() => {});
  }, [fetchStatuses, fetchDepartments]);

  // Handlers
  function openStatusCreate() { setStatusEditId(null); setStatusName(""); setStatusColor("#6b7280"); setStatusOrder(String(statuses.length + 1)); setStatusDefault(false); setStatusTerminal(false); setStatusDialogOpen(true); }
  function openStatusEdit(s: OrderStatus) { setStatusEditId(s.id); setStatusName(s.name); setStatusColor(s.color); setStatusOrder(String(s.sort_order)); setStatusDefault(s.is_default); setStatusTerminal(s.is_terminal); setStatusDialogOpen(true); }
  async function handleStatusSave() { if (!statusName.trim()) return; setStatusSaving(true); try { const url = statusEditId ? `/api/order-statuses/${statusEditId}` : "/api/order-statuses"; const res = await fetch(url, { method: statusEditId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: statusName, color: statusColor, sort_order: parseInt(statusOrder) || 0, is_default: statusDefault, is_terminal: statusTerminal }) }); if (res.ok) { toast.success(statusEditId ? "Updated" : "Created"); setStatusDialogOpen(false); fetchStatuses(); } else { const j = await res.json(); toast.error(j.error || "Failed"); } } catch { toast.error("Error"); } finally { setStatusSaving(false); } }
  async function handleStatusDelete() { if (!statusDeleteId) return; try { const res = await fetch(`/api/order-statuses/${statusDeleteId}`, { method: "DELETE" }); if (res.ok) { toast.success("Deleted"); fetchStatuses(); } else { const j = await res.json(); toast.error(j.error || "Failed"); } } catch { toast.error("Error"); } finally { setStatusDeleteId(null); } }

  function openDeptCreate() { setDeptEditId(null); setDeptName(""); setDeptDesc(""); setDeptDialogOpen(true); }
  function openDeptEdit(d: Department) { setDeptEditId(d.id); setDeptName(d.name); setDeptDesc(d.description || ""); setDeptDialogOpen(true); }
  async function handleDeptSave() { if (!deptName.trim()) return; setDeptSaving(true); try { const url = deptEditId ? `/api/departments/${deptEditId}` : "/api/departments"; const res = await fetch(url, { method: deptEditId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: deptName, description: deptDesc || null }) }); if (res.ok) { toast.success(deptEditId ? "Updated" : "Created"); setDeptDialogOpen(false); fetchDepartments(); } else { const j = await res.json(); toast.error(j.error || "Failed"); } } catch { toast.error("Error"); } finally { setDeptSaving(false); } }
  async function handleDeptDelete() { if (!deptDeleteId) return; try { const res = await fetch(`/api/departments/${deptDeleteId}`, { method: "DELETE" }); if (res.ok) { toast.success("Deleted"); fetchDepartments(); } else { const j = await res.json(); toast.error(j.error || "Failed"); } } catch { toast.error("Error"); } finally { setDeptDeleteId(null); } }

  async function handleSaveSOSettings() { setSoSettingsSaving(true); try { await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ so_currency_code: soCurrencyCode, so_currency_symbol: soCurrencySymbol }) }); for (const p of platformRates) { await fetch(`/api/platforms/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bdt_conversion_rate: p.bdt_conversion_rate }) }); } toast.success("Saved"); } catch { toast.error("Failed"); } finally { setSoSettingsSaving(false); } }
  async function handleSaveTimezone() { setTimezoneSaving(true); try { const res = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ timezone }) }); if (res.ok) toast.success("Saved"); else toast.error("Failed"); } catch { toast.error("Error"); } finally { setTimezoneSaving(false); } }
  async function handleSaveRetention() { setRetentionSaving(true); try { const res = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audit_retention_days: parseInt(retentionDays) || 365 }) }); if (res.ok) toast.success("Saved"); else toast.error("Failed"); } catch { toast.error("Error"); } finally { setRetentionSaving(false); } }

  const canEdit = hasPermission("settings", "edit");
  const canCreate = hasPermission("settings", "create");
  const canDelete = hasPermission("settings", "delete");

  return (
    <RequirePermission module="settings">
    <div className="space-y-6">
      <PageHeader title="Settings" description="System configuration and management" />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <nav className="lg:w-56 shrink-0">
          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible rounded-xl border bg-card p-1.5">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeSection === s.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <s.icon className="h-4 w-4 shrink-0" />
                {s.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* ORDER STATUSES */}
          {activeSection === "statuses" && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Order Statuses</h2>
                  <p className="text-sm text-muted-foreground">Define the lifecycle stages for orders</p>
                </div>
                {canCreate && <Button size="sm" onClick={openStatusCreate}><Plus className="mr-1 h-4 w-4" />Add Status</Button>}
              </div>

              {statusLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}</div>
              ) : statuses.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">No order statuses configured.</CardContent></Card>
              ) : (
                <div className="space-y-2">
                  {statuses.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-4 rounded-xl border bg-card hover:shadow-sm transition-shadow">
                      <div className="flex items-center gap-3">
                        <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                        <div className="h-5 w-5 rounded-full border-2 border-background shadow-sm" style={{ backgroundColor: s.color }} />
                        <div>
                          <span className="font-medium">{s.name}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {s.is_default && <Badge variant="outline" className="text-[9px] px-1.5 py-0">Default</Badge>}
                            {s.is_terminal && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Terminal</Badge>}
                            <span className="text-[10px] text-muted-foreground">Sort: {s.sort_order}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openStatusEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>}
                        {canDelete && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setStatusDeleteId(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* DEPARTMENTS */}
          {activeSection === "departments" && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Departments</h2>
                  <p className="text-sm text-muted-foreground">Organizational departments</p>
                </div>
                {canCreate && <Button size="sm" onClick={openDeptCreate}><Plus className="mr-1 h-4 w-4" />Add Department</Button>}
              </div>

              {deptLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}</div>
              ) : departments.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">No departments configured.</CardContent></Card>
              ) : (
                <div className="space-y-2">
                  {departments.map((d) => (
                    <div key={d.id} className="flex items-center justify-between p-4 rounded-xl border bg-card hover:shadow-sm transition-shadow">
                      <div>
                        <span className="font-medium">{d.name}</span>
                        {d.description && <p className="text-xs text-muted-foreground mt-0.5">{d.description}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={d.is_active ? "default" : "secondary"} className="text-[10px]">{d.is_active ? "Active" : "Inactive"}</Badge>
                        {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDeptEdit(d)}><Pencil className="h-3.5 w-3.5" /></Button>}
                        {canDelete && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeptDeleteId(d.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* SPECIAL ORDERS */}
          {activeSection === "special-orders" && (
            <>
              <div>
                <h2 className="text-lg font-semibold">Special Order Settings</h2>
                <p className="text-sm text-muted-foreground">Currency display and conversion rates for special orders</p>
              </div>

              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Display Currency</CardTitle>
                  <CardDescription>Special order costs will be shown in this currency</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-4 max-w-sm">
                    <div className="space-y-2 flex-1">
                      <Label>Code</Label>
                      <Input value={soCurrencyCode} onChange={(e) => setSoCurrencyCode(e.target.value.toUpperCase())} placeholder="BDT" disabled={!canEdit} />
                    </div>
                    <div className="space-y-2 flex-1">
                      <Label>Symbol</Label>
                      <Input value={soCurrencySymbol} onChange={(e) => setSoCurrencySymbol(e.target.value)} placeholder="৳" disabled={!canEdit} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Conversion Rates</CardTitle>
                  <CardDescription>USD to {soCurrencyCode || "local currency"} per platform</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {platformRates.map((p) => (
                    <div key={p.id} className="flex items-center gap-4 p-3 rounded-xl border bg-muted/30 max-w-md">
                      <span className="w-24 shrink-0 font-medium text-sm">{p.name}</span>
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">1 USD =</span>
                        <Input type="number" min="0" step="0.01" value={p.bdt_conversion_rate}
                          onChange={(e) => setPlatformRates(prev => prev.map(r => r.id === p.id ? { ...r, bdt_conversion_rate: parseFloat(e.target.value) || 0 } : r))}
                          disabled={!canEdit} className="w-24" />
                        <span className="text-sm font-medium">{soCurrencySymbol || soCurrencyCode}</span>
                      </div>
                    </div>
                  ))}
                  {canEdit && <Button onClick={handleSaveSOSettings} disabled={soSettingsSaving}>{soSettingsSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>}
                </CardContent>
              </Card>
            </>
          )}

          {/* SYSTEM */}
          {activeSection === "system" && (
            <>
              <div>
                <h2 className="text-lg font-semibold">System Settings</h2>
                <p className="text-sm text-muted-foreground">Timezone and maintenance configuration</p>
              </div>

              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">Timezone</CardTitle>
                  </div>
                  <CardDescription>All dates, reports, and calculations use this timezone</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="max-w-md space-y-2">
                    <Select value={timezone} onValueChange={(v) => v && setTimezone(v)} disabled={!canEdit} items={Object.fromEntries(TIMEZONE_OPTIONS.map(t => [t.value, t.label]))}>
                      <SelectTrigger><SelectValue placeholder="Select timezone" /></SelectTrigger>
                      <SelectContent>
                        {TIMEZONE_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value} label={t.label}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Current: {new Date().toLocaleString("en-US", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" })}</span>
                    </div>
                  </div>
                  {canEdit && <Button onClick={handleSaveTimezone} disabled={timezoneSaving}>{timezoneSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Audit Log Retention</CardTitle>
                  <CardDescription>Auto-delete old audit logs after this period</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="max-w-xs space-y-2">
                    <div className="flex items-center gap-2">
                      <Input type="number" min="30" max="3650" value={retentionDays} onChange={(e) => setRetentionDays(e.target.value)} disabled={!canEdit} className="w-24" />
                      <span className="text-sm text-muted-foreground">days</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Cleanup runs daily at 2:00 AM</p>
                  </div>
                  {canEdit && <Button onClick={handleSaveRetention} disabled={retentionSaving}>{retentionSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{statusEditId ? "Edit" : "Add"} Order Status</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2"><Label>Name</Label><Input value={statusName} onChange={(e) => setStatusName(e.target.value)} placeholder="e.g., In Progress" /></div>
              <div className="space-y-2"><Label>Color</Label><div className="flex items-center gap-2"><input type="color" value={statusColor} onChange={(e) => setStatusColor(e.target.value)} className="h-10 w-10 rounded-lg border" /><Input value={statusColor} onChange={(e) => setStatusColor(e.target.value)} className="flex-1" /></div></div>
            </div>
            <div className="space-y-2"><Label>Sort Order</Label><Input type="number" value={statusOrder} onChange={(e) => setStatusOrder(e.target.value)} className="w-24" /></div>
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
              <div className="flex items-center gap-2"><Switch checked={statusDefault} onCheckedChange={setStatusDefault} /><Label className="text-sm">Default (auto-assigned)</Label></div>
              <div className="flex items-center gap-2"><Switch checked={statusTerminal} onCheckedChange={setStatusTerminal} /><Label className="text-sm">Terminal (completed/cancelled)</Label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleStatusSave} disabled={statusSaving || !statusName.trim()}>{statusSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{statusEditId ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{deptEditId ? "Edit" : "Add"} Department</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Name</Label><Input value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="e.g., Engineering" /></div>
            <div className="space-y-2"><Label>Description (optional)</Label><Input value={deptDesc} onChange={(e) => setDeptDesc(e.target.value)} placeholder="Brief description..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeptDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleDeptSave} disabled={deptSaving || !deptName.trim()}>{deptSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{deptEditId ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!statusDeleteId} onOpenChange={() => setStatusDeleteId(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Status</AlertDialogTitle><AlertDialogDescription>Statuses in use cannot be deleted.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleStatusDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deptDeleteId} onOpenChange={() => setDeptDeleteId(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Department</AlertDialogTitle><AlertDialogDescription>Users in this department will be unassigned.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeptDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </RequirePermission>
  );
}
