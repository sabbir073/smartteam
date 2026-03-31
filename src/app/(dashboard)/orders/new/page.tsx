"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { UserCombobox } from "@/components/shared/user-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, X, FileText, Image as ImageIcon, FileSpreadsheet, FileArchive } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/order-utils";
import { ORDER_FILE_ACCEPT } from "@/components/shared/file-upload";
import { ProfileCombobox } from "@/components/shared/profile-combobox";
import { RequirePermission } from "@/components/shared/require-permission";

interface Platform { id: string; name: string; charge_percentage: number; }
interface ProfileOption { id: string; name: string; profile_url: string | null; platform_id: string; platform_name: string; }
interface ServiceCat { id: string; name: string; service_lines: { id: string; name: string }[]; }
interface TeamOption { id: string; name: string; type: string; }
interface DeptOption { id: string; name: string; }
interface StatusOption { id: string; name: string; color: string; }
interface UserOption { id: string; name: string; email: string; company_id: string | null; avatar_url: string | null; }

export default function NewOrderPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Options
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [services, setServices] = useState<ServiceCat[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [platformProfiles, setPlatformProfiles] = useState<ProfileOption[]>([]);

  // Form fields
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [employeeId, setEmployeeId] = useState("");
  const [platformId, setPlatformId] = useState("");
  const [platformProfileId, setPlatformProfileId] = useState("");
  const [clientName, setClientName] = useState("");
  const [externalOrderId, setExternalOrderId] = useState("");
  const [orderLink, setOrderLink] = useState("");
  const [grossAmount, setGrossAmount] = useState("");
  const [instructionText, setInstructionText] = useState("");
  const [instructionSheetLink, setInstructionSheetLink] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [teamId, setTeamId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [serviceCategoryId, setServiceCategoryId] = useState("");
  const [serviceLineId, setServiceLineId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/platforms").then((r) => r.json()),
      fetch("/api/services").then((r) => r.json()),
      fetch("/api/teams").then((r) => r.json()),
      fetch("/api/departments").then((r) => r.json()),
      fetch("/api/order-statuses").then((r) => r.json()),
      fetch("/api/users?pageSize=200").then((r) => r.json()),
      fetch("/api/platform-profiles?active_only=true").then((r) => r.json()),
    ]).then(([pRes, sRes, tRes, dRes, stRes, uRes, ppRes]) => {
      setPlatforms(pRes.data || []);
      setServices(sRes.data || []);
      setTeams((tRes.data || []).map((t: TeamOption) => ({ id: t.id, name: t.name, type: t.type })));
      setDepartments(dRes.data || []);
      setStatuses(stRes.data || []);
      setUsers((uRes.data || []).map((u: Record<string, unknown>) => ({
        id: u.id as string,
        name: u.name as string,
        email: u.email as string,
        company_id: (u.company_id as string) || null,
        avatar_url: (u.avatar_url as string) || null,
      })));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setPlatformProfiles((ppRes.data || []).map((pp: any) => {
        const plat = Array.isArray(pp.platforms) ? pp.platforms[0] : pp.platforms;
        return { id: pp.id, name: pp.name, profile_url: pp.profile_url, platform_id: pp.platform_id, platform_name: plat?.name || "" };
      }));
    }).catch(() => {});
  }, []);

  // Auto-calc
  const selectedPlatform = platforms.find((p) => p.id === platformId);
  const gross = parseFloat(grossAmount) || 0;
  const chargePercent = selectedPlatform?.charge_percentage || 0;
  const platformCharge = (gross * chargePercent) / 100;
  const netAmount = gross - platformCharge;

  // Service lines
  const selectedCategory = services.find((s) => s.id === serviceCategoryId);
  const serviceLines = selectedCategory?.service_lines || [];

  // Auto-fill employee name when selected
  const selectedEmployee = users.find((u) => u.id === employeeId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!platformId || !clientName || !grossAmount) {
      toast.error("Please fill required fields: Platform, Client Name, Order Amount");
      return;
    }
    setSaving(true);

    try {
      const payload = {
        order_date: orderDate,
        employee_id: employeeId || null,
        platform_id: platformId,
        platform_profile_id: platformProfileId || null,
        client_name: clientName,
        external_order_id: externalOrderId || null,
        order_link: orderLink || null,
        gross_amount: gross,
        instruction_text: instructionText || null,
        instruction_sheet_link: instructionSheetLink || null,
        assigned_to: assignedTo || null,
        team_id: teamId || null,
        department_id: departmentId || null,
        service_category_id: serviceCategoryId || null,
        service_line_id: serviceLineId || null,
        deadline: deadline || null,
        delivery_time: deliveryTime || null,
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        const orderId = json.data.id;

        // Upload queued files
        if (pendingFiles.length > 0) {
          toast.info(`Uploading ${pendingFiles.length} file(s)...`);
          let uploaded = 0;
          for (const file of pendingFiles) {
            const fd = new FormData();
            fd.append("file", file);
            try {
              const uploadRes = await fetch(`/api/orders/${orderId}/files`, { method: "POST", body: fd });
              if (uploadRes.ok) uploaded++;
            } catch {}
          }
          if (uploaded > 0) toast.success(`${uploaded} file(s) uploaded`);
          if (uploaded < pendingFiles.length) toast.warning(`${pendingFiles.length - uploaded} file(s) failed`);
        }

        toast.success("Order created");
        router.push(`/orders/${orderId}`);
      } else {
        const json = await res.json();
        toast.error(json.error || "Failed to create order");
      }
    } catch { toast.error("An error occurred"); }
    finally { setSaving(false); }
  }

  function addFiles(fileList: FileList) {
    const valid = Array.from(fileList).filter((f) => f.size <= 50 * 1024 * 1024);
    setPendingFiles((prev) => [...prev, ...valid]);
  }

  function getFileIcon(type: string) {
    if (type.startsWith("image/")) return ImageIcon;
    if (type.includes("spreadsheet") || type.includes("excel") || type.includes("csv")) return FileSpreadsheet;
    if (type.includes("zip") || type.includes("rar")) return FileArchive;
    return FileText;
  }

  return (
    <RequirePermission module="orders" action="create">
    <div className="space-y-6">
      <PageHeader title="New Order" description="Create a new client order" />

      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">

        {/* Row 1: Date & Employee */}
        <Card>
          <CardHeader><CardTitle>Order Source</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Employee (Who Got the Order)</Label>
                <UserCombobox
                  value={employeeId}
                  onChange={(id) => setEmployeeId(id)}
                  users={users}
                  placeholder="Search by name or company ID..."
                />
              </div>
            </div>
            {selectedEmployee && (
              <div className="grid gap-4 md:grid-cols-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Employee ID: </span>
                  <span className="font-medium">{selectedEmployee.company_id || "N/A"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Employee Name: </span>
                  <span className="font-medium">{selectedEmployee.name}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Row 2: Platform & Client */}
        <Card>
          <CardHeader><CardTitle>Platform & Client Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Platform *</Label>
                <Select value={platformId} onValueChange={(v) => setPlatformId(v || "")} items={Object.fromEntries(platforms.map(p => [p.id, `${p.name} (${p.charge_percentage}% charge)`]))}>
                  <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
                  <SelectContent>
                    {platforms.map((p) => (
                      <SelectItem key={p.id} value={p.id} label={`${p.name} (${p.charge_percentage}%)`}>
                        {p.name} ({p.charge_percentage}% charge)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Profile</Label>
                <ProfileCombobox
                  value={platformProfileId}
                  onChange={(id) => setPlatformProfileId(id)}
                  profiles={platformProfiles}
                  platformId={platformId}
                  placeholder="Search profile..."
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Client Name *</Label>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name" required />
              </div>
              <div className="space-y-2">
                <Label>Order ID (Platform)</Label>
                <Input value={externalOrderId} onChange={(e) => setExternalOrderId(e.target.value)} placeholder="Platform order ID" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Order Link</Label>
                <Input value={orderLink} onChange={(e) => setOrderLink(e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label>Order Amount (USD) *</Label>
                <Input type="number" min="0" step="0.01" value={grossAmount} onChange={(e) => setGrossAmount(e.target.value)} placeholder="0.00" required />
              </div>
            </div>

            {/* Auto-calculated amounts */}
            {gross > 0 && selectedPlatform && (
              <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Order Amount (Gross)</span>
                  <span className="font-medium">{formatCurrency(gross)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Platform Charge ({chargePercent}%)</span>
                  <span>- {formatCurrency(platformCharge)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between text-sm font-bold">
                  <span>Net Amount</span>
                  <span className="text-success">{formatCurrency(netAmount)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Row 3: Assignment & Organization */}
        <Card>
          <CardHeader><CardTitle>Assignment</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Assigned Team</Label>
                <Select value={teamId} onValueChange={(v) => setTeamId(v === "none" ? "" : (v || ""))} items={{ none: "None", ...Object.fromEntries(teams.map(t => [t.id, `${t.name} (${t.type})`])) }}>
                  <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id} label={t.name}>{t.name} ({t.type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assigned Member</Label>
                <UserCombobox
                  value={assignedTo}
                  onChange={(id) => setAssignedTo(id)}
                  users={users}
                  placeholder="Search member..."
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={departmentId} onValueChange={(v) => setDepartmentId(v === "none" ? "" : (v || ""))} items={{ none: "None", ...Object.fromEntries(departments.map(d => [d.id, d.name])) }}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id} label={d.name}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Service Category</Label>
                <Select value={serviceCategoryId} onValueChange={(v) => { setServiceCategoryId(v === "none" ? "" : (v || "")); setServiceLineId(""); }} items={{ none: "None", ...Object.fromEntries(services.map(s => [s.id, s.name])) }}>
                  <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {services.map((s) => <SelectItem key={s.id} value={s.id} label={s.name}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Service Line</Label>
                <Select value={serviceLineId} onValueChange={(v) => setServiceLineId(v === "none" ? "" : (v || ""))} disabled={!serviceCategoryId} items={{ none: "None", ...Object.fromEntries(serviceLines.map(l => [l.id, l.name])) }}>
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

        {/* Row 4: Timing */}
        <Card>
          <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Delivery Time</Label>
                <Input type="datetime-local" value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Deadline</Label>
                <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Row 5: Instructions */}
        <Card>
          <CardHeader><CardTitle>Instructions</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Instruction Sheet Link</Label>
              <Input value={instructionSheetLink} onChange={(e) => setInstructionSheetLink(e.target.value)} placeholder="https://docs.google.com/..." />
            </div>
            <div className="space-y-2">
              <Label>Instruction Notes</Label>
              <Textarea
                value={instructionText}
                onChange={(e) => setInstructionText(e.target.value)}
                placeholder="Enter order instructions, requirements, or notes..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Row 6: File Attachments */}
        <Card>
          <CardHeader><CardTitle>Attachments</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer ${
                isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" multiple accept={ORDER_FILE_ACCEPT} className="hidden"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
              />
              <Upload className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium">Drop files here or <span className="text-primary">browse</span></p>
              <p className="text-xs text-muted-foreground mt-1">Images, PDF, Excel, CSV, ZIP, DOCX up to 50MB each</p>
            </div>

            {pendingFiles.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">{pendingFiles.length} file{pendingFiles.length > 1 ? "s" : ""} queued</span>
                {pendingFiles.map((file, idx) => {
                  const Icon = getFileIcon(file.type);
                  const size = file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
                  return (
                    <div key={`${file.name}-${idx}`} className="flex items-center gap-2 rounded-lg border bg-card p-2.5">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm truncate flex-1">{file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{size}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" type="button"
                        onClick={(e) => { e.stopPropagation(); setPendingFiles((prev) => prev.filter((_, i) => i !== idx)); }}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Order
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/orders")}>Cancel</Button>
        </div>
      </form>
    </div>
    </RequirePermission>
  );
}
