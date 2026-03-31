"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/orders/status-badge";
import { ORDER_FILE_ACCEPT } from "@/components/shared/file-upload";
import { UserCombobox } from "@/components/shared/user-combobox";
import { ProfileCombobox } from "@/components/shared/profile-combobox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Calendar, Clock, DollarSign, ExternalLink, FileText, Link as LinkIcon,
  Trash2, Upload, X, Loader2, Save, Image as ImageIcon, FileSpreadsheet, FileArchive,
} from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { RequirePermission } from "@/components/shared/require-permission";
import { formatCurrency, getTimeRemaining } from "@/lib/order-utils";
import { format } from "date-fns";

/* eslint-disable @typescript-eslint/no-explicit-any */
function uw(val: any): any {
  if (val == null) return null;
  if (Array.isArray(val)) return val[0] ?? null;
  return val;
}

interface ExistingFile { id: string; file_name: string; file_url: string; file_size: number; mime_type: string; }
interface StatusOption { id: string; name: string; color: string; }
interface TeamOption { id: string; name: string; type: string; }
interface DeptOption { id: string; name: string; }
interface ServiceCat { id: string; name: string; service_lines: { id: string; name: string }[]; }
interface UserOption { id: string; name: string; email: string; company_id: string | null; avatar_url: string | null; }
interface ProfileOption { id: string; name: string; profile_url: string | null; platform_id: string; platform_name: string; }

