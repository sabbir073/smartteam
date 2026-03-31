export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { logAudit, getRequestMeta } from "@/lib/audit";
import { z } from "zod";

const deptSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  parent_department_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
});

// GET /api/departments
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("departments")
    .select("*")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// POST /api/departments
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perm = await checkPermission(session.user.id, "settings", "create");
  if (!perm.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = deptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("departments")
    .insert(parsed.data)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const meta = getRequestMeta(request);
  await logAudit({
    userId: session.user.id,
    action: "create",
    module: "settings",
    entityType: "department",
    entityId: data.id,
    newValues: parsed.data,
    ...meta,
  });

  return NextResponse.json({ data }, { status: 201 });
}
