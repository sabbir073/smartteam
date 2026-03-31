"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, ShoppingCart, DollarSign, Users, Star, Target, Package, FileText, FileSpreadsheet, File } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { RequirePermission } from "@/components/shared/require-permission";
import { exportData } from "@/lib/export-utils";
import { formatCurrency } from "@/lib/order-utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ReportType {
  id: string;
  title: string;
  description: string;
  icon: any;
  module: string;
  apiUrl: string;
  columns: { key: string; header: string; format?: (v: any) => string }[];
  dataExtractor: (data: any) => any[];
}

const reportTypes: ReportType[] = [
  {
    id: "orders",
    title: "Orders Report",
    description: "All orders with client, platform, amounts, status, and assignment details",
    icon: ShoppingCart,
    module: "orders",
    apiUrl: "/api/orders?pageSize=500",
    columns: [
      { key: "order_number", header: "Order #" },
      { key: "order_date", header: "Date" },
      { key: "client_name", header: "Client" },
      { key: "platform_name", header: "Platform" },
      { key: "profile_name", header: "Profile" },
      { key: "gross_amount", header: "Gross ($)", format: (v) => `$${Number(v).toFixed(2)}` },
      { key: "platform_charge", header: "Fee ($)", format: (v) => `$${Number(v).toFixed(2)}` },
      { key: "net_amount", header: "Net ($)", format: (v) => `$${Number(v).toFixed(2)}` },
      { key: "status_name", header: "Status" },
      { key: "employee_name", header: "Employee" },
      { key: "assigned_name", header: "Assigned To" },
      { key: "deadline", header: "Deadline" },
    ],
    dataExtractor: (data) => (data.data || []).map((o: any) => ({
      ...o,
      platform_name: (Array.isArray(o.platforms) ? o.platforms[0] : o.platforms)?.name || "",
      profile_name: (Array.isArray(o.platform_profiles) ? o.platform_profiles[0] : o.platform_profiles)?.name || "",
      status_name: (Array.isArray(o.order_statuses) ? o.order_statuses[0] : o.order_statuses)?.name || "",
      employee_name: (Array.isArray(o.employee) ? o.employee[0] : o.employee)?.name || "",
      assigned_name: (Array.isArray(o.assigned_user) ? o.assigned_user[0] : o.assigned_user)?.name || "",
      deadline: o.deadline ? new Date(o.deadline).toLocaleDateString() : "",
    })),
  },
  {
    id: "special-orders",
    title: "Special Orders Report",
    description: "All special/review orders with spending breakdown",
    icon: Star,
    module: "special-orders",
    apiUrl: "/api/special-orders?pageSize=500",
    columns: [
      { key: "order_number", header: "Order #" },
      { key: "order_date", header: "Date" },
      { key: "client_name", header: "Client" },
      { key: "platform_name", header: "Platform" },
      { key: "profile_name", header: "Profile" },
      { key: "gross_amount", header: "Spent ($)", format: (v) => `$${Number(v).toFixed(2)}` },
      { key: "net_amount", header: "Net Cost ($)", format: (v) => `$${Number(v).toFixed(2)}` },
      { key: "status_name", header: "Status" },
      { key: "notes", header: "Notes" },
    ],
    dataExtractor: (data) => (data.data || []).map((o: any) => ({
      ...o,
      platform_name: (Array.isArray(o.platforms) ? o.platforms[0] : o.platforms)?.name || "",
      profile_name: (Array.isArray(o.platform_profiles) ? o.platform_profiles[0] : o.platform_profiles)?.name || "",
      status_name: (Array.isArray(o.order_statuses) ? o.order_statuses[0] : o.order_statuses)?.name || "",
    })),
  },
  {
    id: "revenue",
    title: "Revenue Report",
    description: "Revenue breakdown by platform, profile, and employee",
    icon: DollarSign,
    module: "revenue",
    apiUrl: "/api/orders?pageSize=500",
    columns: [
      { key: "order_number", header: "Order #" },
      { key: "order_date", header: "Date" },
      { key: "client_name", header: "Client" },
      { key: "platform_name", header: "Platform" },
      { key: "profile_name", header: "Profile" },
      { key: "employee_name", header: "Employee" },
      { key: "employee_id_col", header: "Emp ID" },
      { key: "gross_amount", header: "Gross ($)", format: (v) => `$${Number(v).toFixed(2)}` },
      { key: "platform_charge", header: "Fee ($)", format: (v) => `$${Number(v).toFixed(2)}` },
      { key: "net_amount", header: "Net ($)", format: (v) => `$${Number(v).toFixed(2)}` },
    ],
    dataExtractor: (data) => (data.data || []).map((o: any) => {
      const emp = Array.isArray(o.employee) ? o.employee[0] : o.employee;
      return {
        ...o,
        platform_name: (Array.isArray(o.platforms) ? o.platforms[0] : o.platforms)?.name || "",
        profile_name: (Array.isArray(o.platform_profiles) ? o.platform_profiles[0] : o.platform_profiles)?.name || "",
        employee_name: emp?.name || "",
        employee_id_col: emp?.company_id || "",
      };
    }),
  },
  {
    id: "users",
    title: "Users Report",
    description: "All users with roles, departments, and status",
    icon: Users,
    module: "users",
    apiUrl: "/api/users?pageSize=500",
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
    description: "Employee targets with achievement rates",
    icon: Target,
    module: "targets",
    apiUrl: "/api/targets",
    columns: [
      { key: "user_name", header: "Employee" },
      { key: "period_type", header: "Period" },
      { key: "period_start", header: "Start" },
      { key: "period_end", header: "End" },
      { key: "target_amount", header: "Target ($)", format: (v) => `$${Number(v).toFixed(2)}` },
    ],
    dataExtractor: (data) => (data.data || []).map((t: any) => {
      const u = Array.isArray(t.users) ? t.users[0] : t.users;
      return { ...t, user_name: u?.name || "" };
    }),
  },
  {
    id: "inventory",
    title: "Inventory Report",
    description: "Technology inventory items with status and costs",
    icon: Package,
    module: "inventory",
    apiUrl: "/api/inventory",
    columns: [
      { key: "item_name", header: "Item" },
      { key: "category", header: "Category" },
      { key: "serial_number", header: "Serial #" },
      { key: "status", header: "Status" },
      { key: "cost", header: "Cost ($)", format: (v) => v ? `$${Number(v).toFixed(2)}` : "" },
      { key: "purchase_date", header: "Purchased" },
      { key: "assigned_name", header: "Assigned To" },
    ],
    dataExtractor: (data) => (data.data || []).map((i: any) => {
      const u = Array.isArray(i.users) ? i.users[0] : i.users;
      return { ...i, assigned_name: u?.name || i.assigned_name || "" };
    }),
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
      const params = new URLSearchParams();
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
      if (params.toString()) url += (url.includes("?") ? "&" : "?") + params.toString();

      const res = await fetch(url);
      if (!res.ok) { toast.error("Failed to fetch data"); return; }
      const rawData = await res.json();
      const data = activeReport.dataExtractor(rawData);

      if (data.length === 0) { toast.error("No data found for the selected criteria"); return; }

      const filename = `${activeReport.id}-report-${new Date().toISOString().split("T")[0]}`;
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {availableReports.map((rt) => (
          <Card
            key={rt.id}
            className={`cursor-pointer transition-all ${selectedReport === rt.id ? "border-primary ring-2 ring-primary/20 shadow-md" : "hover:border-primary/30 hover:shadow-sm"}`}
            onClick={() => setSelectedReport(rt.id)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className={`icon-box ${selectedReport === rt.id ? "icon-box-primary" : "bg-muted text-muted-foreground"}`} style={{ height: "2.5rem", width: "2.5rem" }}>
                  <rt.icon className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-sm">{rt.title}</CardTitle>
                  <CardDescription className="text-xs">{rt.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Export Options */}
      {selectedReport && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Export Options</CardTitle>
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

            {/* Date Range */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Start Date (optional)</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Date (optional)</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button onClick={handleDownload} disabled={downloading} size="lg" className="w-full">
                  {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Download {selectedFormat.toUpperCase()}
                </Button>
              </div>
            </div>

            {/* Preview info */}
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">
                <strong>{activeReport?.title}</strong> will include {activeReport?.columns.length} columns: {activeReport?.columns.map((c) => c.header).join(", ")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    </RequirePermission>
  );
}
