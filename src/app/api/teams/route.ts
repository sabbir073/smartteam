export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { logAudit, getRequestMeta } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["sales", "operations"]),
  service_category_id: z.string().uuid().optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  leader_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
});

// GET /api/teams
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "teams", "view");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("teams")
    .select(`
      *,
      service_categories:service_category_id(id, name),
      departments:department_id(id, name),
      leader:leader_id(id, name, email, avatar_url),
      team_members(id, user_id, users:user_id(id, name, email, avatar_url))
    `)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

// POST /api/teams
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "teams", "create");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await supabase.from("teams").insert(parsed.data).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const meta = getRequestMeta(request);
  await logAudit({ userId: session.user.id, action: "create", module: "teams", entityType: "team", entityId: data.id, newValues: parsed.data, ...meta });

  return NextResponse.json({ data }, { status: 201 });
}
