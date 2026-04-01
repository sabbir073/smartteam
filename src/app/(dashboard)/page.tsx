"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { formatCurrency } from "@/lib/order-utils";
import { StatusBadge } from "@/components/orders/status-badge";
import {
  ShoppingCart, DollarSign, Users, AlertTriangle, TrendingUp,
  ArrowUpRight, Clock, BarChart3, Star, Target, Package, ArrowUp, ArrowDown,
  CalendarDays, Ban, CheckCircle, Activity,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

/* eslint-disable @typescript-eslint/no-explicit-any */
const CC = ["#4f46e5", "#06b6d4", "#f59e0b", "#ef4444", "#8b5cf6", "#10b981", "#f97316", "#ec4899"];

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "last_6_months", label: "Last 6 Months" },
  { value: "this_year", label: "This Year" },
  { value: "last_year", label: "Last Year" },
  { value: "custom", label: "Custom" },
];

function formatLocal(v: number, sym: string) { return `${sym}${v.toLocaleString("en", { maximumFractionDigits: 0 })}`; }

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { hasPermission, loading: permLoading } = usePermissions();
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const fetchDash = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ period });
      if (period === "custom" && customStart) p.set("start_date", customStart);
      if (period === "custom" && customEnd) p.set("end_date", customEnd);
      const res = await fetch(`/api/dashboard?${p}`);
      if (res.ok) { const j = await res.json(); setD(j.data); }
    } catch {}
    finally { setLoading(false); }
  }, [period, customStart, customEnd]);

  useEffect(() => { if (!permLoading) fetchDash(); }, [permLoading, fetchDash]);

  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; })();
  const pl = PERIODS.find(p => p.value === period)?.label || "This Month";
  const revGrowth = d?.revenue?.prevPeriodNet > 0 ? Math.round(((d.revenue.periodNet - d.revenue.prevPeriodNet) / d.revenue.prevPeriodNet) * 100) : 0;

  const S = () => <div className="stat-card"><Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-8 w-32" /></div>;

  return (
    <div className="space-y-6">
      {/* Header + Period */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{greeting}, {session?.user?.name?.split(" ")[0]}</h1>
          <p className="mt-1 text-muted-foreground">Here&apos;s your business overview.</p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <div className="flex rounded-lg border bg-card p-0.5 gap-0.5 flex-wrap">
              {PERIODS.map((opt) => (
                <button key={opt.value} onClick={() => setPeriod(opt.value)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${period === opt.value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {period === "custom" && (
            <div className="flex items-center gap-2">
              <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-36 h-8 text-xs" />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-36 h-8 text-xs" />
              <Button size="sm" className="h-8 text-xs" onClick={fetchDash} disabled={!customStart || !customEnd}>Go</Button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1,2,3,4].map(i => <S key={i} />)}</div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1,2,3,4].map(i => <S key={i} />)}</div>
        </div>
      ) : (
        <>
          {/* ═══ ROW 1: Primary Metrics ═══ */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* 1. Total Orders */}
            {hasPermission("orders", "view") && (
              <div className="stat-card gradient-card cursor-pointer group" onClick={() => router.push("/orders")}>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Total Orders</p>
                    <p className="text-2xl font-bold">{d?.orders?.orderCount || 0}</p>
                    <p className="text-xs text-muted-foreground">Gross: {formatCurrency(d?.orders?.totalGross || 0)}</p>
                  </div>
                  <div className="icon-box-primary"><ShoppingCart className="h-5 w-5" /></div>
                </div>
                <ArrowUpRight className="absolute bottom-3 right-3 h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all" />
              </div>
            )}

            {/* 2. Revenue */}
            {hasPermission("revenue", "view") && (
              <div className="stat-card gradient-card gradient-card-success cursor-pointer group" onClick={() => router.push("/revenue")}>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Revenue (after platform fee)</p>
                    <p className="text-2xl font-bold">{formatCurrency(d?.revenue?.periodNet || 0)}</p>
                    <div className="flex items-center gap-1 text-xs">
                      {revGrowth !== 0 && (revGrowth > 0 ? <ArrowUp className="h-3 w-3 text-success" /> : <ArrowDown className="h-3 w-3 text-destructive" />)}
                      <span className={revGrowth > 0 ? "text-success" : revGrowth < 0 ? "text-destructive" : "text-muted-foreground"}>{revGrowth > 0 ? "+" : ""}{revGrowth}% vs prev</span>
                    </div>
                  </div>
                  <div className="icon-box-success"><DollarSign className="h-5 w-5" /></div>
                </div>
                <ArrowUpRight className="absolute bottom-3 right-3 h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all" />
              </div>
            )}

            {/* 3. Overdue */}
            {hasPermission("orders", "view") && (
              <div className="stat-card gradient-card gradient-card-danger">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-destructive">Overdue</p>
                    <p className="text-2xl font-bold text-destructive">{d?.overdue?.overdue || 0}</p>
                    <p className="text-xs text-muted-foreground">Not delivered, past deadline</p>
                  </div>
                  <div className="icon-box-danger"><AlertTriangle className="h-5 w-5" /></div>
                </div>
              </div>
            )}

            {/* 4. Cancelled */}
            {hasPermission("orders", "view") && (
              <div className="stat-card">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Cancelled</p>
                    <p className="text-2xl font-bold">{d?.cancelled?.cancelled || 0}</p>
                    <p className="text-xs text-muted-foreground">In {pl.toLowerCase()}</p>
                  </div>
                  <div className="icon-box" style={{ background: "oklch(from var(--muted-foreground) l c h / 0.1)", color: "var(--muted-foreground)" }}><Ban className="h-5 w-5" /></div>
                </div>
              </div>
            )}
          </div>

          {/* ═══ ROW 2: Secondary Metrics ═══ */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* 5. Target Achievement */}
            {hasPermission("targets", "view") && (
              <div className="stat-card cursor-pointer group" onClick={() => router.push("/targets")}>
                <div className="flex items-start justify-between mb-2">
                  <div><p className="text-sm font-medium text-muted-foreground">Target Achievement</p><p className="text-2xl font-bold">{d?.targets?.rate || 0}%</p></div>
                  <div className="icon-box-primary"><Target className="h-5 w-5" /></div>
                </div>
                <Progress value={Math.min(d?.targets?.rate || 0, 100)} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                  <span>{formatCurrency(d?.targets?.totalAchieved || 0)}</span>
                  <span>{formatCurrency(d?.targets?.totalTarget || 0)}</span>
                </div>
              </div>
            )}

            {/* 6. Inventory */}
            {hasPermission("inventory", "view") && (
              <div className="stat-card cursor-pointer group" onClick={() => router.push("/inventory")}>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Inventory</p>
                    <p className="text-2xl font-bold">{d?.inventory?.activeItems || 0} <span className="text-sm font-normal text-muted-foreground">active</span></p>
                    <p className="text-xs text-muted-foreground">Value: {formatCurrency(d?.inventory?.totalValue || 0)}</p>
                  </div>
                  <div className="icon-box-info"><Package className="h-5 w-5" /></div>
                </div>
              </div>
            )}

            {/* 7. Special Orders (local currency) */}
            {hasPermission("special-orders", "view") && (
              <div className="stat-card cursor-pointer group" onClick={() => router.push("/special-orders")}>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Special Orders Cost</p>
                    <p className="text-2xl font-bold text-destructive">{formatLocal(d?.specialOrders?.periodSpentLocal || 0, d?.specialOrders?.currencySymbol || "৳")}</p>
                    <p className="text-xs text-muted-foreground">{d?.specialOrders?.periodCount || 0} orders · {formatCurrency(d?.specialOrders?.periodSpentUSD || 0)} USD</p>
                  </div>
                  <div className="icon-box-warning"><Star className="h-5 w-5" /></div>
                </div>
              </div>
            )}

            {/* Bonus: Avg Value + Completion + Active */}
            {hasPermission("orders", "view") && (
              <div className="stat-card">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Performance</p>
                    <p className="text-lg font-bold">{formatCurrency(d?.bonus?.avgOrderValue || 0)} <span className="text-xs font-normal text-muted-foreground">avg</span></p>
                    <div className="flex gap-3 text-xs">
                      <span className="text-success flex items-center gap-1"><CheckCircle className="h-3 w-3" />{d?.bonus?.completionRate || 0}% done</span>
                      <span className="text-primary flex items-center gap-1"><Activity className="h-3 w-3" />{d?.bonus?.totalActive || 0} active</span>
                    </div>
                  </div>
                  <div className="icon-box-success"><TrendingUp className="h-5 w-5" /></div>
                </div>
              </div>
            )}
          </div>

          {/* ═══ ROW 3: Team + Platform Fees + Profit Margin ═══ */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {hasPermission("teams", "view") && (
              <div className="stat-card cursor-pointer group" onClick={() => router.push("/teams")}>
                <div className="flex items-start justify-between">
                  <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Team</p><p className="text-2xl font-bold">{d?.teamStats?.totalUsers || 0}</p><p className="text-xs text-muted-foreground">{d?.teamStats?.activeTeams || 0} teams</p></div>
                  <div className="icon-box-warning"><Users className="h-5 w-5" /></div>
                </div>
              </div>
            )}
            {hasPermission("revenue", "view") && (
              <div className="stat-card">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Platform Fees Paid</p>
                    <p className="text-2xl font-bold text-destructive">{formatCurrency((d?.orders?.totalGross || 0) - (d?.orders?.totalNet || 0))}</p>
                    <p className="text-xs text-muted-foreground">{((((d?.orders?.totalGross || 0) - (d?.orders?.totalNet || 0)) / (d?.orders?.totalGross || 1)) * 100).toFixed(1)}% of gross</p>
                  </div>
                  <div className="icon-box-danger"><DollarSign className="h-5 w-5" /></div>
                </div>
              </div>
            )}
            {hasPermission("revenue", "view") && hasPermission("special-orders", "view") && (
              <div className="stat-card">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Net Profit (after SO)</p>
                    <p className="text-2xl font-bold text-success">{formatCurrency((d?.revenue?.periodNet || 0) - (d?.specialOrders?.periodSpentUSD || 0))}</p>
                    <p className="text-xs text-muted-foreground">Revenue {formatCurrency(d?.revenue?.periodNet || 0)} − SO {formatCurrency(d?.specialOrders?.periodSpentUSD || 0)}</p>
                  </div>
                  <div className="icon-box-success"><TrendingUp className="h-5 w-5" /></div>
                </div>
              </div>
            )}
          </div>

          {/* ═══ ROW 4: Charts ═══ */}
          <div className="grid gap-4 lg:grid-cols-7">
            {/* 8. Revenue Trend */}
            {hasPermission("revenue", "view") && (
              <Card className="lg:col-span-4 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-base">Revenue Trend</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[280px]" style={{ minWidth: 0, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
                      <BarChart data={d.revenueTrend}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="label" className="text-xs" />
                        <YAxis className="text-xs" tickFormatter={(v: number) => `$${v >= 1000 ? (v/1000).toFixed(0) + "k" : v}`} />
                        <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                        <Bar dataKey="gross" name="Gross" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="net" name="Net" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 9. Order Status */}
            {hasPermission("orders", "view") && (
              <Card className="lg:col-span-3 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-base">Order Status ({pl})</CardTitle></CardHeader>
                <CardContent>
                  {(d?.ordersByStatus?.length || 0) === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-20">No data for {pl.toLowerCase()}</p>
                  ) : (
                    <div className="h-[280px]" style={{ minWidth: 0, minHeight: 0 }}>
                      <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
                        <PieChart>
                          <Pie data={d.ordersByStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="count" nameKey="name">
                            {d.ordersByStatus.map((e: any, i: number) => <Cell key={i} fill={e.color || CC[i % CC.length]} />)}
                          </Pie>
                          <Tooltip /><Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* ═══ ROW 5: Breakdowns ═══ */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* 10. Revenue by Platform */}
            {hasPermission("revenue", "view") && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3"><CardTitle className="text-base">Revenue by Platform</CardTitle></CardHeader>
                <CardContent>
                  {(d?.revenueByPlatform?.length || 0) === 0 ? <p className="text-sm text-muted-foreground text-center py-6">No data</p> : (
                    <div className="space-y-2">{d.revenueByPlatform.map((p: any, i: number) => (
                      <div key={p.name} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3"><div className="h-3 w-3 rounded-full" style={{ backgroundColor: CC[i] }} /><div><span className="text-sm font-medium">{p.name}</span><p className="text-xs text-muted-foreground">{p.count} orders</p></div></div>
                        <span className="text-sm font-bold text-success">{formatCurrency(p.net)}</span>
                      </div>
                    ))}</div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 11. Revenue by Profile */}
            {hasPermission("revenue", "view") && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3"><CardTitle className="text-base">Revenue by Profile</CardTitle></CardHeader>
                <CardContent>
                  {(d?.revenueByProfile?.length || 0) === 0 ? <p className="text-sm text-muted-foreground text-center py-6">No data</p> : (
                    <div className="space-y-2">{d.revenueByProfile.slice(0, 6).map((p: any) => (
                      <div key={p.name} className="flex items-center justify-between p-3 rounded-lg border">
                        <div><span className="text-sm font-medium">{p.name}</span><p className="text-xs text-muted-foreground">{p.count} orders</p></div>
                        <span className="text-sm font-bold text-success">{formatCurrency(p.net)}</span>
                      </div>
                    ))}</div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 12. Employee Performance */}
            {hasPermission("revenue", "view") && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3"><CardTitle className="text-base">Employee Performance</CardTitle></CardHeader>
                <CardContent>
                  {(d?.employeePerformance?.length || 0) === 0 ? <p className="text-sm text-muted-foreground text-center py-6">No data</p> : (
                    <div className="space-y-2">{d.employeePerformance.slice(0, 6).map((e: any, i: number) => (
                      <div key={e.name} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${i < 3 ? "text-amber-500" : "text-muted-foreground"}`}>#{i + 1}</span>
                          <div><span className="text-sm font-medium">{e.name}</span>{e.companyId && <Badge variant="secondary" className="ml-1 text-[9px]">{e.companyId}</Badge>}<p className="text-xs text-muted-foreground">{e.count} orders</p></div>
                        </div>
                        <span className="text-sm font-bold text-success">{formatCurrency(e.net)}</span>
                      </div>
                    ))}</div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* ═══ ROW 6: Special Orders + Recent + Top ═══ */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* 13. Special Orders by Profile */}
            {hasPermission("special-orders", "view") && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Special Orders by Profile</CardTitle>
                  <Badge variant="destructive" className="text-xs">Cost</Badge>
                </CardHeader>
                <CardContent>
                  {(d?.specialOrdersByProfile?.length || 0) === 0 ? <p className="text-sm text-muted-foreground text-center py-6">No data</p> : (
                    <div className="space-y-2">{d.specialOrdersByProfile.map((p: any) => (
                      <div key={p.name} className="flex items-center justify-between p-3 rounded-lg border">
                        <div><span className="text-sm font-medium">{p.name}</span><p className="text-xs text-muted-foreground">{p.count} orders</p></div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-destructive">{formatLocal(p.spentLocal, d?.specialOrders?.currencySymbol || "৳")}</span>
                          <p className="text-xs text-muted-foreground">{formatCurrency(p.spent)}</p>
                        </div>
                      </div>
                    ))}</div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 14. Recent Orders */}
            {hasPermission("orders", "view") && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Recent Orders</CardTitle>
                  <div className="icon-box-primary" style={{ height: "2rem", width: "2rem" }}><Clock className="h-4 w-4" /></div>
                </CardHeader>
                <CardContent>
                  {(!d?.recentOrders?.length) ? <p className="text-sm text-muted-foreground text-center py-6">No orders yet</p> : (
                    <div className="space-y-1.5">{d.recentOrders.map((o: any) => {
                      const st = Array.isArray(o.order_statuses) ? o.order_statuses[0] : o.order_statuses;
                      const pl2 = Array.isArray(o.platforms) ? o.platforms[0] : o.platforms;
                      return (
                        <div key={o.id} className="flex items-center justify-between rounded-lg border p-2 cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/orders/${o.id}`)}>
                          <div className="min-w-0"><div className="flex items-center gap-1.5"><span className="text-sm font-medium truncate">{o.client_name}</span>{pl2 && <Badge variant="secondary" className="text-[8px]">{pl2.name}</Badge>}</div><p className="text-[10px] text-muted-foreground font-mono">{o.order_number}</p></div>
                          <div className="text-right shrink-0 ml-2"><p className="text-sm font-semibold">{formatCurrency(o.net_amount)}</p>{st && <StatusBadge name={st.name} color={st.color} />}</div>
                        </div>
                      );
                    })}</div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 15. Top Performers */}
            {hasPermission("revenue", "view") && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Top Performers ({pl})</CardTitle>
                  <div className="icon-box-warning" style={{ height: "2rem", width: "2rem" }}><BarChart3 className="h-4 w-4" /></div>
                </CardHeader>
                <CardContent>
                  {(!d?.topPerformers?.length) ? <p className="text-sm text-muted-foreground text-center py-6">No data</p> : (
                    <div className="space-y-1.5">{d.topPerformers.map((p: any, i: number) => {
                      const m = ["bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"];
                      return (
                        <div key={p.name} className="flex items-center gap-3 rounded-lg border p-2.5">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${m[i] || "bg-muted text-muted-foreground"}`}>{i + 1}</div>
                          <span className="text-sm font-medium flex-1 truncate">{p.name}</span>
                          <span className="text-sm font-bold text-success shrink-0">{formatCurrency(p.revenue)}</span>
                        </div>
                      );
                    })}</div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
