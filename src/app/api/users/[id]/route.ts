export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { logAudit, getRequestMeta } from "@/lib/audit";
import { notifyRoleChanged } from "@/lib/notifications";
import bcrypt from "bcryptjs";
import { z } from "zod";

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role_id: z.string().uuid().optional(),
  department_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
});

// GET /api/users/[id] - Get single user
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perm = await checkPermission(session.user.id, "users", "view");
  if (!perm.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: user, error } = await supabase
    .from("users")
    .select(`*, user_roles!user_roles_user_id_fkey(role_id, roles:role_id(id, name, level))`)
    .eq("id", id)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { password_hash, ...cleanUser } = user;

  // Get teams
  const { data: teamMemberships } = await supabase
    .from("team_members")
    .select(`team_id, teams:team_id(id, name, type)`)
    .eq("user_id", id);

  return NextResponse.json({
    data: { ...cleanUser, teams: teamMemberships || [] },
  });
}

// PATCH /api/users/[id] - Update user
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perm = await checkPermission(session.user.id, "users", "edit");
  if (!perm.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Get existing user for audit
  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { name, email, password, role_id, department_id, is_active } = parsed.data;

  // Build update
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email;
  if (password) updateData.password_hash = await bcrypt.hash(password, 12);
  if (department_id !== undefined) updateData.department_id = department_id;
  if (is_active !== undefined) updateData.is_active = is_active;

  const { data: user, error } = await supabase
    .from("users")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update role if changed
  if (role_id) {
    const { data: currentRole } = await supabase
      .from("user_roles")
      .select("role_id")
      .eq("user_id", id)
      .single();

    if (currentRole?.role_id !== role_id) {
      await supabase
        .from("user_roles")
        .upsert(
          { user_id: id, role_id, assigned_by: session.user.id, assigned_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );

      // Get new role name for notification
      const { data: newRole } = await supabase
        .from("roles")
        .select("name")
        .eq("id", role_id)
        .single();

      if (newRole) {
        await notifyRoleChanged(id, newRole.name);
      }
    }
  }

  const meta = getRequestMeta(request);
  await logAudit({
    userId: session.user.id,
    action: "update",
    module: "users",
    entityType: "user",
    entityId: id,
    oldValues: { name: existing.name, email: existing.email, is_active: existing.is_active },
    newValues: { name, email, is_active, role_id },
    ...meta,
  });

  const { password_hash, ...cleanUser } = user;
  return NextResponse.json({ data: cleanUser });
}

// DELETE /api/users/[id] - Delete (deactivate) user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perm = await checkPermission(session.user.id, "users", "delete");
  if (!perm.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Don't allow deleting yourself
  if (id === session.user.id) {
    return NextResponse.json(
      { error: "Cannot delete your own account" },
      { status: 400 }
    );
  }

  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Soft delete - deactivate instead of hard delete
  const { error } = await supabase
    .from("users")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const meta = getRequestMeta(request);
  await logAudit({
    userId: session.user.id,
    action: "delete",
    module: "users",
    entityType: "user",
    entityId: id,
    oldValues: { name: existing.name, email: existing.email },
    ...meta,
  });

  return NextResponse.json({ success: true });
}
