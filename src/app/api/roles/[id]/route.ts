export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { logAudit, getRequestMeta } from "@/lib/audit";
import { z } from "zod";

const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  level: z.number().int().min(0).max(999).optional(),
  permission_ids: z.array(z.string().uuid()).optional(),
});

// GET /api/roles/[id] - Get role with permissions
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perm = await checkPermission(session.user.id, "roles", "view");
  if (!perm.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: role, error } = await supabase
    .from("roles")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !role) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  // Get assigned permission IDs
  const { data: rolePerms } = await supabase
    .from("role_permissions")
    .select("permission_id")
    .eq("role_id", id);

  const permission_ids = rolePerms?.map((rp) => rp.permission_id) || [];

  return NextResponse.json({ data: { ...role, permission_ids } });
}

// PATCH /api/roles/[id] - Update role
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perm = await checkPermission(session.user.id, "roles", "edit");
  if (!perm.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check if system role
  const { data: existing } = await supabase
    .from("roles")
    .select("*")
    .eq("id", id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  if (existing.is_system_role) {
    return NextResponse.json(
      { error: "System roles cannot be modified" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = updateRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, description, level, permission_ids } = parsed.data;

  // Update role fields
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (level !== undefined) updateData.level = level;

  const { data: role, error } = await supabase
    .from("roles")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Role name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update permissions if provided
  if (permission_ids !== undefined) {
    // Delete existing permissions
    await supabase.from("role_permissions").delete().eq("role_id", id);

    // Insert new permissions
    if (permission_ids.length > 0) {
      const rolePerms = permission_ids.map((pid) => ({
        role_id: id,
        permission_id: pid,
      }));
      await supabase.from("role_permissions").insert(rolePerms);
    }
  }

  const meta = getRequestMeta(request);
  await logAudit({
    userId: session.user.id,
    action: "update",
    module: "roles",
    entityType: "role",
    entityId: id,
    oldValues: existing,
    newValues: { ...updateData, permission_count: permission_ids?.length },
    ...meta,
  });

  return NextResponse.json({ data: role });
}

// DELETE /api/roles/[id] - Delete role
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perm = await checkPermission(session.user.id, "roles", "delete");
  if (!perm.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: existing } = await supabase
    .from("roles")
    .select("*")
    .eq("id", id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  if (existing.is_system_role) {
    return NextResponse.json(
      { error: "System roles cannot be deleted" },
      { status: 403 }
    );
  }

  // Check if role is assigned to any users
  const { data: assignments } = await supabase
    .from("user_roles")
    .select("id")
    .eq("role_id", id)
    .limit(1);

  if (assignments && assignments.length > 0) {
    return NextResponse.json(
      { error: "Cannot delete role that is assigned to users. Reassign users first." },
      { status: 400 }
    );
  }

  // Delete role (cascade deletes role_permissions)
  const { error } = await supabase.from("roles").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const meta = getRequestMeta(request);
  await logAudit({
    userId: session.user.id,
    action: "delete",
    module: "roles",
    entityType: "role",
    entityId: id,
    oldValues: existing,
    ...meta,
  });

  return NextResponse.json({ success: true });
}
