"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DataTable, Column } from "@/components/shared/data-table";
import { DollarSign, TrendingUp, ShoppingCart, Minus, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { RequirePermission } from "@/components/shared/require-permission";
import { formatCurrency } from "@/lib/order-utils";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface RevenueSummary {
  totalGross: number;
  totalCharges: number;
  totalNet: number;
  totalCosts: number;
  profit: number;
  orderCount: number;
  avgOrderValue: number;
}

interface BreakdownItem { name: string; gross: number; net: number; count: number; }
interface TrendItem { month: string; gross: number; net: number; count: number; }
interface CostRow { id: string; amount: number; description: string; cost_date: string; orders: { order_number: string } | null; added_by_user: { name: string } | null; [key: string]: unknown; }

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function RevenuePage() {
  const { hasPermission } = usePermissions();
  const [year, setYear] = useState(new Date().getFullYear());
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [byPlatform, setByPlatform] = useState<BreakdownItem[]>([]);
  const [byService, setByService] = useState<BreakdownItem[]>([]);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Marketing costs
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [costsLoading, setCostsLoading] = useState(true);
  const [costDialogOpen, setCostDialogOpen] = useState(false);
  const [costAmount, setCostAmount] = useState("");
  const [costDesc, setCostDesc] = useState("");
  const [costSaving, setCostSaving] = useState(false);

  const fetchRevenue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/revenue?year=${year}`);
      if (res.ok) {
        const json = await res.json();
        setSummary(json.data.summary);
        setByPlatform(json.data.byPlatform);
        setByService(json.data.byService);
        setTrend(json.data.monthlyTrend);
      }
    } catch { toast.error("Failed to load revenue data"); }
    finally { setLoading(false); }
  }, [year]);

  const fetchCosts = useCallback(async () => {
    setCostsLoading(true);
    try {
      const res = await fetch("/api/marketing-costs");
      if (res.ok) {
        const json = await res.json();
        setCosts(json.data || []);
      }
    } catch { /* ignore */ }
    finally { setCostsLoading(false); }
  }, []);

  useEffect(() => { fetchRevenue(); fetchCosts(); }, [fetchRevenue, fetchCosts]);

  async function handleAddCost() {
    if (!costAmount) return;
    setCostSaving(true);
    try {
      const res = await fetch("/api/marketing-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseFloat(costAmount), description: costDesc }),
      });
      if (res.ok) {
        toast.success("Cost added");
        setCostDialogOpen(false);
        setCostAmount("");
        setCostDesc("");
        fetchRevenue();
        fetchCosts();
      } else { const json = await res.json(); toast.error(json.error || "Failed"); }
    } catch { toast.error("An error occurred"); }
    finally { setCostSaving(false); }
  }

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const trendData = trend.map((t, i) => ({ ...t, name: monthNames[i] }));

  const costColumns: Column<CostRow>[] = [
    { key: "cost_date", header: "Date", render: (c) => <span>{c.cost_date}</span> },
    { key: "amount", header: "Amount", render: (c) => <span className="font-medium">{formatCurrency(c.amount)}</span> },
    { key: "description", header: "Description", render: (c) => <span className="text-muted-foreground">{c.description || "-"}</span> },
    {
      key: "order", header: "Order",
      render: (c) => {
        const o = Array.isArray(c.orders) ? c.orders[0] : c.orders;
        return o ? <Badge variant="outline">{(o as Record<string, string>).order_number}</Badge> : <span>-</span>;
      },
    },
    {
      key: "added_by", header: "Added By",
      render: (c) => {
        const u = Array.isArray(c.added_by_user) ? c.added_by_user[0] : c.added_by_user;
        return <span>{(u as Record<string, string>)?.name || "-"}</span>;
      },
    },
  ];

  return (
    <RequirePermission module="revenue">
    <div className="space-y-6">
      <PageHeader title="Revenue" description="Revenue analytics and financial overview">
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={(v) => v && setYear(parseInt(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Gross Revenue", value: summary?.totalGross, icon: DollarSign, color: "" },
          { label: "Platform Charges", value: summary?.totalCharges, icon: Minus, color: "text-destructive" },
          { label: "Net Revenue", value: summary?.totalNet, icon: TrendingUp, color: "text-green-600" },
          { label: "Marketing Costs", value: summary?.totalCosts, icon: Minus, color: "text-orange-600" },
          { label: "Profit", value: summary?.profit, icon: DollarSign, color: (summary?.profit || 0) >= 0 ? "text-green-600" : "text-destructive" },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
              <item.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? <div className="h-7 w-24 bg-muted animate-pulse rounded" /> : (
                <div className={`text-2xl font-bold ${item.color}`}>{formatCurrency(item.value || 0)}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Orders</CardTitle><ShoppingCart className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{loading ? "..." : summary?.orderCount || 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Avg Order Value</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{loading ? "..." : formatCurrency(summary?.avgOrderValue || 0)}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="charts">
        <TabsList>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="costs">Marketing Costs</TabsTrigger>
        </TabsList>

        <TabsContent value="charts" className="space-y-6">
          {/* Revenue Trend */}
          <Card>
            <CardHeader><CardTitle>Revenue Trend ({year})</CardTitle><CardDescription>Monthly gross and net revenue</CardDescription></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                  <Line type="monotone" dataKey="gross" stroke="#3b82f6" name="Gross" strokeWidth={2} />
                  <Line type="monotone" dataKey="net" stroke="#22c55e" name="Net" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {/* By Platform */}
            <Card>
              <CardHeader><CardTitle>Revenue by Platform</CardTitle></CardHeader>
              <CardContent>
                {byPlatform.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No data</p> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={byPlatform} dataKey="net" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }: { name?: string; percent?: number }) => `${name || ""} ${((percent || 0) * 100).toFixed(0)}%`}>
                        {byPlatform.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* By Service */}
            <Card>
              <CardHeader><CardTitle>Revenue by Service</CardTitle></CardHeader>
              <CardContent>
                {byService.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No data</p> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={byService}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(v) => `$${v}`} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Bar dataKey="net" fill="#3b82f6" name="Net Revenue" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="costs" className="space-y-4">
          <div className="flex justify-end">
            {hasPermission("revenue", "create") && (
              <Button size="sm" onClick={() => setCostDialogOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />Add Cost
              </Button>
            )}
          </div>
          <DataTable columns={costColumns} data={costs} loading={costsLoading} emptyMessage="No marketing costs recorded." />
        </TabsContent>
      </Tabs>

      {/* Add Cost Dialog */}
      <Dialog open={costDialogOpen} onOpenChange={setCostDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Marketing Cost</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Amount (USD)</Label>
              <Input type="number" min="0" step="0.01" value={costAmount} onChange={(e) => setCostAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={costDesc} onChange={(e) => setCostDesc(e.target.value)} placeholder="What was this cost for?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCostDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddCost} disabled={costSaving || !costAmount}>
              {costSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add Cost
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </RequirePermission>
  );
}
