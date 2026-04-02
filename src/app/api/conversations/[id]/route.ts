export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  add_members: z.array(z.string().uuid()).optional(),
  remove_members: z.array(z.string().uuid()).optional(),
  promote_to_admin: z.array(z.string().uuid()).optional(),
  demote_to_member: z.array(z.string().uuid()).optional(),
});

// Helper: check if user is system admin or group admin
async function canManageGroup(userId: string, conversationId: string, roleLevel: number): Promise<boolean> {
  if (roleLevel === 0) return true; // system admin
  const { data } = await supabase
    .from("conversation_members")
    .select("group_role")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .single();
  return data?.group_role === "admin";
}

// GET /api/conversations/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify membership
  const { data: membership } = await supabase
    .from("conversation_members")
    .select("id")
    .eq("conversation_id", id)
    .eq("user_id", session.user.id)
    .single();

  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const { data: conv } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .single();

  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: members } = await supabase
    .from("conversation_members")
    .select("user_id, last_read_at, joined_at, group_role, users:user_id(id, name, email, avatar_url, is_active, company_id)")
    .eq("conversation_id", id);

  const memberList = (members || []).map((m) => {
    const u = Array.isArray(m.users) ? m.users[0] : m.users;
    return { ...u, group_role: m.group_role, last_read_at: m.last_read_at, joined_at: m.joined_at };
  });

  return NextResponse.json({ data: { ...conv, members: memberList } });
}

// PATCH /api/conversations/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: conv } = await supabase.from("conversations").select("type").eq("id", id).single();
  if (!conv || conv.type !== "group") return NextResponse.json({ error: "Not a group conversation" }, { status: 400 });

  const allowed = await canManageGroup(session.user.id, id, session.user.roleLevel);
  if (!allowed) return NextResponse.json({ error: "Only system admin or group admin can manage" }, { status: 403 });

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const { name, add_members, remove_members, promote_to_admin, demote_to_member } = parsed.data;

  if (name) {
    await supabase.from("conversations").update({ name, updated_at: new Date().toISOString() }).eq("id", id);
  }

  if (add_members && add_members.length > 0) {
    await supabase.from("conversation_members").upsert(
      add_members.map((uid) => ({ conversation_id: id, user_id: uid, group_role: "member" })),
      { onConflict: "conversation_id,user_id" }
    );
  }

  // Remove members — only system admin can remove
  if (remove_members && remove_members.length > 0) {
    if (session.user.roleLevel !== 0) {
      // Group admin can also remove regular members but not other admins
      for (const uid of remove_members) {
        const { data: target } = await supabase
          .from("conversation_members")
          .select("group_role")
          .eq("conversation_id", id)
          .eq("user_id", uid)
          .single();
        if (target?.group_role === "admin" && session.user.roleLevel !== 0) continue; // skip admin removal by non-system-admin
        await supabase.from("conversation_members").delete().eq("conversation_id", id).eq("user_id", uid);
      }
    } else {
      for (const uid of remove_members) {
        await supabase.from("conversation_members").delete().eq("conversation_id", id).eq("user_id", uid);
      }
    }
  }

  // Promote to group admin — only system admin
  if (promote_to_admin && promote_to_admin.length > 0 && session.user.roleLevel === 0) {
    for (const uid of promote_to_admin) {
      await supabase.from("conversation_members").update({ group_role: "admin" }).eq("conversation_id", id).eq("user_id", uid);
    }
  }

  // Demote to member — only system admin
  if (demote_to_member && demote_to_member.length > 0 && session.user.roleLevel === 0) {
    for (const uid of demote_to_member) {
      await supabase.from("conversation_members").update({ group_role: "member" }).eq("conversation_id", id).eq("user_id", uid);
    }
  }

  return NextResponse.json({ success: true });
}
