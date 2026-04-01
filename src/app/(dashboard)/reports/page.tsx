"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, ShoppingCart, DollarSign, Users, Star, Target, Package, FileText, FileSpreadsheet, File, UserCircle, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { RequirePermission } from "@/components/shared/require-permission";
import { exportData } from "@/lib/export-utils";

/* eslint-disable @typescript-eslint/no-explicit-any */
function uw(v: any) { return Array.isArray(v) ? v[0] : v; }

interface ReportType {
  id: string;
  title: string;
  description: string;
  icon: any;
  module: string;
  apiUrl: string;
  supportsDateFilter: boolean;
  columns: { key: string; header: string; format?: (v: any) => string }[];
  dataExtractor: (data: any) => any[];
}

const reportTypes: ReportType[] = [
  {
    id: "orders",
    title: "Orders Report",
    description: "Complete order details with assignments, platforms, amounts and status",
    icon: ShoppingCart,
    module: "orders",
    apiUrl: "/api/orders?pageSize=1000",
    supportsDateFilter: true,
    columns: [
      { key: "order_number", header: "Order #" },
      { key: "order_date", header: "Date" },
      { key: "employee_name", header: "Employee" },
      { key: "employee_cid", header: "Emp ID" },
      { key: "platform_name", header: "Platform" },
      { key: "profile_name", header: "Profile" },
      { key: "client_name", header: "Client" },
      { key: "external_order_id", header: "Platform Order ID" },
      { key: "gross_amount", header: "Gross ($)", format: (v) => `$${Number(v || 0).toFixed(2)}` },
      { key: "platform_charge", header: "Platform Fee ($)", format: (v) => `$${Number(v || 0).toFixed(2)}` },
      { key: "net_amount", header: "Net ($)", format: (v) => `$${Number(v || 0).toFixed(2)}` },
      { key: "status_name", header: "Status" },
      { key: "assigned_name", header: "Assigned To" },
      { key: "team_name", header: "Team" },
      { key: "department_name", header: "Department" },
      { key: "service_name", header: "Service" },
      { key: "service_line_name", header: "Service Line" },
      { key: "deadline_fmt", header: "Deadline" },
      { key: "delivery_time_fmt", header: "Delivery Time" },
    ],
    dataExtractor: (data) => (data.data || []).map((o: any) => {
      const emp = uw(o.employee);
      return {
        ...o,
        employee_name: emp?.name || "",
        employee_cid: emp?.company_id || "",
        platform_name: uw(o.platforms)?.name || "",
        profile_name: uw(o.platform_profiles)?.name || "",
        status_name: uw(o.order_statuses)?.name || "",
        assigned_name: uw(o.assigned_user)?.name || "",
        team_name: uw(o.teams)?.name || "",
        department_name: uw(o.departments)?.name || "",
        service_name: uw(o.service_categories)?.name || "",
        service_line_name: uw(o.service_lines)?.name || "",
        deadline_fmt: o.deadline ? new Date(o.deadline).toLocaleDateString() : "",
        delivery_time_fmt: o.delivery_time ? new Date(o.delivery_time).toLocaleString() : "",
      };
    }),
  },
  {
    id: "special-orders",
    title: "Special Orders Report",
    description: "Review/fake orders with spending in USD and BDT",
    icon: Star,
    module: "special-orders",
    apiUrl: "/api/special-orders?pageSize=1000",
    supportsDateFilter: true,
    columns: [
      { key: "order_number", header: "Order #" },
      { key: "order_date", header: "Date" },
      { key: "client_name", header: "Client" },
      { key: "platform_name", header: "Platform" },
      { key: "profile_name", header: "Profile" },
      { key: "gross_amount", header: "Spent USD ($)", format: (v) => `$${Number(v || 0).toFixed(2)}` },
      { key: "platform_charge", header: "Platform Fee ($)", format: (v) => `$${Number(v || 0).toFixed(2)}` },
      { key: "net_amount", header: "Net Cost ($)", format: (v) => `$${Number(v || 0).toFixed(2)}` },
      { key: "status_name", header: "Status" },
      { key: "notes", header: "Notes" },
    ],
    dataExtractor: (data) => (data.data || []).map((o: any) => ({
      ...o,
      platform_name: uw(o.platforms)?.name || "",
      profile_name: uw(o.platform_profiles)?.name || "",
      status_name: uw(o.order_statuses)?.name || "",
    })),
  },
  {
    id: "revenue",
    title: "Revenue Report",
    description: "Revenue breakdown by platform, profile, employee with fee details",
    icon: DollarSign,
    module: "revenue",
    apiUrl: "/api/orders?pageSize=1000",
    supportsDateFilter: true,
    columns: [
      { key: "order_number", header: "Order #" },
      { key: "order_date", header: "Date" },
      { key: "platform_name", header: "Platform" },
      { key: "profile_name", header: "Profile" },
      { key: "employee_name", header: "Employee" },
      { key: "employee_cid", header: "Emp ID" },
      { key: "client_name", header: "Client" },
      { key: "gross_amount", header: "Gross ($)", format: (v) => `$${Number(v || 0).toFixed(2)}` },
      { key: "platform_charge", header: "Platform Fee ($)", format: (v) => `$${Number(v || 0).toFixed(2)}` },
      { key: "net_amount", header: "Revenue ($)", format: (v) => `$${Number(v || 0).toFixed(2)}` },
      { key: "service_name", header: "Service" },
      { key: "team_name", header: "Team" },
    ],
    dataExtractor: (data) => (data.data || []).map((o: any) => {
      const emp = uw(o.employee);
      return {
        ...o,
        platform_name: uw(o.platforms)?.name || "",
        profile_name: uw(o.platform_profiles)?.name || "",
        employee_name: emp?.name || "",
        employee_cid: emp?.company_id || "",
        service_name: uw(o.service_categories)?.name || "",
        team_name: uw(o.teams)?.name || "",
      };
    }),
  },
  {
    id: "users",
    title: "Users Report",
    description: "All users with company ID, roles, departments, and status",
    icon: Users,
    module: "users",
    apiUrl: "/api/users?pageSize=500",
    supportsDateFilter: false,
    columns: [
      { key: "company_id", header: "Company ID" },
      { key: "name", header: "Name" },
      { key: "email", header: "Email" },
      { key: "role_name", header: "Role" },
      { key: "is_active", header: "Status", format: (v) => v ? "Active" : "Inactive" },
      { key: "created_at", header: "Joined", format: (v) => v ? new Date(v).toLocaleDateString() : "" },
    ],
    dataExtractor: (data) => (data.data || []).map((u: any) => {
      const ur = Array.isArray(u.user_roles) ? u.user_roles[0] : u.user_roles;
      const role = ur?.roles ? (Array.isArray(ur.roles) ? ur.roles[0] : ur.roles) : null;
      return { ...u, role_name: role?.name || "No role" };
    }),
  },
  {
    id: "targets",
    title: "Targets Report",
    description: "Employee revenue targets and achievement tracking",
    icon: Target,
    module: "targets",
    apiUrl: "/api/targets",
    supportsDateFilter: false,
    columns: [
      { key: "user_name", header: "Employee" },
      { key: "period_type", header: "Period" },
      { key: "period_start", header: "Start" },
      { key: "period_end", header: "End" },
      { key: "target_amount", header: "Target ($)", format: (v) => `$${Number(v || 0).toFixed(2)}` },
    ],
    dataExtractor: (data) => (data.data || []).map((t: any) => ({
      ...t,
      user_name: uw(t.users)?.name || "",
    })),
  },
  {
    id: "inventory",
    title: "Inventory Report",
    description: "Technology equipment inventory with costs and assignments",
    icon: Package,
    module: "inventory",
    apiUrl: "/api/inventory",
    supportsDateFilter: false,
    columns: [
      { key: "item_name", header: "Item" },
      { key: "category", header: "Category" },
      { key: "serial_number", header: "Serial #" },
      { key: "status", header: "Status" },
      { key: "cost", header: "Cost ($)", format: (v) => v ? `$${Number(v).toFixed(2)}` : "" },
      { key: "purchase_date", header: "Purchased" },
      { key: "assigned_name", header: "Assigned To" },
      { key: "notes", header: "Notes" },
    ],
    dataExtractor: (data) => (data.data || []).map((i: any) => ({
      ...i,
      assigned_name: uw(i.users)?.name || "",
    })),
  },
  {
    id: "profiles",
    title: "Platform Profiles Report",
    description: "All platform profiles with URLs and status",
    icon: UserCircle,
    module: "profiles",
    apiUrl: "/api/platform-profiles",
    supportsDateFilter: false,
    columns: [
      { key: "name", header: "Profile Name" },
      { key: "platform_name", header: "Platform" },
      { key: "profile_url", header: "URL" },
      { key: "description", header: "Description" },
      { key: "is_active", header: "Status", format: (v) => v ? "Active" : "Disabled" },
    ],
    dataExtractor: (data) => (data.data || []).map((p: any) => ({
      ...p,
      platform_name: uw(p.platforms)?.name || "",
    })),
  },
  {
    id: "requisitions",
    title: "Requisitions Report",
    description: "Technology requisition requests with approval status",
    icon: ClipboardList,
    module: "requisitions",
    apiUrl: "/api/requisitions",
    supportsDateFilter: false,
    columns: [
      { key: "requester_name", header: "Requester" },
      { key: "item_description", header: "Item" },
      { key: "purpose", header: "Purpose" },
      { key: "estimated_cost", header: "Est. Cost ($)", format: (v) => v ? `$${Number(v).toFixed(2)}` : "" },
      { key: "urgency", header: "Urgency" },
      { key: "status", header: "Status" },
      { key: "review_notes", header: "Review Notes" },
      { key: "created_at", header: "Submitted", format: (v) => v ? new Date(v).toLocaleDateString() : "" },
    ],
    dataExtractor: (data) => (data.data || []).map((r: any) => ({
      ...r,
      requester_name: uw(r.requester || r.users)?.name || "",
    })),
  },
];

