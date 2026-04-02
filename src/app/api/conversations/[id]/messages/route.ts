export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { s3Client, S3_BUCKET, getFileUrl } from "@/lib/s3";
import { sendEvent } from "@/lib/sse";
import { PutObjectCommand } from "@aws-sdk/client-s3";

// GET /api/conversations/[id]/messages — paginated messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify membership
  const { data: membership } = await supabase
    .from("conversation_members")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("user_id", session.user.id)
    .single();

  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const cursor = sp.get("cursor") || "";
  const limit = parseInt(sp.get("limit") || "50");

  let query = supabase
    .from("messages")
    .select(`
      id, conversation_id, sender_id, content, has_attachment, created_at,
      sender:sender_id(id, name, avatar_url, is_active),
      message_attachments(id, file_name, file_url, file_size, mime_type)
    `)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: messages, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Normalize sender
  const normalized = (messages || []).map((m) => ({
    ...m,
    sender: Array.isArray(m.sender) ? m.sender[0] : m.sender,
    message_attachments: m.message_attachments || [],
  }));

  return NextResponse.json({
    data: normalized,
    hasMore: (messages || []).length === limit,
  });
}

// POST /api/conversations/[id]/messages — send message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify membership
  const { data: membership } = await supabase
    .from("conversation_members")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("user_id", session.user.id)
    .single();

  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  // Parse multipart or JSON
  const contentType = request.headers.get("content-type") || "";
  let content: string | null = null;
  let file: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    content = formData.get("content") as string | null;
    file = formData.get("file") as File | null;
  } else {
    const body = await request.json();
    content = body.content || null;
  }

  if (!content && !file) {
    return NextResponse.json({ error: "Message or file required" }, { status: 400 });
  }

  // Create message
  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: session.user.id,
      content: content || null,
      has_attachment: !!file,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Upload attachment if present
  let attachment = null;
  if (file) {
    const key = `messages/${conversationId}/${Date.now()}-${file.name}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type || "application/octet-stream",
      }));

      const fileUrl = getFileUrl(key);
      const { data: att } = await supabase
        .from("message_attachments")
        .insert({
          message_id: message.id,
          file_name: file.name,
          file_key: key,
          file_url: fileUrl,
          file_size: file.size,
          mime_type: file.type || "application/octet-stream",
        })
        .select()
        .single();

      attachment = att;
    } catch (err) {
      console.error("Message file upload error:", err);
    }
  }

  // Update conversation timestamp
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  // SSE notify all other members
  const { data: members } = await supabase
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .neq("user_id", session.user.id);

  for (const m of members || []) {
    sendEvent(m.user_id, "new-message", {
      conversationId,
      messageId: message.id,
      senderId: session.user.id,
      senderName: session.user.name,
      preview: content?.substring(0, 50) || (file ? `📎 ${file.name}` : ""),
    });
  }

  return NextResponse.json({
    data: {
      ...message,
      sender: { id: session.user.id, name: session.user.name, avatar_url: null },
      message_attachments: attachment ? [attachment] : [],
    },
  }, { status: 201 });
}
