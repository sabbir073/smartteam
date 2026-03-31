export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { logAudit, getRequestMeta } from "@/lib/audit";
import { z } from "zod";

const updateSchema = z.object({
  platform_id: z.string().uuid().optional(),
  name: z.string().min(1).max(100).optional(),
  profile_url: z.string().url().optional().or(z.literal("")).nullable(),
  description: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});

// GET /api/platform-profiles/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("platform_profiles")
    .select("*, platforms:platform_id(id, name)")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data });
}

// PATCH /api/platform-profiles/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "profiles", "edit");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const d = parsed.data;
  if (d.platform_id !== undefined) update.platform_id = d.platform_id;
  if (d.name !== undefined) update.name = d.name;
  if (d.profile_url !== undefined) update.profile_url = d.profile_url || null;
  if (d.description !== undefined) update.description = d.description || null;
  if (d.is_active !== undefined) update.is_active = d.is_active;

  const { data: profile, error } = await supabase
    .from("platform_profiles")
    .update(update)
    .eq("id", id)
    .select("*, platforms:platform_id(id, name)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const meta = getRequestMeta(request);
  await logAudit({
    userId: session.user.id, action: "update", module: "profiles",
    entityType: "platform_profile", entityId: id,
    newValues: update, ...meta,
  });

  return NextResponse.json({ data: profile });
}

// DELETE /api/platform-profiles/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "profiles", "delete");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabase.from("platform_profiles").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const meta = getRequestMeta(request);
  await logAudit({
    userId: session.user.id, action: "delete", module: "profiles",
    entityType: "platform_profile", entityId: id, ...meta,
  });

  return NextResponse.json({ success: true });
}
