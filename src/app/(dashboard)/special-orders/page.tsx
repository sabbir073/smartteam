"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/orders/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { RequirePermission } from "@/components/shared/require-permission";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency, getTimeRemaining } from "@/lib/order-utils";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface SORow { id: string; order_number: string; client_name: string; gross_amount: number; net_amount: number; notes: string | null; deadline: string | null; platforms: any; order_statuses: any; platform_profiles: any; [key: string]: unknown; }

export default function SpecialOrdersPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const [orders, setOrders] = useState<SORow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [platformFilter, setPlatformFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [platforms, setPlatforms] = useState<{ id: string; name: string; bdt_conversion_rate?: number }[]>([]);
  const [soCurrency, setSoCurrency] = useState({ code: "BDT", symbol: "৳" });
  const [statuses, setStatuses] = useState<{ id: string; name: string; color: string }[]>([]);

  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    Promise.all([
      fetch("/api/platforms").then((r) => r.json()),
      fetch("/api/order-statuses").then((r) => r.json()),
    ]).then(([p, s]) => { setPlatforms(p.data || []); setStatuses(s.data || []); }).catch(() => {});
    fetch("/api/settings").then(r => r.json()).then(j => {
      if (j.data?.so_currency_code) setSoCurrency({ code: String(j.data.so_currency_code).replace(/"/g, ""), symbol: String(j.data.so_currency_symbol || "৳").replace(/"/g, "") });
    }).catch(() => {});
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), pageSize: "20" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (platformFilter) params.set("platform_id", platformFilter);
      if (statusFilter) params.set("status_id", statusFilter);

      const res = await fetch(`/api/special-orders?${params}`);
      if (res.ok) {
        const json = await res.json();
        setOrders(json.data || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 1);
      }
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  }, [page, debouncedSearch, platformFilter, statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const columns: Column<SORow>[] = [
    { key: "order_number", header: "Order #", render: (o) => (
      <button onClick={() => router.push(`/special-orders/${o.id}`)} className="font-mono text-sm font-medium text-primary hover:underline">{o.order_number}</button>
    )},
    { key: "client_name", header: "Client", render: (o) => <span className="font-medium">{o.client_name}</span> },
    { key: "platform", header: "Platform", render: (o) => {
      const p = Array.isArray(o.platforms) ? o.platforms[0] : o.platforms;
      return p ? <Badge variant="outline">{p.name}</Badge> : <span>-</span>;
    }},
    { key: "profile", header: "Profile", render: (o) => {
      const pp = Array.isArray(o.platform_profiles) ? o.platform_profiles[0] : o.platform_profiles;
      return pp ? <span className="text-sm">{pp.name}</span> : <span className="text-muted-foreground text-sm">-</span>;
    }},
    { key: "amount", header: "Spent", className: "text-right", render: (o) => (
      <div className="text-right">
        <p className="font-medium">{formatCurrency(o.gross_amount)}</p>
        <p className="text-xs text-muted-foreground">Net: {formatCurrency(o.net_amount)}</p>
      </div>
    )},
    { key: "notes", header: "Notes", render: (o) => o.notes ? <span className="text-sm text-muted-foreground truncate max-w-[200px] block">{o.notes}</span> : <span className="text-muted-foreground text-sm">-</span> },
    { key: "status", header: "Status", render: (o) => {
      const s = Array.isArray(o.order_statuses) ? o.order_statuses[0] : o.order_statuses;
      return s ? <StatusBadge name={s.name} color={s.color} /> : <span>-</span>;
    }},
    { key: "deadline", header: "Deadline", render: (o) => {
      if (!o.deadline) return <span className="text-muted-foreground text-sm">-</span>;
      const t = getTimeRemaining(o.deadline);
      return <span className={`text-sm ${t.isOverdue ? "text-destructive font-medium" : t.isUrgent ? "text-orange-600" : "text-muted-foreground"}`}>{t.text}</span>;
    }},
  ];

  return (
    <RequirePermission module="special-orders">
    <div className="space-y-6">
      <PageHeader title="Special Orders" description="Track spending on review/fake orders (not counted in revenue)">
        {hasPermission("special-orders", "create") && (
          <Button onClick={() => router.push("/special-orders/new")}><Plus className="mr-2 h-4 w-4" />New Special Order</Button>
        )}
      </PageHeader>

      {/* Summary Cards */}
      {(() => {
        const toLocal = (o: SORow) => {
          const pid = (o as Record<string, unknown>).platform_id as string;
          const rate = platforms.find(p => p.id === pid)?.bdt_conversion_rate || 110;
          return Number(o.gross_amount) * rate;
        };
        const sym = soCurrency.symbol;
        const fmtLocal = (v: number) => `${sym}${v.toLocaleString("en", { maximumFractionDigits: 0 })}`;
        const totalCostLocal = orders.reduce((s, o) => s + toLocal(o), 0);
        const totalCostUSD = orders.reduce((s, o) => s + Number(o.gross_amount), 0);
        const avgLocal = orders.length > 0 ? totalCostLocal / orders.length : 0;
        const avgUSD = orders.length > 0 ? totalCostUSD / orders.length : 0;

        return (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="stat-card">
              <div className="text-sm text-muted-foreground">Total Special Orders</div>
              <div className="text-2xl font-bold">{total}</div>
            </div>
            <div className="stat-card">
              <div className="text-sm text-muted-foreground">Total Cost</div>
              <div className="text-2xl font-bold text-destructive">{fmtLocal(totalCostLocal)}</div>
              <p className="text-xs text-muted-foreground">{formatCurrency(totalCostUSD)} USD</p>
            </div>
            <div className="stat-card">
              <div className="text-sm text-muted-foreground">Avg. Cost per Order</div>
              <div className="text-2xl font-bold">{fmtLocal(avgLocal)}</div>
              <p className="text-xs text-muted-foreground">{formatCurrency(avgUSD)} USD</p>
            </div>
            {(() => {
              const feesLocal = orders.reduce((s, o) => {
                const pid = (o as Record<string, unknown>).platform_id as string;
                const rate = platforms.find(p => p.id === pid)?.bdt_conversion_rate || 110;
                return s + (Number(o.gross_amount) - Number(o.net_amount)) * rate;
              }, 0);
              const feesUSD = totalCostUSD - orders.reduce((s, o) => s + Number(o.net_amount), 0);
              return (
                <div className="stat-card">
                  <div className="text-sm text-muted-foreground">Platform Fees Paid</div>
                  <div className="text-2xl font-bold text-muted-foreground">{fmtLocal(feesLocal)}</div>
                  <p className="text-xs text-muted-foreground">{formatCurrency(feesUSD)} USD · Deducted by platforms</p>
                </div>
              );
            })()}
          </div>
        );
      })()}

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={platformFilter} onValueChange={(v) => { setPlatformFilter(v === "all" ? "" : (v || "")); setPage(1); }} items={{ all: "All Platforms", ...Object.fromEntries(platforms.map(p => [p.id, p.name])) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Platforms" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            {platforms.map((p) => <SelectItem key={p.id} value={p.id} label={p.name}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : (v || "")); setPage(1); }} items={{ all: "All Statuses", ...Object.fromEntries(statuses.map(s => [s.id, s.name])) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statuses.map((s) => <SelectItem key={s.id} value={s.id} label={s.name}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={orders} loading={loading} searchable searchPlaceholder="Search by client, order #, or notes..."
        onSearch={(q) => { setSearch(q); setPage(1); }} page={page} totalPages={totalPages} total={total} onPageChange={setPage}
        emptyMessage="No special orders yet." />
    </div>
    </RequirePermission>
  );
}