const formatOptions = [
  { value: "csv", label: "CSV", icon: FileText, description: "Comma-separated values" },
  { value: "xlsx", label: "Excel", icon: FileSpreadsheet, description: "Microsoft Excel" },
  { value: "pdf", label: "PDF", icon: File, description: "PDF document" },
  { value: "docx", label: "Word", icon: File, description: "Microsoft Word" },
];

export default function ReportsPage() {
  const { hasPermission } = usePermissions();
  const [selectedReport, setSelectedReport] = useState<string>("");
  const [selectedFormat, setSelectedFormat] = useState<string>("xlsx");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [downloading, setDownloading] = useState(false);

  const availableReports = reportTypes.filter((r) => hasPermission(r.module, "view"));
  const activeReport = reportTypes.find((r) => r.id === selectedReport);

  async function handleDownload() {
    if (!activeReport || !selectedFormat) { toast.error("Select a report and format"); return; }
    setDownloading(true);
    try {
      let url = activeReport.apiUrl;

      // Apply date filter if supported and dates provided
      if (activeReport.supportsDateFilter && (startDate || endDate)) {
        const sep = url.includes("?") ? "&" : "?";
        const params = new URLSearchParams();
        if (startDate) params.set("start_date", startDate);
        if (endDate) params.set("end_date", endDate);
        url += sep + params.toString();
      }

      const res = await fetch(url);
      if (!res.ok) { toast.error("Failed to fetch data"); setDownloading(false); return; }
      const rawData = await res.json();
      const data = activeReport.dataExtractor(rawData);

      if (data.length === 0) { toast.error("No data found for the selected criteria"); setDownloading(false); return; }

      const dateSuffix = startDate && endDate ? `_${startDate}_to_${endDate}` : "";
      const filename = `${activeReport.id}-report-${new Date().toISOString().split("T")[0]}${dateSuffix}`;
      await exportData(selectedFormat as "csv" | "xlsx" | "pdf" | "docx", data, activeReport.columns, filename, activeReport.title);
      toast.success(`${activeReport.title} exported as ${selectedFormat.toUpperCase()}`);
    } catch (err) {
      console.error(err);
      toast.error("Export failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <RequirePermission module="reports">
    <div className="space-y-6">
      <PageHeader title="Reports" description="Generate and export reports in multiple formats" />

      {/* Report Type Selection */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {availableReports.map((rt) => (
          <Card
            key={rt.id}
            className={`cursor-pointer transition-all ${selectedReport === rt.id ? "border-primary ring-2 ring-primary/20 shadow-md" : "hover:border-primary/30 hover:shadow-sm"}`}
            onClick={() => setSelectedReport(rt.id)}
          >
            <CardHeader className="pb-2 p-4">
              <div className="flex items-center gap-3">
                <div className={`icon-box ${selectedReport === rt.id ? "icon-box-primary" : "bg-muted text-muted-foreground"}`} style={{ height: "2.25rem", width: "2.25rem" }}>
                  <rt.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-sm truncate">{rt.title}</CardTitle>
                  <CardDescription className="text-[11px] truncate">{rt.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Export Options */}
      {selectedReport && activeReport && (
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Export: {activeReport.title}</CardTitle>
              <Badge variant="outline" className="text-xs">{activeReport.columns.length} columns</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Format Selection */}
            <div className="space-y-2">
              <Label>Export Format</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {formatOptions.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setSelectedFormat(f.value)}
                    className={`flex items-center gap-2 rounded-lg border p-3 text-sm transition-all ${
                      selectedFormat === f.value ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "hover:border-primary/30"
                    }`}
                  >
                    <f.icon className={`h-5 w-5 ${selectedFormat === f.value ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="text-left">
                      <p className="font-medium">{f.label}</p>
                      <p className="text-xs text-muted-foreground">{f.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range (only for reports that support it) */}
            {activeReport.supportsDateFilter && (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Start Date (optional)</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>End Date (optional)</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
                <div />
              </div>
            )}

            {/* Download */}
            <div className="flex items-center gap-4">
              <Button onClick={handleDownload} disabled={downloading} size="lg">
                {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Download {selectedFormat.toUpperCase()}
              </Button>
              {activeReport.supportsDateFilter && !startDate && !endDate && (
                <p className="text-xs text-muted-foreground">No date filter — exports all data</p>
              )}
            </div>

            {/* Column Preview */}
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Columns included:</p>
              <div className="flex flex-wrap gap-1.5">
                {activeReport.columns.map((c) => (
                  <Badge key={c.key} variant="secondary" className="text-[10px]">{c.header}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    </RequirePermission>
  );
}
