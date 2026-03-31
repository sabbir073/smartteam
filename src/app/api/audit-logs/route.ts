export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";

// GET /api/audit-logs
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "audit-logs", "view");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const page = parseInt(sp.get("page") || "1");
  const pageSize = parseInt(sp.get("pageSize") || "30");
  const module = sp.get("module") || "";
  const action = sp.get("action") || "";
  const userId = sp.get("user_id") || "";
  const startDate = sp.get("start_date") || "";
  const endDate = sp.get("end_date") || "";

  let query = supabase
    .from("audit_logs")
    .select(`*, users:user_id(id, name, email)`, { count: "exact" })
    .order("created_at", { ascending: false });

  if (module) query = query.eq("module", module);
  if (action) query = query.eq("action", action);
  if (userId) query = query.eq("user_id", userId);
  if (startDate) query = query.gte("created_at", startDate);
  if (endDate) query = query.lte("created_at", `${endDate}T23:59:59`);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query.range(from, to);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, total: count || 0, page, pageSize, totalPages: Math.ceil((count || 0) / pageSize) });
}
