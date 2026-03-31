export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { logAudit, getRequestMeta } from "@/lib/audit";
import { z } from "zod";

const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  level: z.number().int().min(0).max(999),
  permission_ids: z.array(z.string().uuid()).optional(),
});

// GET /api/roles - List all roles
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perm = await checkPermission(session.user.id, "roles", "view");
  if (!perm.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: roles, error } = await supabase
    .from("roles")
    .select("*")
    .order("level", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get permission count for each role
  const { data: permCounts } = await supabase
    .from("role_permissions")
    .select("role_id");

  const countMap: Record<string, number> = {};
  permCounts?.forEach((rp) => {
    countMap[rp.role_id] = (countMap[rp.role_id] || 0) + 1;
  });

  // Get user count for each role
  const { data: userCounts } = await supabase
    .from("user_roles")
    .select("role_id");

  const userCountMap: Record<string, number> = {};
  userCounts?.forEach((ur) => {
    userCountMap[ur.role_id] = (userCountMap[ur.role_id] || 0) + 1;
  });

  const rolesWithCounts = roles?.map((role) => ({
    ...role,
    permission_count: countMap[role.id] || 0,
    user_count: userCountMap[role.id] || 0,
  }));

  return NextResponse.json({ data: rolesWithCounts });
}

// POST /api/roles - Create a new role
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perm = await checkPermission(session.user.id, "roles", "create");
  if (!perm.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, description, level, permission_ids } = parsed.data;

  // Create role
  const { data: role, error } = await supabase
    .from("roles")
    .insert({ name, description: description || null, level })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Role name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Assign permissions if provided
  if (permission_ids && permission_ids.length > 0) {
    const rolePerms = permission_ids.map((pid) => ({
      role_id: role.id,
      permission_id: pid,
    }));

    await supabase.from("role_permissions").insert(rolePerms);
  }

  const meta = getRequestMeta(request);
  await logAudit({
    userId: session.user.id,
    action: "create",
    module: "roles",
    entityType: "role",
    entityId: role.id,
    newValues: { name, level, permission_count: permission_ids?.length || 0 },
    ...meta,
  });

  return NextResponse.json({ data: role }, { status: 201 });
}
