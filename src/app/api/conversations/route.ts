export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { z } from "zod";

const createSchema = z.object({
  type: z.enum(["direct", "group"]),
  member_ids: z.array(z.string().uuid()).min(1),
  name: z.string().min(1).optional(),
});

// GET /api/conversations — list user's conversations
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "messages", "view");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Get conversation IDs this user belongs to
  const { data: memberships } = await supabase
    .from("conversation_members")
    .select("conversation_id, last_read_at")
    .eq("user_id", session.user.id);

  if (!memberships || memberships.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const convIds = memberships.map((m) => m.conversation_id);
  const readMap: Record<string, string> = {};
  memberships.forEach((m) => { readMap[m.conversation_id] = m.last_read_at; });

  // Fetch conversations
  const { data: conversations } = await supabase
    .from("conversations")
    .select("*")
    .in("id", convIds)
    .order("updated_at", { ascending: false });

  // For each conversation, get members + last message + unread count
  const result = [];
  for (const conv of conversations || []) {
    // Members
    const { data: members } = await supabase
      .from("conversation_members")
      .select("user_id, users:user_id(id, name, avatar_url, is_active)")
      .eq("conversation_id", conv.id);

    const memberList = (members || []).map((m) => {
      const u = Array.isArray(m.users) ? m.users[0] : m.users;
      return u;
    }).filter(Boolean);

    // Last message
    const { data: lastMsg } = await supabase
      .from("messages")
      .select("id, content, sender_id, created_at, sender:sender_id(name)")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false })
      .limit(1);

    const last = lastMsg?.[0] || null;
    const lastMessage = last ? {
      id: last.id,
      content: last.content,
      sender_id: last.sender_id,
      sender_name: (Array.isArray(last.sender) ? last.sender[0] : last.sender)?.name || "Deleted User",
      created_at: last.created_at,
    } : null;

    // Unread count
    const lastRead = readMap[conv.id] || conv.created_at;
    const { count: unreadCount } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conv.id)
      .gt("created_at", lastRead)
      .neq("sender_id", session.user.id);

    result.push({
      ...conv,
      members: memberList,
      last_message: lastMessage,
      unread_count: unreadCount || 0,
    });
  }

  return NextResponse.json({ data: result });
}

// POST /api/conversations — create direct or group conversation
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "messages", "create");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });

  const { type, member_ids, name } = parsed.data;

  if (type === "direct") {
    if (member_ids.length !== 1) return NextResponse.json({ error: "Direct conversation needs exactly 1 other user" }, { status: 400 });

    const otherUserId = member_ids[0];
    if (otherUserId === session.user.id) return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 });

    // Check if direct conversation already exists between these two users
    const { data: myConvs } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", session.user.id);

    if (myConvs && myConvs.length > 0) {
      const myConvIds = myConvs.map((c) => c.conversation_id);
      const { data: otherConvs } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", otherUserId)
        .in("conversation_id", myConvIds);

      if (otherConvs && otherConvs.length > 0) {
        // Check if any is direct type
        const sharedIds = otherConvs.map((c) => c.conversation_id);
        const { data: existing } = await supabase
          .from("conversations")
          .select("id")
          .in("id", sharedIds)
          .eq("type", "direct")
          .limit(1);

        if (existing && existing.length > 0) {
          return NextResponse.json({ data: { id: existing[0].id, existing: true } });
        }
      }
    }

    // Create new direct conversation
    const { data: conv, error } = await supabase
      .from("conversations")
      .insert({ type: "direct", created_by: session.user.id })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Add both members
    await supabase.from("conversation_members").insert([
      { conversation_id: conv.id, user_id: session.user.id },
      { conversation_id: conv.id, user_id: otherUserId },
    ]);

    return NextResponse.json({ data: { id: conv.id, existing: false } }, { status: 201 });
  }

  // Group conversation — only system admin
  if (session.user.roleLevel !== 0) {
    return NextResponse.json({ error: "Only system admin can create groups" }, { status: 403 });
  }

  if (!name) return NextResponse.json({ error: "Group name required" }, { status: 400 });

  const { data: conv, error } = await supabase
    .from("conversations")
    .insert({ type: "group", name, created_by: session.user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Add all members — creator is group admin
  const allMembers = [...new Set([session.user.id, ...member_ids])];
  await supabase.from("conversation_members").insert(
    allMembers.map((uid) => ({
      conversation_id: conv.id,
      user_id: uid,
      group_role: uid === session.user.id ? "admin" : "member",
    }))
  );

  return NextResponse.json({ data: { id: conv.id, existing: false } }, { status: 201 });
}
