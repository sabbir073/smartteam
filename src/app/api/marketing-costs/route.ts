export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { logAudit, getRequestMeta } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({
  order_id: z.string().uuid().optional().nullable(),
  amount: z.number().positive(),
  description: z.string().optional(),
  cost_date: z.string().optional(),
});

// GET /api/marketing-costs
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "revenue", "view");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const page = parseInt(sp.get("page") || "1");
  const pageSize = parseInt(sp.get("pageSize") || "20");

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("marketing_costs")
    .select(`*, orders:order_id(id, order_number, client_name), added_by_user:added_by(id, name)`, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, total: count || 0, page, pageSize, totalPages: Math.ceil((count || 0) / pageSize) });
}

// POST /api/marketing-costs
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check if user's role is allowed to enter costs
  const { data: settings } = await supabase.from("revenue_settings").select("cost_entry_role_ids").limit(1).single();
  const allowedRoles = (settings?.cost_entry_role_ids || []) as string[];

  // Also check general revenue edit permission
  const perm = await checkPermission(session.user.id, "revenue", "create");
  if (!perm.allowed && !allowedRoles.includes(session.user.roleId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await supabase
    .from("marketing_costs")
    .insert({ ...parsed.data, added_by: session.user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const meta = getRequestMeta(request);
  await logAudit({ userId: session.user.id, action: "create", module: "revenue", entityType: "marketing_cost", entityId: data.id, newValues: parsed.data, ...meta });

  return NextResponse.json({ data }, { status: 201 });
}
