"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/orders/status-badge";
import { ORDER_FILE_ACCEPT } from "@/components/shared/file-upload";
import { ProfileCombobox } from "@/components/shared/profile-combobox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Calendar, Clock, DollarSign, ExternalLink, FileText, Link as LinkIcon, Trash2, Upload, X, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { RequirePermission } from "@/components/shared/require-permission";
import { formatCurrency, getTimeRemaining } from "@/lib/order-utils";
import { format } from "date-fns";

/* eslint-disable @typescript-eslint/no-explicit-any */
function uw(val: any): any { if (val == null) return null; if (Array.isArray(val)) return val[0] ?? null; return val; }

interface ExFile { id: string; file_name: string; file_url: string; file_size: number; mime_type: string; }
interface StatusOption { id: string; name: string; color: string; }
interface ProfileOption { id: string; name: string; profile_url: string | null; platform_id: string; platform_name: string; }

export default function SpecialOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const orderId = params.id as string;
  const canEdit = hasPermission("special-orders", "edit");

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [platforms, setPlatforms] = useState<{ id: string; name: string; charge_percentage: number }[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [statusChanging, setStatusChanging] = useState(false);
  const [statusNotes, setStatusNotes] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Editable
  const [editOrderDate, setEditOrderDate] = useState("");
  const [editPlatformId, setEditPlatformId] = useState("");
  const [editProfileId, setEditProfileId] = useState("");
  const [editClientName, setEditClientName] = useState("");
  const [editExternalOrderId, setEditExternalOrderId] = useState("");
  const [editOrderLink, setEditOrderLink] = useState("");
  const [editGrossAmount, setEditGrossAmount] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editDeliveryTime, setEditDeliveryTime] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Files
  const [existingFiles, setExistingFiles] = useState<ExFile[]>([]);
  const [filesToDelete, setFilesToDelete] = useState<Set<string>>(new Set());
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const populate = useCallback((o: any) => {
    const toLocal = (v: string | null) => { if (!v) return ""; try { return new Date(v).toISOString().slice(0, 16); } catch { return ""; } };
    setEditOrderDate(o.order_date || "");
    setEditPlatformId(o.platform_id || "");
    setEditProfileId(o.platform_profile_id || "");
    setEditClientName(o.client_name || "");
    setEditExternalOrderId(o.external_order_id || "");
    setEditOrderLink(o.order_link || "");
    setEditGrossAmount(String(o.gross_amount || ""));
    setEditDeadline(toLocal(o.deadline));
    setEditDeliveryTime(toLocal(o.delivery_time));
    setEditNotes(o.notes || "");
    setExistingFiles(o.special_order_files || []);
    setFilesToDelete(new Set()); setNewFiles([]);
  }, []);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/special-orders/${orderId}`);
      if (res.ok) { const j = await res.json(); setOrder(j.data); populate(j.data); }
      else setOrder(null);
    } catch { toast.error("Failed"); }
    finally { setLoading(false); }
  }, [orderId, populate]);

  useEffect(() => {
    fetchOrder();
    Promise.all([
      fetch("/api/order-statuses").then((r) => r.json()),
      fetch("/api/platforms").then((r) => r.json()),
      fetch("/api/platform-profiles?active_only=true").then((r) => r.json()),
    ]).then(([stRes, pRes, ppRes]) => {
      setStatuses(stRes.data || []);
      setPlatforms(pRes.data || []);
      setProfiles((ppRes.data || []).map((pp: any) => {
        const plat = Array.isArray(pp.platforms) ? pp.platforms[0] : pp.platforms;
        return { id: pp.id, name: pp.name, profile_url: pp.profile_url, platform_id: pp.platform_id, platform_name: plat?.name || "" };
      }));
    }).catch(() => {});
  }, [fetchOrder]);

  const gross = parseFloat(editGrossAmount) || 0;
  const selPlat = platforms.find((p) => p.id === editPlatformId);
  const charge = (gross * (selPlat?.charge_percentage || 0)) / 100;
  const net = gross - charge;

  async function handleStatusChange(sid: string) {
    setStatusChanging(true);
    try {
      const res = await fetch(`/api/special-orders/${orderId}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status_id: sid, notes: statusNotes || undefined }) });
      if (res.ok) { toast.success("Status updated"); setStatusNotes(""); fetchOrder(); }
      else { const j = await res.json(); toast.error(j.error || "Failed"); }
    } catch { toast.error("Error"); }
    finally { setStatusChanging(false); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/special-orders/${orderId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_date: editOrderDate || undefined, platform_id: editPlatformId || undefined,
          platform_profile_id: editProfileId || null, client_name: editClientName || undefined,
          external_order_id: editExternalOrderId || null, order_link: editOrderLink || null,
          gross_amount: gross || undefined, deadline: editDeadline || null,
          delivery_time: editDeliveryTime || null, notes: editNotes || null,
        }),
      });
      if (!res.ok) { const j = await res.json(); toast.error(j.error || "Failed"); setSaving(false); return; }

      for (const fid of filesToDelete) { await fetch(`/api/special-orders/${orderId}/files?file_id=${fid}`, { method: "DELETE" }).catch(() => {}); }
      if (newFiles.length > 0) {
        for (const file of newFiles) {
          const fd = new FormData(); fd.append("file", file);
          await fetch(`/api/special-orders/${orderId}/files`, { method: "POST", body: fd }).catch(() => {});
        }
      }
      toast.success("Updated"); fetchOrder();
    } catch { toast.error("Error"); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    const res = await fetch(`/api/special-orders/${orderId}`, { method: "DELETE" });
    if (res.ok) { toast.success("Deleted"); router.push("/special-orders"); }
    else toast.error("Failed");
    setDeleteConfirm(false);
  }

  if (loading) return <RequirePermission module="special-orders"><div className="space-y-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-96" /></div></RequirePermission>;
  if (!order) return <RequirePermission module="special-orders"><p className="text-center py-12 text-muted-foreground">Not found.</p></RequirePermission>;

  const status = uw(order.order_statuses);
  const createdByUser = uw(order.created_by_user);
  const visibleFiles = existingFiles.filter((f) => !filesToDelete.has(f.id));
  const markedFiles = existingFiles.filter((f) => filesToDelete.has(f.id));
  const history: any[] = (order.special_order_status_history || []).sort((a: any, b: any) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());

  return (
    <RequirePermission module="special-orders">
    <div className="space-y-6">
      <PageHeader title={order.order_number} description="Special Order (not counted in revenue)">
        <div className="flex items-center gap-2">
          {canEdit && <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save Changes</Button>}
          {hasPermission("special-orders", "delete") && <Button variant="destructive" size="sm" onClick={() => setDeleteConfirm(true)}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>}
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Financial summary */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Status</div><div className="mt-1">{status ? <StatusBadge name={status.name} color={status.color} /> : "-"}</div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Spent (Gross)</div><div className="text-xl font-bold text-destructive">{formatCurrency(gross)}</div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Platform Fee</div><div className="text-xl font-bold text-muted-foreground">-{formatCurrency(charge)}</div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Net Cost</div><div className="text-xl font-bold text-destructive">{formatCurrency(net)}</div></CardContent></Card>
          </div>

          {/* Order Details */}
          <Card>
            <CardHeader><CardTitle>Order Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2"><Label>Date</Label><Input type="date" value={editOrderDate} onChange={(e) => setEditOrderDate(e.target.value)} disabled={!canEdit} /></div>
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <Select value={editPlatformId} onValueChange={(v) => setEditPlatformId(v || "")} disabled={!canEdit} items={Object.fromEntries(platforms.map(p => [p.id, `${p.name} (${p.charge_percentage}%)`]))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{platforms.map((p) => <SelectItem key={p.id} value={p.id} label={`${p.name} (${p.charge_percentage}%)`}>{p.name} ({p.charge_percentage}%)</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Profile</Label><ProfileCombobox value={editProfileId} onChange={(id) => setEditProfileId(id)} profiles={profiles} platformId={editPlatformId} disabled={!canEdit} /></div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2"><Label>Client Name</Label><Input value={editClientName} onChange={(e) => setEditClientName(e.target.value)} disabled={!canEdit} /></div>
                <div className="space-y-2"><Label>Order Amount (USD)</Label><Input type="number" min="0" step="0.01" value={editGrossAmount} onChange={(e) => setEditGrossAmount(e.target.value)} disabled={!canEdit} /></div>
                <div className="space-y-2"><Label>Order ID (Platform)</Label><Input value={editExternalOrderId} onChange={(e) => setEditExternalOrderId(e.target.value)} disabled={!canEdit} /></div>
              </div>
              <div className="space-y-2"><Label>Order Link</Label><Input value={editOrderLink} onChange={(e) => setEditOrderLink(e.target.value)} disabled={!canEdit} /></div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Deadline</Label><Input type="datetime-local" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} disabled={!canEdit} />
                  {editDeadline && <p className={`text-xs ${getTimeRemaining(editDeadline).isOverdue ? "text-destructive" : "text-muted-foreground"}`}>{getTimeRemaining(editDeadline).text}</p>}
                </div>
                <div className="space-y-2"><Label>Delivery Time</Label><Input type="datetime-local" value={editDeliveryTime} onChange={(e) => setEditDeliveryTime(e.target.value)} disabled={!canEdit} /></div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader><CardTitle>Notes / Purpose</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Purpose of this special order..." rows={4} disabled={!canEdit} />
            </CardContent>
          </Card>

          {/* Files */}
          <Card>
            <CardHeader><CardTitle>Files ({visibleFiles.length + newFiles.length})</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {visibleFiles.map((f) => (
                <div key={f.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3 min-w-0">
                    {f.mime_type?.startsWith("image/") ? <img src={f.file_url} alt="" className="h-10 w-10 rounded object-cover border" /> : <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0"><FileText className="h-4 w-4 text-muted-foreground" /></div>}
                    <div className="min-w-0">
                      <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline truncate block">{f.file_name}</a>
                      <span className="text-xs text-muted-foreground">{f.file_size < 1048576 ? `${(f.file_size / 1024).toFixed(1)} KB` : `${(f.file_size / 1048576).toFixed(1)} MB`}</span>
                    </div>
                  </div>
                  {canEdit && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => setFilesToDelete(p => { const n = new Set(p); n.add(f.id); return n; })}><Trash2 className="h-3 w-3" /></Button>}
                </div>
              ))}
              {markedFiles.map((f) => (
                <div key={f.id} className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 bg-destructive/5 opacity-60">
                  <span className="text-sm line-through truncate">{f.file_name}</span>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => setFilesToDelete(p => { const n = new Set(p); n.delete(f.id); return n; })}>Undo</Button>
                </div>
              ))}
              {newFiles.map((file, idx) => (
                <div key={`new-${idx}`} className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 p-2.5">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm truncate flex-1">{file.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{file.size < 1048576 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / 1048576).toFixed(1)} MB`}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" type="button" onClick={() => setNewFiles(p => p.filter((_, i) => i !== idx))}><X className="h-3 w-3" /></Button>
                </div>
              ))}
              {canEdit && (
                <div className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length) setNewFiles(p => [...p, ...Array.from(e.dataTransfer.files).filter(f => f.size <= 50 * 1024 * 1024)]); }}
                  onClick={() => fileInputRef.current?.click()}>
                  <input ref={fileInputRef} type="file" multiple accept={ORDER_FILE_ACCEPT} className="hidden" onChange={(e) => { if (e.target.files) setNewFiles(p => [...p, ...Array.from(e.target.files!).filter(f => f.size <= 50 * 1024 * 1024)]); e.target.value = ""; }} />
                  <Upload className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm font-medium">Drop files or <span className="text-primary">browse</span></p>
                </div>
              )}
            </CardContent>
          </Card>

          {canEdit && (
            <div className="flex items-center gap-4 pb-8">
              <Button onClick={handleSave} disabled={saving} size="lg">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save Changes</Button>
              <Button variant="outline" onClick={() => populate(order)} disabled={saving}>Reset</Button>
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
                  <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>{statuses.filter((st) => st.id !== status?.id).map((st) => (
                    <SelectItem key={st.id} value={st.id} label={st.name}><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: st.color }} />{st.name}</div></SelectItem>
                  ))}</SelectContent>
                </Select>
                <Textarea value={statusNotes} onChange={(e) => setStatusNotes(e.target.value)} placeholder="Notes (optional)" rows={2} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Created By</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm">
                <Avatar className="h-6 w-6"><AvatarFallback className="text-[8px]">{createdByUser?.name?.[0]}</AvatarFallback></Avatar>
                <span>{createdByUser?.name}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{format(new Date(order.created_at), "PPp")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Status History</CardTitle></CardHeader>
            <CardContent>
              {history.length === 0 ? <p className="text-sm text-muted-foreground">No history.</p> : (
                <div className="space-y-4">{history.map((h: any) => {
                  const from = uw(h.from_status); const to = uw(h.to_status); const by = uw(h.changed_by_user);
                  return (
                    <div key={h.id} className="relative pl-4 border-l-2 border-muted pb-4 last:pb-0">
                      <div className="absolute -left-1.5 top-0 h-3 w-3 rounded-full border-2 border-background" style={{ backgroundColor: to?.color || "#6b7280" }} />
                      <div className="text-sm">{from ? <span>{from.name} → <strong>{to?.name}</strong></span> : <span>Created as <strong>{to?.name}</strong></span>}</div>
                      {h.notes && <p className="text-xs text-muted-foreground mt-0.5">{h.notes}</p>}
                      <p className="text-[10px] text-muted-foreground mt-0.5">{by?.name} · {format(new Date(h.changed_at), "MMM d, h:mm a")}</p>
                    </div>);
                })}</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Special Order</AlertDialogTitle><AlertDialogDescription>This will permanently delete {order.order_number}.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </RequirePermission>
  );
}
