export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission, getFilteredUserIds } from "@/lib/permissions";

/* eslint-disable @typescript-eslint/no-explicit-any */

// GET /api/dashboard - Comprehensive dashboard stats
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const today = now.toISOString().split("T")[0];

  // Previous month for comparison
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfPrevMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}-01`;
  const endOfPrevMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  // ═══════════════════════════════════════════════
  // 1. REVENUE STATS
  // ═══════════════════════════════════════════════
  const revPerm = await checkPermission(session.user.id, "revenue", "view");
  let revenue = { monthlyNet: 0, monthlyGross: 0, todayNet: 0, prevMonthNet: 0, monthlyByPlatform: [] as any[], monthlyByProfile: [] as any[], monthlyByEmployee: [] as any[], monthlyTrend: [] as any[] };

  if (revPerm.allowed) {
    const filteredIds = await getFilteredUserIds(revPerm.dataScope, session.user.id);

    // Current month orders
    let monthQ = supabase.from("orders").select("net_amount, gross_amount, platform_id, platforms:platform_id(name), platform_profile_id, platform_profiles:platform_profile_id(name), employee_id, employee:employee_id(name, company_id)").gte("order_date", startOfMonth);
    if (filteredIds) monthQ = monthQ.or(`assigned_to.in.(${filteredIds.join(",")}),created_by.in.(${filteredIds.join(",")})`);
    const { data: monthOrders } = await monthQ;

    // Today
    let todayQ = supabase.from("orders").select("net_amount").eq("order_date", today);
    if (filteredIds) todayQ = todayQ.or(`assigned_to.in.(${filteredIds.join(",")}),created_by.in.(${filteredIds.join(",")})`);
    const { data: todayOrders } = await todayQ;

    // Previous month
    let prevQ = supabase.from("orders").select("net_amount").gte("order_date", startOfPrevMonth).lt("order_date", endOfPrevMonth);
    if (filteredIds) prevQ = prevQ.or(`assigned_to.in.(${filteredIds.join(",")}),created_by.in.(${filteredIds.join(",")})`);
    const { data: prevOrders } = await prevQ;

    revenue.monthlyNet = (monthOrders || []).reduce((s, o) => s + Number(o.net_amount), 0);
    revenue.monthlyGross = (monthOrders || []).reduce((s, o) => s + Number(o.gross_amount), 0);
    revenue.todayNet = (todayOrders || []).reduce((s, o) => s + Number(o.net_amount), 0);
    revenue.prevMonthNet = (prevOrders || []).reduce((s, o) => s + Number(o.net_amount), 0);

    // By platform
    const byPlat: Record<string, { name: string; net: number; count: number }> = {};
    for (const o of monthOrders || []) {
      const p: any = Array.isArray(o.platforms) ? o.platforms[0] : o.platforms;
      const pName = p?.name || "Unknown";
      if (!byPlat[pName]) byPlat[pName] = { name: pName, net: 0, count: 0 };
      byPlat[pName].net += Number(o.net_amount);
      byPlat[pName].count++;
    }
    revenue.monthlyByPlatform = Object.values(byPlat);

    // By profile
    const byProf: Record<string, { name: string; net: number; count: number }> = {};
    for (const o of monthOrders || []) {
      const pp: any = Array.isArray(o.platform_profiles) ? o.platform_profiles[0] : o.platform_profiles;
      const pName = pp?.name || "No Profile";
      if (!byProf[pName]) byProf[pName] = { name: pName, net: 0, count: 0 };
      byProf[pName].net += Number(o.net_amount);
      byProf[pName].count++;
    }
    revenue.monthlyByProfile = Object.values(byProf).sort((a, b) => b.net - a.net);

    // By employee (who got the order)
    const byEmp: Record<string, { name: string; companyId: string; net: number; count: number }> = {};
    for (const o of monthOrders || []) {
      const emp: any = Array.isArray(o.employee) ? o.employee[0] : o.employee;
      const eName = emp?.name || "Unassigned";
      const eId = emp?.company_id || "";
      if (!byEmp[eName]) byEmp[eName] = { name: eName, companyId: eId, net: 0, count: 0 };
      byEmp[eName].net += Number(o.net_amount);
      byEmp[eName].count++;
    }
    revenue.monthlyByEmployee = Object.values(byEmp).sort((a, b) => b.net - a.net);

    // Monthly trend (last 6 months)
    const trend: { month: string; net: number; gross: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      const dEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const mEnd = `${dEnd.getFullYear()}-${String(dEnd.getMonth() + 1).padStart(2, "0")}-01`;
      let tQ = supabase.from("orders").select("net_amount, gross_amount").gte("order_date", mStart).lt("order_date", mEnd);
      if (filteredIds) tQ = tQ.or(`assigned_to.in.(${filteredIds.join(",")}),created_by.in.(${filteredIds.join(",")})`);
      const { data: tData } = await tQ;
      trend.push({
        month: d.toLocaleString("en", { month: "short" }),
        net: (tData || []).reduce((s, o) => s + Number(o.net_amount), 0),
        gross: (tData || []).reduce((s, o) => s + Number(o.gross_amount), 0),
      });
    }
    revenue.monthlyTrend = trend;
  }

  // ═══════════════════════════════════════════════
  // 2. ORDER STATS
  // ═══════════════════════════════════════════════
  const orderPerm = await checkPermission(session.user.id, "orders", "view");
  let orders = { active: 0, total: 0, overdue: 0, completedThisMonth: 0, byStatus: [] as any[] };

  if (orderPerm.allowed) {
    const filteredIds = await getFilteredUserIds(orderPerm.dataScope, session.user.id);
    const { data: allStatuses } = await supabase.from("order_statuses").select("id, name, color, is_terminal");
    const activeStatusIds = (allStatuses || []).filter(s => !s.is_terminal).map(s => s.id);
    const terminalIds = (allStatuses || []).filter(s => s.is_terminal).map(s => s.id);

    let activeQ = supabase.from("orders").select("id", { count: "exact", head: true });
    if (activeStatusIds.length) activeQ = activeQ.in("status_id", activeStatusIds);
    if (filteredIds) activeQ = activeQ.or(`assigned_to.in.(${filteredIds.join(",")}),created_by.in.(${filteredIds.join(",")})`);
    const { count: activeCount } = await activeQ;

    let totalQ = supabase.from("orders").select("id", { count: "exact", head: true });
    if (filteredIds) totalQ = totalQ.or(`assigned_to.in.(${filteredIds.join(",")}),created_by.in.(${filteredIds.join(",")})`);
    const { count: totalCount } = await totalQ;

    let overdueQ = supabase.from("orders").select("id", { count: "exact", head: true }).lt("deadline", now.toISOString()).not("deadline", "is", null);
    if (activeStatusIds.length) overdueQ = overdueQ.in("status_id", activeStatusIds);
    if (filteredIds) overdueQ = overdueQ.or(`assigned_to.in.(${filteredIds.join(",")}),created_by.in.(${filteredIds.join(",")})`);
    const { count: overdueCount } = await overdueQ;

    let compQ = supabase.from("orders").select("id", { count: "exact", head: true }).gte("updated_at", startOfMonth);
    if (terminalIds.length) compQ = compQ.in("status_id", terminalIds);
    if (filteredIds) compQ = compQ.or(`assigned_to.in.(${filteredIds.join(",")}),created_by.in.(${filteredIds.join(",")})`);
    const { count: compCount } = await compQ;

    orders = { active: activeCount || 0, total: totalCount || 0, overdue: overdueCount || 0, completedThisMonth: compCount || 0, byStatus: [] };

    // By status distribution
    for (const st of allStatuses || []) {
      let stQ = supabase.from("orders").select("id", { count: "exact", head: true }).eq("status_id", st.id);
      if (filteredIds) stQ = stQ.or(`assigned_to.in.(${filteredIds.join(",")}),created_by.in.(${filteredIds.join(",")})`);
      const { count } = await stQ;
      if ((count || 0) > 0) orders.byStatus.push({ name: st.name, color: st.color, count: count || 0 });
    }
  }

  // ═══════════════════════════════════════════════
  // 3. TEAM & USER STATS
  // ═══════════════════════════════════════════════
  const teamPerm = await checkPermission(session.user.id, "teams", "view");
  let teamStats = { totalUsers: 0, activeTeams: 0 };
  if (teamPerm.allowed) {
    const { count: uc } = await supabase.from("users").select("id", { count: "exact", head: true }).eq("is_active", true);
    const { count: tc } = await supabase.from("teams").select("id", { count: "exact", head: true }).eq("is_active", true);
    teamStats = { totalUsers: uc || 0, activeTeams: tc || 0 };
  }

  // ═══════════════════════════════════════════════
  // 4. RECENT ORDERS
  // ═══════════════════════════════════════════════
  let recentOrders: any[] = [];
  if (orderPerm.allowed) {
    const filteredIds = await getFilteredUserIds(orderPerm.dataScope, session.user.id);
    let recentQ = supabase.from("orders").select("id, order_number, client_name, net_amount, created_at, order_statuses:status_id(name, color), platforms:platform_id(name)").order("created_at", { ascending: false }).limit(5);
    if (filteredIds) recentQ = recentQ.or(`assigned_to.in.(${filteredIds.join(",")}),created_by.in.(${filteredIds.join(",")})`);
    const { data } = await recentQ;
    recentOrders = data || [];
  }

  // ═══════════════════════════════════════════════
  // 5. TOP PERFORMERS
  // ═══════════════════════════════════════════════
  let topPerformers: { name: string; revenue: number }[] = [];
  if (revPerm.allowed && revPerm.dataScope === "all") {
    const { data: mp } = await supabase.from("orders").select("assigned_to, net_amount, users:assigned_to(name)").gte("order_date", startOfMonth).not("assigned_to", "is", null);
    const byUser: Record<string, { name: string; revenue: number }> = {};
    for (const o of mp || []) {
      const u: any = Array.isArray(o.users) ? o.users[0] : o.users;
      const uid = o.assigned_to as string;
      if (!byUser[uid]) byUser[uid] = { name: u?.name || "Unknown", revenue: 0 };
      byUser[uid].revenue += Number(o.net_amount);
    }
    topPerformers = Object.values(byUser).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }

  // ═══════════════════════════════════════════════
  // 6. SPECIAL ORDERS
  // ═══════════════════════════════════════════════
  const soPerm = await checkPermission(session.user.id, "special-orders", "view");
  let specialOrders = { totalSpent: 0, count: 0, monthlySpent: 0, byProfile: [] as any[] };
  if (soPerm.allowed) {
    const { data: allSO } = await supabase.from("special_orders").select("gross_amount");
    const { data: monthSO } = await supabase.from("special_orders").select("gross_amount, platform_profiles:platform_profile_id(name)").gte("order_date", startOfMonth);
    specialOrders.totalSpent = (allSO || []).reduce((s, o) => s + Number(o.gross_amount), 0);
    specialOrders.count = (allSO || []).length;
    specialOrders.monthlySpent = (monthSO || []).reduce((s, o) => s + Number(o.gross_amount), 0);
    const byP: Record<string, { name: string; spent: number; count: number }> = {};
    for (const o of monthSO || []) {
      const pp: any = Array.isArray(o.platform_profiles) ? o.platform_profiles[0] : o.platform_profiles;
      const n = pp?.name || "No Profile";
      if (!byP[n]) byP[n] = { name: n, spent: 0, count: 0 };
      byP[n].spent += Number(o.gross_amount);
      byP[n].count++;
    }
    specialOrders.byProfile = Object.values(byP).sort((a, b) => b.spent - a.spent);
  }

  // ═══════════════════════════════════════════════
  // 7. TARGETS
  // ═══════════════════════════════════════════════
  const targetPerm = await checkPermission(session.user.id, "targets", "view");
  let targets = { totalTarget: 0, totalAchieved: 0, achievementRate: 0 };
  if (targetPerm.allowed) {
    const { data: monthTargets } = await supabase.from("targets").select("target_amount, user_id").eq("period_type", "monthly").gte("period_start", startOfMonth);
    const totalTarget = (monthTargets || []).reduce((s, t) => s + Number(t.target_amount), 0);
    // Calculate achieved from orders
    let achieved = 0;
    for (const t of monthTargets || []) {
      const { data: userOrders } = await supabase.from("orders").select("net_amount").eq("assigned_to", t.user_id).gte("order_date", startOfMonth);
      achieved += (userOrders || []).reduce((s, o) => s + Number(o.net_amount), 0);
    }
    targets = { totalTarget, totalAchieved: achieved, achievementRate: totalTarget > 0 ? Math.round((achieved / totalTarget) * 100) : 0 };
  }

  // ═══════════════════════════════════════════════
  // 8. INVENTORY
  // ═══════════════════════════════════════════════
  const invPerm = await checkPermission(session.user.id, "inventory", "view");
  let inventory = { totalItems: 0, totalValue: 0, activeItems: 0 };
  if (invPerm.allowed) {
    const { data: items } = await supabase.from("tech_inventory").select("cost, status");
    inventory.totalItems = (items || []).length;
    inventory.activeItems = (items || []).filter(i => i.status === "active").length;
    inventory.totalValue = (items || []).reduce((s, i) => s + Number(i.cost || 0), 0);
  }

  return NextResponse.json({
    data: { revenue, orders, teamStats, recentOrders, topPerformers, specialOrders, targets, inventory },
  });
}
