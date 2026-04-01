"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function RevenuePage() {
  const { hasPermission } = usePermissions();
  const [year, setYear] = useState(new Date().getFullYear());
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [byPlatform, setByPlatform] = useState<BreakdownItem[]>([]);
  const [byService, setByService] = useState<BreakdownItem[]>([]);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(true);


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

  useEffect(() => { fetchRevenue(); }, [fetchRevenue]);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const trendData = trend.map((t, i) => ({ ...t, name: monthNames[i] }));

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat-card">
          <div className="text-sm text-muted-foreground">Gross Revenue</div>
          {loading ? <div className="h-7 w-24 bg-muted animate-pulse rounded mt-1" /> : <div className="text-2xl font-bold">{formatCurrency(summary?.totalGross || 0)}</div>}
        </div>
        <div className="stat-card">
          <div className="text-sm text-muted-foreground">Platform Charges</div>
          {loading ? <div className="h-7 w-24 bg-muted animate-pulse rounded mt-1" /> : <div className="text-2xl font-bold text-destructive">{formatCurrency(summary?.totalCharges || 0)}</div>}
        </div>
        <div className="stat-card">
          <div className="text-sm text-muted-foreground">Revenue (after platform fee)</div>
          {loading ? <div className="h-7 w-24 bg-muted animate-pulse rounded mt-1" /> : <div className="text-2xl font-bold text-success">{formatCurrency(summary?.totalNet || 0)}</div>}
        </div>
        <div className="stat-card">
          <div className="text-sm text-muted-foreground">Total Orders</div>
          {loading ? <div className="h-7 w-24 bg-muted animate-pulse rounded mt-1" /> : (
            <div>
              <div className="text-2xl font-bold">{summary?.orderCount || 0}</div>
              <p className="text-xs text-muted-foreground">Avg: {formatCurrency(summary?.avgOrderValue || 0)}</p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
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
      </div>
    </div>
    </RequirePermission>
  );
}
