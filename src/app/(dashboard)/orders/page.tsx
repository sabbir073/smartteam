"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/orders/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { RequirePermission } from "@/components/shared/require-permission";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency, getTimeRemaining } from "@/lib/order-utils";

interface OrderRow {
  id: string;
  order_number: string;
  order_date: string;
  client_name: string;
  profile_name: string | null;
  external_order_id: string | null;
  gross_amount: number;
  net_amount: number;
  deadline: string | null;
  platforms: { id: string; name: string } | null;
  order_statuses: { id: string; name: string; color: string } | null;
  service_categories: { id: string; name: string } | null;
  assigned_user: { id: string; name: string; avatar_url: string | null; company_id: string | null } | null;
  employee: { id: string; name: string; avatar_url: string | null; company_id: string | null } | null;
  teams: { id: string; name: string } | null;
  [key: string]: unknown;
}

export default function OrdersPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filter state
  const [platformFilter, setPlatformFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [platforms, setPlatforms] = useState<{ id: string; name: string }[]>([]);
  const [statuses, setStatuses] = useState<{ id: string; name: string; color: string }[]>([]);

  const debouncedSearch = useDebounce(search, 300);

  // Fetch filter options
  useEffect(() => {
    Promise.all([
      fetch("/api/platforms").then((r) => r.json()),
      fetch("/api/order-statuses").then((r) => r.json()),
    ]).then(([pRes, sRes]) => {
      setPlatforms(pRes.data || []);
      setStatuses(sRes.data || []);
    }).catch(() => {});
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), pageSize: "20" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (platformFilter) params.set("platform_id", platformFilter);
      if (statusFilter) params.set("status_id", statusFilter);

      const res = await fetch(`/api/orders?${params}`);
      if (res.ok) {
        const json = await res.json();
        setOrders(json.data || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 1);
      }
    } catch { toast.error("Failed to load orders"); }
    finally { setLoading(false); }
  }, [page, debouncedSearch, platformFilter, statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const columns: Column<OrderRow>[] = [
    {
      key: "order_number", header: "Order #",
      render: (o) => (
        <button onClick={() => router.push(`/orders/${o.id}`)} className="font-mono text-sm font-medium text-primary hover:underline">
          {o.order_number}
        </button>
      ),
    },
    {
      key: "client_name", header: "Client",
      render: (o) => (
        <div>
          <span className="font-medium">{o.client_name}</span>
          {o.profile_name && <p className="text-xs text-muted-foreground">{o.profile_name}</p>}
        </div>
      ),
    },
    {
      key: "platform", header: "Platform",
      render: (o) => {
        const p = Array.isArray(o.platforms) ? o.platforms[0] : o.platforms;
        return p ? <Badge variant="outline">{p.name}</Badge> : <span>-</span>;
      },
    },
    {
      key: "employee", header: "Employee",
      render: (o) => {
        const emp = Array.isArray(o.employee) ? o.employee[0] : o.employee;
        if (!emp) return <span className="text-muted-foreground text-sm">-</span>;
        return (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={emp.avatar_url || undefined} />
              <AvatarFallback className="text-[8px]">{emp.name?.[0]}</AvatarFallback>
            </Avatar>
            <div>
              <span className="text-sm">{emp.name}</span>
              {emp.company_id && <p className="text-[10px] text-muted-foreground">{emp.company_id}</p>}
            </div>
          </div>
        );
      },
    },
    {
      key: "amount", header: "Amount",
      render: (o) => (
        <div className="text-right">
          <p className="font-medium">{formatCurrency(o.net_amount)}</p>
          <p className="text-xs text-muted-foreground">{formatCurrency(o.gross_amount)} gross</p>
        </div>
      ),
      className: "text-right",
    },
    {
      key: "status", header: "Status",
      render: (o) => {
        const s = Array.isArray(o.order_statuses) ? o.order_statuses[0] : o.order_statuses;
        return s ? <StatusBadge name={s.name} color={s.color} /> : <span>-</span>;
      },
    },
    {
      key: "assigned", header: "Assigned To",
      render: (o) => {
        const u = Array.isArray(o.assigned_user) ? o.assigned_user[0] : o.assigned_user;
        if (!u) return <span className="text-muted-foreground text-sm">Unassigned</span>;
        return (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={u.avatar_url || undefined} />
              <AvatarFallback className="text-[8px]">{u.name?.[0]}</AvatarFallback>
            </Avatar>
            <span className="text-sm">{u.name}</span>
          </div>
        );
      },
    },
    {
      key: "deadline", header: "Deadline",
      render: (o) => {
        if (!o.deadline) return <span className="text-muted-foreground text-sm">-</span>;
        const t = getTimeRemaining(o.deadline);
        return (
          <span className={`text-sm ${t.isOverdue ? "text-destructive font-medium" : t.isUrgent ? "text-orange-600" : "text-muted-foreground"}`}>
            {t.text}
          </span>
        );
      },
    },
  ];

  return (
    <RequirePermission module="orders">
    <div className="space-y-6">
      <PageHeader title="Orders" description="Manage client orders across all platforms">
        {hasPermission("orders", "create") && (
          <Button onClick={() => router.push("/orders/new")}>
            <Plus className="mr-2 h-4 w-4" />New Order
          </Button>
        )}
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat-card"><div className="text-sm text-muted-foreground">Total Orders</div><div className="text-2xl font-bold">{total}</div></div>
        <div className="stat-card"><div className="text-sm text-muted-foreground">Revenue (after platform fee)</div><div className="text-2xl font-bold text-success">{formatCurrency(orders.reduce((s, o) => s + Number(o.net_amount), 0))}</div></div>
        <div className="stat-card"><div className="text-sm text-muted-foreground">Avg. Order Value</div><div className="text-2xl font-bold">{orders.length > 0 ? formatCurrency(orders.reduce((s, o) => s + Number(o.net_amount), 0) / orders.length) : "$0.00"}</div></div>
        <div className="stat-card"><div className="text-sm text-muted-foreground">Total Gross</div><div className="text-2xl font-bold">{formatCurrency(orders.reduce((s, o) => s + Number(o.gross_amount), 0))}</div></div>
      </div>

      {/* Filters */}
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

      <DataTable
        columns={columns}
        data={orders}
        loading={loading}
        searchable
        searchPlaceholder="Search by client name or order number..."
        onSearch={(q) => { setSearch(q); setPage(1); }}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        emptyMessage="No orders found. Create your first order."
      />
    </div>
    </RequirePermission>
  );
}
