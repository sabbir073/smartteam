export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { logAudit, getRequestMeta } from "@/lib/audit";
import { notifyRequisitionSubmitted } from "@/lib/notifications";
import { z } from "zod";

const schema = z.object({
  item_description: z.string().min(1),
  purpose: z.string().min(1),
  estimated_cost: z.number().positive().optional(),
  urgency: z.enum(["low", "medium", "high", "critical"]).optional(),
});

// GET /api/requisitions
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "requisitions", "view");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const status = request.nextUrl.searchParams.get("status") || "";

  let query = supabase
    .from("tech_requisitions")
    .select(`*, requester:requester_id(id, name, email), reviewer:reviewer_id(id, name)`)
    .order("created_at", { ascending: false });

  // Data scope: own = only their requests
  if (perm.dataScope === "own") query = query.eq("requester_id", session.user.id);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

// POST /api/requisitions
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "requisitions", "create");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await supabase
    .from("tech_requisitions")
    .insert({ ...parsed.data, requester_id: session.user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify users with requisition review permission
  const { data: reviewPerms } = await supabase
    .from("permissions")
    .select("id")
    .eq("module", "requisitions")
    .eq("action", "edit")
    .eq("data_scope", "all");

  if (reviewPerms && reviewPerms.length > 0) {
    const permIds = reviewPerms.map((p) => p.id);
    const { data: rolePerms } = await supabase
      .from("role_permissions")
      .select("role_id")
      .in("permission_id", permIds);

    if (rolePerms) {
      const roleIds = [...new Set(rolePerms.map((rp) => rp.role_id))];
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role_id", roleIds);

      const reviewerIds = (userRoles || []).map((ur) => ur.user_id).filter((id) => id !== session.user.id);
      await notifyRequisitionSubmitted(reviewerIds, session.user.name, parsed.data.item_description, data.id);
    }
  }

  const meta = getRequestMeta(request);
  await logAudit({ userId: session.user.id, action: "create", module: "requisitions", entityType: "tech_requisition", entityId: data.id, newValues: parsed.data, ...meta });

  return NextResponse.json({ data }, { status: 201 });
}
