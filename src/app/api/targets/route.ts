export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission, getFilteredUserIds } from "@/lib/permissions";
import { logAudit, getRequestMeta } from "@/lib/audit";
import { notifyTargetSet } from "@/lib/notifications";
import { z } from "zod";

const schema = z.object({
  user_id: z.string().uuid(),
  period_type: z.enum(["monthly", "quarterly", "yearly"]),
  period_start: z.string(),
  period_end: z.string(),
  target_amount: z.number().positive(),
});

// GET /api/targets
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "targets", "view");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const periodType = sp.get("period_type") || "";
  const userId = sp.get("user_id") || "";

  let query = supabase
    .from("targets")
    .select(`*, users:user_id(id, name, email, avatar_url)`)
    .order("period_start", { ascending: false });

  // Data scope
  const filteredIds = await getFilteredUserIds(perm.dataScope, session.user.id);
  if (filteredIds) query = query.in("user_id", filteredIds);

  if (periodType) query = query.eq("period_type", periodType);
  if (userId) query = query.eq("user_id", userId);

  const { data: targets, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Calculate achieved amounts from orders
  const enriched = await Promise.all((targets || []).map(async (target) => {
    const { data: orders } = await supabase
      .from("orders")
      .select("net_amount")
      .eq("assigned_to", target.user_id)
      .gte("order_date", target.period_start)
      .lte("order_date", target.period_end);

    const achieved = (orders || []).reduce((s, o) => s + Number(o.net_amount), 0);
    const gap = Number(target.target_amount) - achieved;
    const percentage = Number(target.target_amount) > 0 ? (achieved / Number(target.target_amount)) * 100 : 0;

    return {
      ...target,
      achieved_amount: Math.round(achieved * 100) / 100,
      gap: Math.round(gap * 100) / 100,
      achievement_percentage: Math.round(percentage * 10) / 10,
    };
  }));

  return NextResponse.json({ data: enriched });
}

// POST /api/targets
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "targets", "create");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await supabase
    .from("targets")
    .insert({ ...parsed.data, set_by: session.user.id })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Target already exists for this user and period" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await notifyTargetSet(parsed.data.user_id, parsed.data.target_amount, parsed.data.period_type);

  const meta = getRequestMeta(request);
  await logAudit({ userId: session.user.id, action: "create", module: "targets", entityType: "target", entityId: data.id, newValues: parsed.data, ...meta });

  return NextResponse.json({ data }, { status: 201 });
}
