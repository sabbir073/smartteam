export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { logAudit, getRequestMeta } from "@/lib/audit";
import { z } from "zod";

const addMemberSchema = z.object({
  user_id: z.string().uuid(),
});

// POST /api/teams/[id]/members - Add member to team
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: teamId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "teams", "edit");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = addMemberSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const { data, error } = await supabase
    .from("team_members")
    .insert({ team_id: teamId, user_id: parsed.data.user_id })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "User already in this team" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const meta = getRequestMeta(request);
  await logAudit({ userId: session.user.id, action: "assign", module: "teams", entityType: "team_member", entityId: data.id, newValues: { team_id: teamId, user_id: parsed.data.user_id }, ...meta });

  return NextResponse.json({ data }, { status: 201 });
}

// DELETE /api/teams/[id]/members - Remove member (user_id in query)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: teamId } = await params;
  const userId = request.nextUrl.searchParams.get("user_id");

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "teams", "edit");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const meta = getRequestMeta(request);
  await logAudit({ userId: session.user.id, action: "delete", module: "teams", entityType: "team_member", oldValues: { team_id: teamId, user_id: userId }, ...meta });

  return NextResponse.json({ success: true });
}
