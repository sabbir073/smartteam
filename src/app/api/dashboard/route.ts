export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission, getFilteredUserIds } from "@/lib/permissions";
import { getSystemTimezone, getDateRangeForPeriod, getNowInTimezone, formatDate } from "@/lib/timezone";

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const period = sp.get("period") || "this_month";
  const customStart = sp.get("start_date") || undefined;
  const customEnd = sp.get("end_date") || undefined;

  const tz = await getSystemTimezone();
  const { startDate, endDate, prevStartDate, prevEndDate, today } = getDateRangeForPeriod(period, tz, customStart, customEnd);
  const now = getNowInTimezone(tz);

  const revPerm = await checkPermission(session.user.id, "revenue", "view");
  const orderPerm = await checkPermission(session.user.id, "orders", "view");
  const teamPerm = await checkPermission(session.user.id, "teams", "view");
  const targetPerm = await checkPermission(session.user.id, "targets", "view");
  const invPerm = await checkPermission(session.user.id, "inventory", "view");
  const soPerm = await checkPermission(session.user.id, "special-orders", "view");

  // Get scope filter IDs once
  let orderFilterIds: string[] | null = null;
  if (orderPerm.allowed) orderFilterIds = await getFilteredUserIds(orderPerm.dataScope, session.user.id);
  let revFilterIds: string[] | null = null;
  if (revPerm.allowed) revFilterIds = await getFilteredUserIds(revPerm.dataScope, session.user.id);

  function applyScope(q: any, ids: string[] | null) {
    if (ids) return q.or(`assigned_to.in.(${ids.join(",")}),created_by.in.(${ids.join(",")}),employee_id.in.(${ids.join(",")})`);
    return q;
  }

  // ═══ 1. ORDERS (period) — total count + total amount ═══
  let card1 = { orderCount: 0, totalGross: 0, totalNet: 0 };
  if (orderPerm.allowed) {
    let q = supabase.from("orders").select("gross_amount, net_amount").gte("order_date", startDate).lte("order_date", endDate);
    q = applyScope(q, orderFilterIds);
    const { data } = await q;
    card1.orderCount = (data || []).length;
    card1.totalGross = (data || []).reduce((s, o) => s + Number(o.gross_amount), 0);
    card1.totalNet = (data || []).reduce((s, o) => s + Number(o.net_amount), 0);
  }

  // ═══ 2. REVENUE (period) — net revenue + growth ═══
  let card2 = { periodNet: 0, prevPeriodNet: 0, todayNet: 0 };
  if (revPerm.allowed) {
    let pq = supabase.from("orders").select("net_amount").gte("order_date", startDate).lte("order_date", endDate);
    pq = applyScope(pq, revFilterIds);
    const { data: pd } = await pq;
    card2.periodNet = (pd || []).reduce((s, o) => s + Number(o.net_amount), 0);

    let pvq = supabase.from("orders").select("net_amount").gte("order_date", prevStartDate).lte("order_date", prevEndDate);
    pvq = applyScope(pvq, revFilterIds);
    const { data: pvd } = await pvq;
    card2.prevPeriodNet = (pvd || []).reduce((s, o) => s + Number(o.net_amount), 0);

    let tq = supabase.from("orders").select("net_amount").eq("order_date", today);
    tq = applyScope(tq, revFilterIds);
    const { data: td } = await tq;
    card2.todayNet = (td || []).reduce((s, o) => s + Number(o.net_amount), 0);
  }

  // ═══ 3. OVERDUE — active orders past deadline ═══
  let card3 = { overdue: 0 };
  if (orderPerm.allowed) {
    const { data: activeStatuses } = await supabase.from("order_statuses").select("id").eq("is_terminal", false);
    const activeIds = (activeStatuses || []).map(s => s.id);
    let oq = supabase.from("orders").select("id", { count: "exact", head: true }).lt("deadline", now.toISOString()).not("deadline", "is", null);
    if (activeIds.length) oq = oq.in("status_id", activeIds);
    oq = applyScope(oq, orderFilterIds);
    const { count } = await oq;
    card3.overdue = count || 0;
  }

  // ═══ 4. CANCELLED ORDERS (period) ═══
  let card4 = { cancelled: 0 };
  if (orderPerm.allowed) {
    const { data: cancelledStatuses } = await supabase.from("order_statuses").select("id").ilike("name", "%cancel%");
    const cancelIds = (cancelledStatuses || []).map(s => s.id);
    if (cancelIds.length) {
      let cq = supabase.from("orders").select("id", { count: "exact", head: true }).in("status_id", cancelIds).gte("order_date", startDate).lte("order_date", endDate);
      cq = applyScope(cq, orderFilterIds);
      const { count } = await cq;
      card4.cancelled = count || 0;
    }
  }

  // ═══ 5. TARGET ACHIEVEMENT (period) ═══
  let card5 = { totalTarget: 0, totalAchieved: 0, rate: 0 };
  if (targetPerm.allowed) {
    const { data: targets } = await supabase.from("targets").select("target_amount, user_id").gte("period_start", startDate).lte("period_start", endDate);
    card5.totalTarget = (targets || []).reduce((s, t) => s + Number(t.target_amount), 0);
    for (const t of targets || []) {
      const { data: uo } = await supabase.from("orders").select("net_amount").eq("assigned_to", t.user_id).gte("order_date", startDate).lte("order_date", endDate);
      card5.totalAchieved += (uo || []).reduce((s, o) => s + Number(o.net_amount), 0);
    }
    card5.rate = card5.totalTarget > 0 ? Math.round((card5.totalAchieved / card5.totalTarget) * 100) : 0;
  }

  // ═══ 6. INVENTORY (not period-dependent) ═══
  let card6 = { totalItems: 0, activeItems: 0, totalValue: 0 };
  if (invPerm.allowed) {
    const { data } = await supabase.from("tech_inventory").select("cost, status");
    card6.totalItems = (data || []).length;
    card6.activeItems = (data || []).filter(i => i.status === "active").length;
    card6.totalValue = (data || []).reduce((s, i) => s + Number(i.cost || 0), 0);
  }

  // ═══ 7. SPECIAL ORDERS (period) — in local currency ═══
  // Get SO currency settings
  const { data: soCurrRow } = await supabase.from("system_settings").select("value").eq("key", "so_currency_symbol").single();
  const soCurrencySymbol = soCurrRow?.value ? String(soCurrRow.value).replace(/"/g, "") : "৳";
  const { data: soCurrCodeRow } = await supabase.from("system_settings").select("value").eq("key", "so_currency_code").single();
  const soCurrencyCode = soCurrCodeRow?.value ? String(soCurrCodeRow.value).replace(/"/g, "") : "BDT";

  let card7 = { periodSpentUSD: 0, periodSpentLocal: 0, periodCount: 0, totalSpentUSD: 0, totalCount: 0, currencySymbol: soCurrencySymbol, currencyCode: soCurrencyCode };
  if (soPerm.allowed) {
    // Get platform BDT rates
    const { data: platforms } = await supabase.from("platforms").select("id, bdt_conversion_rate");
    const rateMap: Record<string, number> = {};
    (platforms || []).forEach(p => { rateMap[p.id] = Number(p.bdt_conversion_rate || 110); });

    const { data: periodSO } = await supabase.from("special_orders").select("gross_amount, platform_id").gte("order_date", startDate).lte("order_date", endDate);
    card7.periodCount = (periodSO || []).length;
    card7.periodSpentUSD = (periodSO || []).reduce((s, o) => s + Number(o.gross_amount), 0);
    card7.periodSpentLocal = (periodSO || []).reduce((s, o) => s + Number(o.gross_amount) * (rateMap[o.platform_id] || 110), 0);

    const { data: allSO } = await supabase.from("special_orders").select("gross_amount");
    card7.totalCount = (allSO || []).length;
    card7.totalSpentUSD = (allSO || []).reduce((s, o) => s + Number(o.gross_amount), 0);
  }

  // ═══ 8. REVENUE TREND (6 months ending at period) ═══
  let card8: { label: string; net: number; gross: number }[] = [];
  if (revPerm.allowed) {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStart = formatDate(new Date(d.getFullYear(), d.getMonth(), 1));
      const mEnd = formatDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
      let tQ = supabase.from("orders").select("net_amount, gross_amount").gte("order_date", mStart).lte("order_date", mEnd);
      tQ = applyScope(tQ, revFilterIds);
      const { data } = await tQ;
      card8.push({ label: d.toLocaleString("en", { month: "short" }), net: (data || []).reduce((s, o) => s + Number(o.net_amount), 0), gross: (data || []).reduce((s, o) => s + Number(o.gross_amount), 0) });
    }
  }

  // ═══ 9. ORDER STATUS DISTRIBUTION (period) ═══
  let card9: { name: string; color: string; count: number }[] = [];
  if (orderPerm.allowed) {
    const { data: allStatuses } = await supabase.from("order_statuses").select("id, name, color");
    for (const st of allStatuses || []) {
      let sq = supabase.from("orders").select("id", { count: "exact", head: true }).eq("status_id", st.id).gte("order_date", startDate).lte("order_date", endDate);
      sq = applyScope(sq, orderFilterIds);
      const { count } = await sq;
      if ((count || 0) > 0) card9.push({ name: st.name, color: st.color, count: count || 0 });
    }
  }

  // ═══ 10. REVENUE BY PLATFORM (period) ═══
  let card10: { name: string; net: number; count: number }[] = [];
  if (revPerm.allowed) {
    let rpq = supabase.from("orders").select("net_amount, platforms:platform_id(name)").gte("order_date", startDate).lte("order_date", endDate);
    rpq = applyScope(rpq, revFilterIds);
    const { data } = await rpq;
    const byPlat: Record<string, { name: string; net: number; count: number }> = {};
    for (const o of data || []) {
      const p: any = Array.isArray(o.platforms) ? o.platforms[0] : o.platforms;
      const n = p?.name || "Unknown";
      if (!byPlat[n]) byPlat[n] = { name: n, net: 0, count: 0 };
      byPlat[n].net += Number(o.net_amount); byPlat[n].count++;
    }
    card10 = Object.values(byPlat);
  }

  // ═══ 11. REVENUE BY PROFILE (period) ═══
  let card11: { name: string; net: number; count: number }[] = [];
  if (revPerm.allowed) {
    let rpfq = supabase.from("orders").select("net_amount, platform_profiles:platform_profile_id(name)").gte("order_date", startDate).lte("order_date", endDate);
    rpfq = applyScope(rpfq, revFilterIds);
    const { data } = await rpfq;
    const byProf: Record<string, { name: string; net: number; count: number }> = {};
    for (const o of data || []) {
      const pp: any = Array.isArray(o.platform_profiles) ? o.platform_profiles[0] : o.platform_profiles;
      const n = pp?.name || "No Profile";
      if (!byProf[n]) byProf[n] = { name: n, net: 0, count: 0 };
      byProf[n].net += Number(o.net_amount); byProf[n].count++;
    }
    card11 = Object.values(byProf).sort((a, b) => b.net - a.net);
  }

  // ═══ 12. EMPLOYEE PERFORMANCE (period) ═══
  let card12: { name: string; companyId: string; net: number; count: number }[] = [];
  if (revPerm.allowed) {
    let epq = supabase.from("orders").select("net_amount, employee:employee_id(name, company_id)").gte("order_date", startDate).lte("order_date", endDate);
    epq = applyScope(epq, revFilterIds);
    const { data } = await epq;
    const byEmp: Record<string, { name: string; companyId: string; net: number; count: number }> = {};
    for (const o of data || []) {
      const emp: any = Array.isArray(o.employee) ? o.employee[0] : o.employee;
      const n = emp?.name || "Unassigned";
      if (!byEmp[n]) byEmp[n] = { name: n, companyId: emp?.company_id || "", net: 0, count: 0 };
      byEmp[n].net += Number(o.net_amount); byEmp[n].count++;
    }
    card12 = Object.values(byEmp).sort((a, b) => b.net - a.net);
  }

  // ═══ 13. SPECIAL ORDERS BY PROFILE (period) ═══
  let card13: { name: string; spent: number; spentLocal: number; count: number }[] = [];
  if (soPerm.allowed) {
    const { data: platforms } = await supabase.from("platforms").select("id, bdt_conversion_rate");
    const rateMap: Record<string, number> = {};
    (platforms || []).forEach(p => { rateMap[p.id] = Number(p.bdt_conversion_rate || 110); });

    const { data } = await supabase.from("special_orders").select("gross_amount, platform_id, platform_profiles:platform_profile_id(name)").gte("order_date", startDate).lte("order_date", endDate);
    const byP: Record<string, { name: string; spent: number; spentLocal: number; count: number }> = {};
    for (const o of data || []) {
      const pp: any = Array.isArray(o.platform_profiles) ? o.platform_profiles[0] : o.platform_profiles;
      const n = pp?.name || "No Profile";
      const usd = Number(o.gross_amount);
      if (!byP[n]) byP[n] = { name: n, spent: 0, spentLocal: 0, count: 0 };
      byP[n].spent += usd;
      byP[n].spentLocal += usd * (rateMap[o.platform_id] || 110);
      byP[n].count++;
    }
    card13 = Object.values(byP).sort((a, b) => b.spent - a.spent);
  }

  // ═══ 14. RECENT ORDERS (not period-dependent) ═══
  let card14: any[] = [];
  if (orderPerm.allowed) {
    let rq = supabase.from("orders").select("id, order_number, client_name, net_amount, created_at, order_statuses:status_id(name, color), platforms:platform_id(name)").order("created_at", { ascending: false }).limit(7);
    rq = applyScope(rq, orderFilterIds);
    const { data } = await rq;
    card14 = data || [];
  }

  // ═══ 15. TOP PERFORMERS (period) ═══
  let card15: { name: string; revenue: number }[] = [];
  if (revPerm.allowed && revPerm.dataScope === "all") {
    const { data } = await supabase.from("orders").select("assigned_to, net_amount, users:assigned_to(name)").gte("order_date", startDate).lte("order_date", endDate).not("assigned_to", "is", null);
    const byUser: Record<string, { name: string; revenue: number }> = {};
    for (const o of data || []) {
      const u: any = Array.isArray(o.users) ? o.users[0] : o.users;
      const uid = o.assigned_to as string;
      if (!byUser[uid]) byUser[uid] = { name: u?.name || "Unknown", revenue: 0 };
      byUser[uid].revenue += Number(o.net_amount);
    }
    card15 = Object.values(byUser).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }

  // ═══ BONUS: Team stats (not period) ═══
  let teamStats = { totalUsers: 0, activeTeams: 0 };
  if (teamPerm.allowed) {
    const { count: uc } = await supabase.from("users").select("id", { count: "exact", head: true }).eq("is_active", true);
    const { count: tc } = await supabase.from("teams").select("id", { count: "exact", head: true }).eq("is_active", true);
    teamStats = { totalUsers: uc || 0, activeTeams: tc || 0 };
  }

  // ═══ BONUS: Avg order value + completion rate (period) ═══
  let bonus = { avgOrderValue: 0, completionRate: 0, totalActive: 0 };
  if (orderPerm.allowed) {
    bonus.avgOrderValue = card1.orderCount > 0 ? card1.totalNet / card1.orderCount : 0;
    const { data: activeStatuses } = await supabase.from("order_statuses").select("id").eq("is_terminal", false);
    const activeIds = (activeStatuses || []).map(s => s.id);
    let aq = supabase.from("orders").select("id", { count: "exact", head: true });
    if (activeIds.length) aq = aq.in("status_id", activeIds);
    aq = applyScope(aq, orderFilterIds);
    const { count: ac } = await aq;
    bonus.totalActive = ac || 0;

    const { data: termStatuses } = await supabase.from("order_statuses").select("id").eq("is_terminal", true);
    const termIds = (termStatuses || []).map(s => s.id);
    const cancelIds = (await supabase.from("order_statuses").select("id").ilike("name", "%cancel%")).data?.map(s => s.id) || [];
    const completedIds = termIds.filter(id => !cancelIds.includes(id));
    if (completedIds.length && card1.orderCount > 0) {
      let cq = supabase.from("orders").select("id", { count: "exact", head: true }).in("status_id", completedIds).gte("order_date", startDate).lte("order_date", endDate);
      cq = applyScope(cq, orderFilterIds);
      const { count: cc } = await cq;
      bonus.completionRate = Math.round(((cc || 0) / card1.orderCount) * 100);
    }
  }

  return NextResponse.json({
    data: {
      orders: card1,
      revenue: card2,
      overdue: card3,
      cancelled: card4,
      targets: card5,
      inventory: card6,
      specialOrders: card7,
      revenueTrend: card8,
      ordersByStatus: card9,
      revenueByPlatform: card10,
      revenueByProfile: card11,
      employeePerformance: card12,
      specialOrdersByProfile: card13,
      recentOrders: card14,
      topPerformers: card15,
      teamStats,
      bonus,
      period: { startDate, endDate, timezone: tz },
    },
  });
}
