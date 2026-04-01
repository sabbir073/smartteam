export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission, getFilteredUserIds } from "@/lib/permissions";

// GET /api/revenue - Revenue analytics
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "revenue", "view");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const period = sp.get("period") || "monthly"; // daily, weekly, monthly, quarterly, yearly
  const year = parseInt(sp.get("year") || new Date().getFullYear().toString());
  const month = sp.get("month") ? parseInt(sp.get("month")!) : null;
  const platformId = sp.get("platform_id") || "";
  const serviceCategoryId = sp.get("service_category_id") || "";

  // Build date range
  let startDate: string;
  let endDate: string;

  if (period === "yearly") {
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
  } else if (period === "quarterly" && month) {
    const qStart = Math.floor((month - 1) / 3) * 3 + 1;
    startDate = `${year}-${String(qStart).padStart(2, "0")}-01`;
    const qEnd = qStart + 2;
    const lastDay = new Date(year, qEnd, 0).getDate();
    endDate = `${year}-${String(qEnd).padStart(2, "0")}-${lastDay}`;
  } else if (month) {
    startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
  } else {
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
  }

  // Base query for completed orders (terminal statuses)
  let query = supabase
    .from("orders")
    .select(`
      id, order_date, gross_amount, platform_charge, net_amount,
      platform_id, service_category_id, assigned_to, created_by,
      platforms:platform_id(id, name),
      service_categories:service_category_id(id, name),
      order_statuses:status_id(is_terminal)
    `)
    .gte("order_date", startDate)
    .lte("order_date", endDate);

  // Data scope
  const filteredIds = await getFilteredUserIds(perm.dataScope, session.user.id);
  if (filteredIds) {
    query = query.or(`assigned_to.in.(${filteredIds.join(",")}),created_by.in.(${filteredIds.join(",")})`);
  }

  if (platformId) query = query.eq("platform_id", platformId);
  if (serviceCategoryId) query = query.eq("service_category_id", serviceCategoryId);

  const { data: orders, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Calculate aggregations
  const allOrders = orders || [];

  const totalGross = allOrders.reduce((sum, o) => sum + Number(o.gross_amount), 0);
  const totalCharges = allOrders.reduce((sum, o) => sum + Number(o.platform_charge), 0);
  const totalNet = allOrders.reduce((sum, o) => sum + Number(o.net_amount), 0);
  const orderCount = allOrders.length;

  // By platform
  const byPlatform: Record<string, { name: string; gross: number; net: number; count: number }> = {};
  for (const o of allOrders) {
    const p = Array.isArray(o.platforms) ? o.platforms[0] : o.platforms;
    const pid = o.platform_id;
    if (!byPlatform[pid]) byPlatform[pid] = { name: (p as Record<string, string>)?.name || "Unknown", gross: 0, net: 0, count: 0 };
    byPlatform[pid].gross += Number(o.gross_amount);
    byPlatform[pid].net += Number(o.net_amount);
    byPlatform[pid].count += 1;
  }

  // By service
  const byService: Record<string, { name: string; gross: number; net: number; count: number }> = {};
  for (const o of allOrders) {
    const s = Array.isArray(o.service_categories) ? o.service_categories[0] : o.service_categories;
    const sid = o.service_category_id || "uncategorized";
    if (!byService[sid]) byService[sid] = { name: (s as Record<string, string>)?.name || "Uncategorized", gross: 0, net: 0, count: 0 };
    byService[sid].gross += Number(o.gross_amount);
    byService[sid].net += Number(o.net_amount);
    byService[sid].count += 1;
  }

  // Monthly trend
  const monthlyTrend: { month: string; gross: number; net: number; count: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    const mStr = String(m).padStart(2, "0");
    const prefix = `${year}-${mStr}`;
    const monthOrders = allOrders.filter((o) => (o.order_date as string).startsWith(prefix));
    monthlyTrend.push({
      month: prefix,
      gross: monthOrders.reduce((s, o) => s + Number(o.gross_amount), 0),
      net: monthOrders.reduce((s, o) => s + Number(o.net_amount), 0),
      count: monthOrders.length,
    });
  }

  const totalCosts = 0;
  const profit = totalNet;

  return NextResponse.json({
    data: {
      summary: { totalGross, totalCharges, totalNet, totalCosts, profit, orderCount, avgOrderValue: orderCount > 0 ? totalNet / orderCount : 0 },
      byPlatform: Object.values(byPlatform),
      byService: Object.values(byService),
      monthlyTrend,
      period: { startDate, endDate, year },
    },
  });
}
