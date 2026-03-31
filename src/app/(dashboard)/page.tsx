"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { usePermissions } from "@/hooks/use-permissions";
import { formatCurrency } from "@/lib/order-utils";
import { StatusBadge } from "@/components/orders/status-badge";
import {
  ShoppingCart, DollarSign, Users, AlertTriangle, TrendingUp,
  ArrowUpRight, Clock, BarChart3, Star, Target, Package, ArrowUp, ArrowDown,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

/* eslint-disable @typescript-eslint/no-explicit-any */
const CHART_COLORS = ["#4f46e5", "#06b6d4", "#f59e0b", "#ef4444", "#8b5cf6", "#10b981", "#f97316", "#ec4899"];

function StatSkeleton() {
  return <div className="stat-card"><div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-32" /><Skeleton className="h-3 w-20" /></div></div>;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { hasPermission, loading: permLoading } = usePermissions();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (permLoading) return;
    fetch("/api/dashboard").then((r) => r.json()).then((j) => setData(j.data)).catch(() => {}).finally(() => setLoading(false));
  }, [permLoading]);

  if (loading || permLoading) {
    return (
      <div className="space-y-8">
        <div><Skeleton className="h-8 w-56 mb-2" /><Skeleton className="h-4 w-72" /></div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)}</div>
      </div>
    );
  }

  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; })();
  const revGrowth = data?.revenue?.prevMonthNet > 0 ? Math.round(((data.revenue.monthlyNet - data.revenue.prevMonthNet) / data.revenue.prevMonthNet) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{greeting}, {session?.user?.name?.split(" ")[0]}</h1>
        <p className="mt-1 text-muted-foreground">Here&apos;s what&apos;s happening with your business today.</p>
      </div>

      {/* ═══ ROW 1: Key Metrics ═══ */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {hasPermission("revenue", "view") && (
          <div className="stat-card gradient-card cursor-pointer group" onClick={() => router.push("/revenue")}>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Monthly Revenue</p>
                <p className="text-2xl font-bold tracking-tight">{formatCurrency(data?.revenue?.monthlyNet || 0)}</p>
                <div className="flex items-center gap-1 text-xs">
                  {revGrowth !== 0 && (revGrowth > 0 ? <ArrowUp className="h-3 w-3 text-success" /> : <ArrowDown className="h-3 w-3 text-destructive" />)}
                  <span className={revGrowth > 0 ? "text-success" : revGrowth < 0 ? "text-destructive" : "text-muted-foreground"}>{revGrowth > 0 ? "+" : ""}{revGrowth}% vs last month</span>
                </div>
              </div>
              <div className="icon-box-success"><DollarSign className="h-5 w-5" /></div>
            </div>
            <ArrowUpRight className="absolute bottom-3 right-3 h-4 w-4 text-muted-foreground/0 transition-all group-hover:text-muted-foreground/60" />
          </div>
        )}

        {hasPermission("revenue", "view") && (
          <div className="stat-card gradient-card gradient-card-info">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Today&apos;s Revenue</p>
                <p className="text-2xl font-bold tracking-tight">{formatCurrency(data?.revenue?.todayNet || 0)}</p>
                <p className="text-xs text-muted-foreground">Gross: {formatCurrency(data?.revenue?.monthlyGross || 0)}</p>
              </div>
              <div className="icon-box-info"><TrendingUp className="h-5 w-5" /></div>
            </div>
          </div>
        )}

        {hasPermission("orders", "view") && (
          <div className="stat-card gradient-card cursor-pointer group" onClick={() => router.push("/orders")}>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Active Orders</p>
                <p className="text-2xl font-bold tracking-tight">{data?.orders?.active || 0}</p>
                <p className="text-xs text-muted-foreground">{data?.orders?.total || 0} total · {data?.orders?.completedThisMonth || 0} completed</p>
              </div>
              <div className="icon-box-primary"><ShoppingCart className="h-5 w-5" /></div>
            </div>
            <ArrowUpRight className="absolute bottom-3 right-3 h-4 w-4 text-muted-foreground/0 transition-all group-hover:text-muted-foreground/60" />
          </div>
        )}

        {hasPermission("orders", "view") && (data?.orders?.overdue || 0) > 0 && (
          <div className="stat-card gradient-card gradient-card-danger">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">Overdue</p>
                <p className="text-2xl font-bold text-destructive">{data?.orders?.overdue}</p>
                <p className="text-xs text-muted-foreground">Past deadline</p>
              </div>
              <div className="icon-box-danger"><AlertTriangle className="h-5 w-5" /></div>
            </div>
          </div>
        )}

        {hasPermission("teams", "view") && (
          <div className="stat-card gradient-card gradient-card-warning cursor-pointer group" onClick={() => router.push("/teams")}>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Team</p>
                <p className="text-2xl font-bold tracking-tight">{data?.teamStats?.totalUsers || 0}</p>
                <p className="text-xs text-muted-foreground">{data?.teamStats?.activeTeams || 0} active teams</p>
              </div>
              <div className="icon-box-warning"><Users className="h-5 w-5" /></div>
            </div>
            <ArrowUpRight className="absolute bottom-3 right-3 h-4 w-4 text-muted-foreground/0 transition-all group-hover:text-muted-foreground/60" />
          </div>
        )}
      </div>

      {/* ═══ ROW 2: Targets + Inventory + Special Orders ═══ */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {hasPermission("targets", "view") && (
          <div className="stat-card cursor-pointer group" onClick={() => router.push("/targets")}>
            <div className="flex items-start justify-between mb-3">
              <div><p className="text-sm font-medium text-muted-foreground">Target Achievement</p><p className="text-2xl font-bold">{data?.targets?.achievementRate || 0}%</p></div>
              <div className="icon-box-primary"><Target className="h-5 w-5" /></div>
            </div>
            <Progress value={Math.min(data?.targets?.achievementRate || 0, 100)} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>Achieved: {formatCurrency(data?.targets?.totalAchieved || 0)}</span>
              <span>Target: {formatCurrency(data?.targets?.totalTarget || 0)}</span>
            </div>
          </div>
        )}

        {hasPermission("inventory", "view") && (
          <div className="stat-card cursor-pointer group" onClick={() => router.push("/inventory")}>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Inventory</p>
                <p className="text-2xl font-bold">{data?.inventory?.activeItems || 0} <span className="text-sm font-normal text-muted-foreground">active items</span></p>
                <p className="text-xs text-muted-foreground">Total value: {formatCurrency(data?.inventory?.totalValue || 0)}</p>
              </div>
              <div className="icon-box-info"><Package className="h-5 w-5" /></div>
            </div>
          </div>
        )}

        {hasPermission("special-orders", "view") && (
          <div className="stat-card cursor-pointer group" onClick={() => router.push("/special-orders")}>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Special Orders (Cost)</p>
                <p className="text-2xl font-bold text-destructive">{formatCurrency(data?.specialOrders?.monthlySpent || 0)}</p>
                <p className="text-xs text-muted-foreground">{data?.specialOrders?.count || 0} total · {formatCurrency(data?.specialOrders?.totalSpent || 0)} all time</p>
              </div>
              <div className="icon-box-warning"><Star className="h-5 w-5" /></div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ ROW 3: Revenue Trend Chart + Order Status Distribution ═══ */}
      <div className="grid gap-5 lg:grid-cols-7">
        {hasPermission("revenue", "view") && data?.revenue?.monthlyTrend?.length > 0 && (
          <Card className="lg:col-span-4 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-base">Revenue Trend (6 Months)</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.revenue.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    <Bar dataKey="gross" name="Gross" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="net" name="Net Revenue" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {hasPermission("orders", "view") && data?.orders?.byStatus?.length > 0 && (
          <Card className="lg:col-span-3 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-base">Order Status Distribution</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.orders.byStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="count" nameKey="name">
                      {data.orders.byStatus.map((entry: any, i: number) => <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ═══ ROW 4: Platform Revenue + Profile Revenue + Employee Performance ═══ */}
      <div className="grid gap-5 lg:grid-cols-3">
        {hasPermission("revenue", "view") && data?.revenue?.monthlyByPlatform?.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Revenue by Platform</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.revenue.monthlyByPlatform.map((p: any, i: number) => (
                  <div key={p.name} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i] }} />
                      <div>
                        <span className="text-sm font-medium">{p.name}</span>
                        <p className="text-xs text-muted-foreground">{p.count} orders</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-success">{formatCurrency(p.net)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {hasPermission("revenue", "view") && data?.revenue?.monthlyByProfile?.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Revenue by Profile</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.revenue.monthlyByProfile.slice(0, 5).map((p: any, i: number) => (
                  <div key={p.name} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <span className="text-sm font-medium">{p.name}</span>
                      <p className="text-xs text-muted-foreground">{p.count} orders</p>
                    </div>
                    <span className="text-sm font-bold text-success">{formatCurrency(p.net)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {hasPermission("revenue", "view") && data?.revenue?.monthlyByEmployee?.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Employee Performance</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.revenue.monthlyByEmployee.slice(0, 5).map((e: any, i: number) => (
                  <div key={e.name} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${i < 3 ? "text-amber-500" : "text-muted-foreground"}`}>#{i + 1}</span>
                      <div>
                        <span className="text-sm font-medium">{e.name}</span>
                        {e.companyId && <Badge variant="secondary" className="ml-1 text-[9px]">{e.companyId}</Badge>}
                        <p className="text-xs text-muted-foreground">{e.count} orders</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-success">{formatCurrency(e.net)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ═══ ROW 5: Special Orders by Profile + Recent Orders + Top Performers ═══ */}
      <div className="grid gap-5 lg:grid-cols-3">
        {hasPermission("special-orders", "view") && data?.specialOrders?.byProfile?.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Special Orders by Profile</CardTitle>
              <Badge variant="destructive" className="text-xs">Cost Center</Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.specialOrders.byProfile.map((p: any) => (
                  <div key={p.name} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <span className="text-sm font-medium">{p.name}</span>
                      <p className="text-xs text-muted-foreground">{p.count} special orders</p>
                    </div>
                    <span className="text-sm font-bold text-destructive">{formatCurrency(p.spent)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {hasPermission("orders", "view") && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent Orders</CardTitle>
              <div className="icon-box-primary" style={{ height: "2rem", width: "2rem" }}><Clock className="h-4 w-4" /></div>
            </CardHeader>
            <CardContent>
              {(!data?.recentOrders || data.recentOrders.length === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-8">No orders yet</p>
              ) : (
                <div className="space-y-2">
                  {data.recentOrders.map((order: any) => {
                    const status = Array.isArray(order.order_statuses) ? order.order_statuses[0] : order.order_statuses;
                    const platform = Array.isArray(order.platforms) ? order.platforms[0] : order.platforms;
                    return (
                      <div key={order.id} className="flex items-center justify-between rounded-lg border p-2.5 cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/orders/${order.id}`)}>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{order.client_name}</span>
                            {platform && <Badge variant="secondary" className="text-[9px]">{platform.name}</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">{order.order_number}</p>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="text-sm font-semibold">{formatCurrency(order.net_amount)}</p>
                          {status && <StatusBadge name={status.name} color={status.color} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {hasPermission("revenue", "view") && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Top Performers</CardTitle>
              <div className="icon-box-warning" style={{ height: "2rem", width: "2rem" }}><BarChart3 className="h-4 w-4" /></div>
            </CardHeader>
            <CardContent>
              {(!data?.topPerformers || data.topPerformers.length === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
              ) : (
                <div className="space-y-2">
                  {data.topPerformers.map((p: any, i: number) => {
                    const medals = ["bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"];
                    return (
                      <div key={p.name} className="flex items-center gap-3 rounded-lg border p-2.5">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${medals[i] || "bg-muted text-muted-foreground"}`}>{i + 1}</div>
                        <span className="text-sm font-medium flex-1 truncate">{p.name}</span>
                        <span className="text-sm font-bold text-success shrink-0">{formatCurrency(p.revenue)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