function getFileIcon(type: string) {
  if (type?.startsWith("image/")) return ImageIcon;
  if (type?.includes("spreadsheet") || type?.includes("excel") || type?.includes("csv")) return FileSpreadsheet;
  if (type?.includes("zip") || type?.includes("rar")) return FileArchive;
  return FileText;
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const orderId = params.id as string;
  const canEdit = hasPermission("orders", "edit");

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [statusChanging, setStatusChanging] = useState(false);
  const [statusNotes, setStatusNotes] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Dropdown options
  const [platforms, setPlatforms] = useState<{ id: string; name: string; charge_percentage: number }[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [services, setServices] = useState<ServiceCat[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [platformProfiles, setPlatformProfiles] = useState<ProfileOption[]>([]);

  // Editable fields
  const [editOrderDate, setEditOrderDate] = useState("");
  const [editPlatformId, setEditPlatformId] = useState("");
  const [editGrossAmount, setEditGrossAmount] = useState("");
  const [editProfileName, setEditProfileName] = useState("");
  const [editPlatformProfileId, setEditPlatformProfileId] = useState("");
  const [editExternalOrderId, setEditExternalOrderId] = useState("");
  const [editOrderLink, setEditOrderLink] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editDeliveryTime, setEditDeliveryTime] = useState("");
  const [editEmployeeId, setEditEmployeeId] = useState("");
  const [editAssignedTo, setEditAssignedTo] = useState("");
  const [editTeamId, setEditTeamId] = useState("");
  const [editDepartmentId, setEditDepartmentId] = useState("");
  const [editServiceCategoryId, setEditServiceCategoryId] = useState("");
  const [editServiceLineId, setEditServiceLineId] = useState("");
  const [editInstructionText, setEditInstructionText] = useState("");
  const [editInstructionSheetLink, setEditInstructionSheetLink] = useState("");

  // File management
  const [existingFiles, setExistingFiles] = useState<ExistingFile[]>([]);
  const [filesToDelete, setFilesToDelete] = useState<Set<string>>(new Set());
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Populate edit fields from order data
  const populateEditFields = useCallback((o: any) => {
    const toLocalDatetime = (v: string | null) => {
      if (!v) return "";
      try { return new Date(v).toISOString().slice(0, 16); } catch { return ""; }
    };
    setEditOrderDate(o.order_date || "");
    setEditPlatformId(o.platform_id || "");
    setEditGrossAmount(String(o.gross_amount || ""));
    setEditProfileName(o.profile_name || "");
    setEditPlatformProfileId(o.platform_profile_id || "");
    setEditExternalOrderId(o.external_order_id || "");
    setEditOrderLink(o.order_link || "");
    setEditDeadline(toLocalDatetime(o.deadline));
    setEditDeliveryTime(toLocalDatetime(o.delivery_time));
    setEditEmployeeId(o.employee_id || "");
    setEditAssignedTo(o.assigned_to || "");
    setEditTeamId(o.team_id || "");
    setEditDepartmentId(o.department_id || "");
    setEditServiceCategoryId(o.service_category_id || "");
    setEditServiceLineId(o.service_line_id || "");
    setEditInstructionText(o.instruction_text || "");
    setEditInstructionSheetLink(o.instruction_sheet_link || "");
    setExistingFiles(o.order_files || []);
    setFilesToDelete(new Set());
    setNewFiles([]);
  }, []);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (res.ok) {
        const json = await res.json();
        setOrder(json.data);
        populateEditFields(json.data);
      } else setOrder(null);
    } catch { toast.error("Failed to load order"); }
    finally { setLoading(false); }
  }, [orderId, populateEditFields]);

  useEffect(() => {
    fetchOrder();
    Promise.all([
      fetch("/api/order-statuses").then((r) => r.json()),
      fetch("/api/platforms").then((r) => r.json()),
      fetch("/api/teams").then((r) => r.json()),
      fetch("/api/departments").then((r) => r.json()),
      fetch("/api/services").then((r) => r.json()),
      fetch("/api/users?pageSize=200").then((r) => r.json()),
      fetch("/api/platform-profiles?active_only=true").then((r) => r.json()),
    ]).then(([stRes, pRes, tRes, dRes, sRes, uRes, ppRes]) => {
      setStatuses(stRes.data || []);
      setPlatforms(pRes.data || []);
      setTeams((tRes.data || []).map((t: any) => ({ id: t.id, name: t.name, type: t.type })));
      setDepartments(dRes.data || []);
      setServices(sRes.data || []);
      setUsers((uRes.data || []).map((u: any) => ({
        id: u.id, name: u.name, email: u.email,
        company_id: u.company_id || null, avatar_url: u.avatar_url || null,
      })));
      setPlatformProfiles((ppRes.data || []).map((pp: any) => {
        const plat = Array.isArray(pp.platforms) ? pp.platforms[0] : pp.platforms;
        return { id: pp.id, name: pp.name, profile_url: pp.profile_url, platform_id: pp.platform_id, platform_name: plat?.name || "" };
      }));
    }).catch(() => {});
  }, [fetchOrder]);

  // Service lines for selected category
  const selectedCategory = services.find((s) => s.id === editServiceCategoryId);
  const serviceLines = selectedCategory?.service_lines || [];

  async function handleStatusChange(sid: string) {
    setStatusChanging(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status_id: sid, notes: statusNotes || undefined }),
      });
      if (res.ok) { toast.success("Status updated"); setStatusNotes(""); fetchOrder(); }
      else { const j = await res.json(); toast.error(j.error || "Failed"); }
    } catch { toast.error("Error"); }
    finally { setStatusChanging(false); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      // 1. Update order fields
      const payload: Record<string, any> = {
        order_date: editOrderDate || undefined,
        platform_id: editPlatformId || undefined,
        gross_amount: parseFloat(editGrossAmount) || undefined,
        platform_profile_id: editPlatformProfileId || null,
        profile_name: editProfileName || null,
        external_order_id: editExternalOrderId || null,
        order_link: editOrderLink || null,
        deadline: editDeadline || null,
        delivery_time: editDeliveryTime || null,
        employee_id: editEmployeeId || null,
        assigned_to: editAssignedTo || null,
        team_id: editTeamId || null,
        department_id: editDepartmentId || null,
        service_category_id: editServiceCategoryId || null,
        service_line_id: editServiceLineId || null,
        instruction_text: editInstructionText || null,
        instruction_sheet_link: editInstructionSheetLink || null,
      };

      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const j = await res.json();
        toast.error(j.error || "Failed to update order");
        setSaving(false);
        return;
      }

      // 2. Delete marked files
      if (filesToDelete.size > 0) {
        for (const fid of filesToDelete) {
          await fetch(`/api/orders/${orderId}/files?file_id=${fid}`, { method: "DELETE" }).catch(() => {});
        }
      }

      // 3. Upload new files
      if (newFiles.length > 0) {
        let uploaded = 0;
        for (const file of newFiles) {
          const fd = new FormData();
          fd.append("file", file);
          try {
            const upRes = await fetch(`/api/orders/${orderId}/files`, { method: "POST", body: fd });
            if (upRes.ok) uploaded++;
          } catch {}
        }
        if (uploaded < newFiles.length) {
          toast.warning(`${newFiles.length - uploaded} file(s) failed to upload`);
        }
      }

      toast.success("Order updated");
      fetchOrder();
    } catch {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
    if (res.ok) { toast.success("Order deleted"); router.push("/orders"); }
    else toast.error("Failed");
    setDeleteConfirm(false);
  }

  function toggleFileDelete(fid: string) {
    setFilesToDelete((prev) => {
      const next = new Set(prev);
      if (next.has(fid)) next.delete(fid); else next.add(fid);
      return next;
    });
  }

  function addNewFiles(fileList: FileList) {
    const valid = Array.from(fileList).filter((f) => f.size <= 50 * 1024 * 1024);
    setNewFiles((prev) => [...prev, ...valid]);
  }

  if (loading) return <RequirePermission module="orders"><div className="space-y-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-96" /></div></RequirePermission>;
  if (!order) return <RequirePermission module="orders"><p className="text-center py-12 text-muted-foreground">Order not found.</p></RequirePermission>;

  const platform = uw(order.platforms);
  const status = uw(order.order_statuses);
  const history: any[] = (order.order_status_history || []).sort(
    (a: any, b: any) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
  );

  // Visible existing files (not marked for deletion)
  const visibleFiles = existingFiles.filter((f) => !filesToDelete.has(f.id));
  const markedFiles = existingFiles.filter((f) => filesToDelete.has(f.id));
  const hasChanges = true; // Always allow save

  return (
    <RequirePermission module="orders">
    <div className="space-y-6">
      <PageHeader title={order.order_number} description={`Order for ${order.client_name}`}>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          )}
          {hasPermission("orders", "delete") && (
            <Button variant="destructive" size="sm" onClick={() => setDeleteConfirm(true)}>
              <Trash2 className="mr-2 h-4 w-4" />Delete
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Status + Financial Summary */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Status</div><div className="mt-1">{status ? <StatusBadge name={status.name} color={status.color} /> : "-"}</div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Gross</div><div className="text-xl font-bold">{formatCurrency(parseFloat(editGrossAmount) || 0)}</div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Platform Fee</div><div className="text-xl font-bold text-destructive">-{formatCurrency((() => { const p = platforms.find((x) => x.id === editPlatformId); return ((parseFloat(editGrossAmount) || 0) * (p?.charge_percentage || 0)) / 100; })())}</div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Net Amount</div><div className="text-xl font-bold text-success">{formatCurrency((() => { const g = parseFloat(editGrossAmount) || 0; const p = platforms.find((x) => x.id === editPlatformId); return g - (g * (p?.charge_percentage || 0)) / 100; })())}</div></CardContent></Card>
          </div>

          {/* Order Details (editable) */}
          <Card>
            <CardHeader><CardTitle>Order Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={editOrderDate} onChange={(e) => setEditOrderDate(e.target.value)} disabled={!canEdit} />
                </div>
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <Select value={editPlatformId} onValueChange={(v) => setEditPlatformId(v || "")} disabled={!canEdit} items={Object.fromEntries(platforms.map(p => [p.id, `${p.name} (${p.charge_percentage}%)`]))}>
                    <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
                    <SelectContent>
                      {platforms.map((p) => <SelectItem key={p.id} value={p.id} label={`${p.name} (${p.charge_percentage}%)`}>{p.name} ({p.charge_percentage}%)</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Order Amount (USD)</Label>
                  <Input type="number" min="0" step="0.01" value={editGrossAmount} onChange={(e) => setEditGrossAmount(e.target.value)} disabled={!canEdit} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Profile</Label>
                  <ProfileCombobox
                    value={editPlatformProfileId}
                    onChange={(id) => setEditPlatformProfileId(id)}
                    profiles={platformProfiles}
                    platformId={editPlatformId}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Order ID (Platform)</Label>
                  <Input value={editExternalOrderId} onChange={(e) => setEditExternalOrderId(e.target.value)} placeholder="Platform order ID" disabled={!canEdit} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Order Link</Label>
                <Input value={editOrderLink} onChange={(e) => setEditOrderLink(e.target.value)} placeholder="https://..." disabled={!canEdit} />
              </div>
            </CardContent>
          </Card>

          {/* Timeline (editable) */}
          <Card>
            <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Deadline</Label>
                  <Input type="datetime-local" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} disabled={!canEdit} />
                  {editDeadline && (
                    <p className={`text-xs ${getTimeRemaining(editDeadline).isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                      {getTimeRemaining(editDeadline).text}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Delivery Time</Label>
                  <Input type="datetime-local" value={editDeliveryTime} onChange={(e) => setEditDeliveryTime(e.target.value)} disabled={!canEdit} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* People & Assignment (editable) */}
          <Card>
            <CardHeader><CardTitle>People &amp; Assignment</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Employee (Who Got the Order)</Label>
                  <UserCombobox value={editEmployeeId} onChange={(id) => setEditEmployeeId(id)} users={users} disabled={!canEdit} />
                </div>
                <div className="space-y-2">
                  <Label>Assigned Member</Label>
                  <UserCombobox value={editAssignedTo} onChange={(id) => setEditAssignedTo(id)} users={users} disabled={!canEdit} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Assigned Team</Label>
                  <Select value={editTeamId || "none"} onValueChange={(v) => setEditTeamId(v === "none" ? "" : (v || ""))} disabled={!canEdit} items={{ none: "None", ...Object.fromEntries(teams.map(t => [t.id, `${t.name} (${t.type})`])) }}>
                    <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {teams.map((t) => <SelectItem key={t.id} value={t.id} label={t.name}>{t.name} ({t.type})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={editDepartmentId || "none"} onValueChange={(v) => setEditDepartmentId(v === "none" ? "" : (v || ""))} disabled={!canEdit} items={{ none: "None", ...Object.fromEntries(departments.map(d => [d.id, d.name])) }}>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {departments.map((d) => <SelectItem key={d.id} value={d.id} label={d.name}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Service Category</Label>
                  <Select value={editServiceCategoryId || "none"} onValueChange={(v) => { setEditServiceCategoryId(v === "none" ? "" : (v || "")); setEditServiceLineId(""); }} disabled={!canEdit} items={{ none: "None", ...Object.fromEntries(services.map(s => [s.id, s.name])) }}>
                    <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {services.map((s) => <SelectItem key={s.id} value={s.id} label={s.name}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Service Line</Label>
                  <Select value={editServiceLineId || "none"} onValueChange={(v) => setEditServiceLineId(v === "none" ? "" : (v || ""))} disabled={!canEdit || !editServiceCategoryId} items={{ none: "None", ...Object.fromEntries(serviceLines.map(l => [l.id, l.name])) }}>
                    <SelectTrigger><SelectValue placeholder="Select line" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {serviceLines.map((l) => <SelectItem key={l.id} value={l.id} label={l.name}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Instructions (editable) */}
          <Card>
            <CardHeader><CardTitle>Instructions</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Instruction Sheet Link</Label>
                <Input value={editInstructionSheetLink} onChange={(e) => setEditInstructionSheetLink(e.target.value)} placeholder="https://docs.google.com/..." disabled={!canEdit} />
              </div>
              <div className="space-y-2">
                <Label>Instruction Notes</Label>
                <Textarea value={editInstructionText} onChange={(e) => setEditInstructionText(e.target.value)} placeholder="Enter instructions..." rows={4} disabled={!canEdit} />
              </div>
            </CardContent>
          </Card>

          {/* Files (editable) */}
          <Card>
            <CardHeader>
              <CardTitle>Files ({visibleFiles.length + newFiles.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing files */}
              {visibleFiles.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted-foreground">Existing Files</span>
                  {visibleFiles.map((f) => {
                    const isImage = f.mime_type?.startsWith("image/");
                    const sz = f.file_size < 1048576 ? `${(f.file_size / 1024).toFixed(1)} KB` : `${(f.file_size / 1048576).toFixed(1)} MB`;
                    return (
                      <div key={f.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3 min-w-0">
                          {isImage ? <img src={f.file_url} alt="" className="h-10 w-10 rounded object-cover border" /> : <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0"><FileText className="h-4 w-4 text-muted-foreground" /></div>}
                          <div className="min-w-0">
                            <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline truncate block">{f.file_name}</a>
                            <span className="text-xs text-muted-foreground">{sz}</span>
                          </div>
                        </div>
                        {canEdit && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => toggleFileDelete(f.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Files marked for removal */}
              {markedFiles.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-medium text-destructive">Marked for Removal (will be deleted on save)</span>
                  {markedFiles.map((f) => (
                    <div key={f.id} className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 bg-destructive/5 opacity-60">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0"><FileText className="h-4 w-4 text-muted-foreground" /></div>
                        <span className="text-sm line-through truncate">{f.file_name}</span>
                      </div>
                      <Button variant="ghost" size="sm" className="text-xs shrink-0" onClick={() => toggleFileDelete(f.id)}>
                        Undo
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* New files to upload */}
              {newFiles.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-medium text-success">New Files (will be uploaded on save)</span>
                  {newFiles.map((file, idx) => {
                    const Icon = getFileIcon(file.type);
                    const sz = file.size < 1048576 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / 1048576).toFixed(1)} MB`;
                    return (
                      <div key={`new-${idx}`} className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 p-2.5">
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="text-sm truncate flex-1">{file.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{sz}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" type="button"
                          onClick={() => setNewFiles((prev) => prev.filter((_, i) => i !== idx))}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Drop zone for new files */}
              {canEdit && (
                <div
                  className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer ${
                    isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length) addNewFiles(e.dataTransfer.files); }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input ref={fileInputRef} type="file" multiple accept={ORDER_FILE_ACCEPT} className="hidden"
                    onChange={(e) => { if (e.target.files) addNewFiles(e.target.files); e.target.value = ""; }} />
                  <Upload className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm font-medium">Drop files here or <span className="text-primary">browse</span></p>
                  <p className="text-xs text-muted-foreground mt-1">Images, PDF, Excel, CSV, ZIP, DOCX up to 50MB each</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bottom save button */}
          {canEdit && (
            <div className="flex items-center gap-4 pb-8">
              <Button onClick={handleSave} disabled={saving} size="lg">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
              <Button variant="outline" onClick={() => populateEditFields(order)} disabled={saving}>
                Reset
              </Button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {canEdit && (
            <Card>
              <CardHeader><CardTitle>Change Status</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Select onValueChange={(v: string | null) => { if (v) handleStatusChange(v); }} disabled={statusChanging} items={Object.fromEntries(statuses.filter(st => st.id !== status?.id).map(st => [st.id, st.name]))}>
                  <SelectTrigger><SelectValue placeholder="Select new status" /></SelectTrigger>
                  <SelectContent>
                    {statuses.filter((st) => st.id !== status?.id).map((st) => (
                      <SelectItem key={st.id} value={st.id} label={st.name}>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: st.color }} />
                          {st.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea value={statusNotes} onChange={(e) => setStatusNotes(e.target.value)} placeholder="Notes (optional)" rows={2} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Created By</CardTitle></CardHeader>
            <CardContent>
              {(() => {
                const createdByUser = uw(order.created_by_user);
                return (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <Avatar className="h-6 w-6"><AvatarFallback className="text-[8px]">{createdByUser?.name?.[0]}</AvatarFallback></Avatar>
                      <span>{createdByUser?.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{format(new Date(order.created_at), "PPp")}</p>
                  </>
                );
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Status History</CardTitle></CardHeader>
            <CardContent>
              {history.length === 0 ? <p className="text-sm text-muted-foreground">No history.</p> : (
                <div className="space-y-4">
                  {history.map((h: any) => {
                    const from = uw(h.from_status);
                    const to = uw(h.to_status);
                    const by = uw(h.changed_by_user);
                    return (
                      <div key={h.id} className="relative pl-4 border-l-2 border-muted pb-4 last:pb-0">
                        <div className="absolute -left-1.5 top-0 h-3 w-3 rounded-full border-2 border-background" style={{ backgroundColor: to?.color || "#6b7280" }} />
                        <div className="text-sm">{from ? <span>{from.name} → <strong>{to?.name}</strong></span> : <span>Created as <strong>{to?.name}</strong></span>}</div>
                        {h.notes && <p className="text-xs text-muted-foreground mt-0.5">{h.notes}</p>}
                        <p className="text-[10px] text-muted-foreground mt-0.5">{by?.name} · {format(new Date(h.changed_at), "MMM d, h:mm a")}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete order {order.order_number} and all associated files.</AlertDialogDescription>
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
