"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, Column } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { RequirePermission } from "@/components/shared/require-permission";
import { useDebounce } from "@/hooks/use-debounce";
import { format } from "date-fns";
import { MODULES } from "@/lib/constants";

interface AuditRow {
  id: string; action: string; module: string; entity_type: string | null;
  entity_id: string | null; ip_address: string | null; created_at: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  users: { id: string; name: string; email: string } | null;
  [key: string]: unknown;
}

const actionColors: Record<string, string> = {
  create: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  update: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  delete: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  login: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  assign: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approve: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  reject: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), pageSize: "30" });
      if (moduleFilter) params.set("module", moduleFilter);
      if (actionFilter) params.set("action", actionFilter);
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);

      const res = await fetch(`/api/audit-logs?${params}`);
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 1);
      }
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  }, [page, moduleFilter, actionFilter, startDate, endDate]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const columns: Column<AuditRow>[] = [
    { key: "created_at", header: "Time", render: (l) => <span className="text-xs font-mono">{format(new Date(l.created_at), "MMM d, HH:mm:ss")}</span> },
    {
      key: "user", header: "User",
      render: (l) => { const u = Array.isArray(l.users) ? l.users[0] : l.users; return <span className="text-sm">{(u as Record<string, string>)?.name || "System"}</span>; },
    },
    { key: "action", header: "Action", render: (l) => <Badge className={actionColors[l.action] || ""}>{l.action}</Badge> },
    { key: "module", header: "Module", render: (l) => <Badge variant="outline">{l.module}</Badge> },
    { key: "entity_type", header: "Entity", render: (l) => <span className="text-sm">{l.entity_type || "-"}</span> },
    { key: "ip_address", header: "IP", render: (l) => <span className="text-xs font-mono text-muted-foreground">{l.ip_address || "-"}</span> },
    {
      key: "changes", header: "Changes",
      render: (l) => {
        if (!l.old_values && !l.new_values) return <span className="text-muted-foreground">-</span>;
        const changes = [];
        if (l.new_values) {
          for (const [k, v] of Object.entries(l.new_values)) {
            if (k === "updated_at" || k === "password_hash") continue;
            const oldV = l.old_values?.[k];
            if (oldV !== undefined && oldV !== v) changes.push(`${k}: ${String(oldV)} → ${String(v)}`);
            else if (!l.old_values) changes.push(`${k}: ${String(v)}`);
          }
        }
        if (changes.length === 0) return <span className="text-muted-foreground text-xs">-</span>;
        return <span className="text-xs text-muted-foreground line-clamp-2">{changes.join(", ")}</span>;
      },
    },
  ];

  return (
    <RequirePermission module="audit-logs">
    <div className="space-y-6">
      <PageHeader title="Audit Logs" description="System activity trail" />

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={moduleFilter} onValueChange={(v) => { setModuleFilter(v === "all" ? "" : (v || "")); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Modules" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            {MODULES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v === "all" ? "" : (v || "")); setPage(1); }}>
          <SelectTrigger className="w-32"><SelectValue placeholder="All Actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {["create", "update", "delete", "login", "assign", "approve", "reject"].map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="w-36" placeholder="Start date" />
        <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="w-36" placeholder="End date" />
      </div>

      <DataTable columns={columns} data={logs} loading={loading} page={page} totalPages={totalPages} total={total} onPageChange={setPage} emptyMessage="No audit logs found." />
    </div>
    </RequirePermission>
  );
}
