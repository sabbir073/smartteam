export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { s3Client, S3_BUCKET, deleteFromS3 } from "@/lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Allow self-upload or users with edit permission
  if (session.user.id !== userId) {
    const perm = await checkPermission(session.user.id, "users", "edit");
    if (!perm.allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "File exceeds 5MB limit" }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only JPG, PNG, WebP, GIF allowed" }, { status: 400 });
  }

  // Get current avatar to delete old one
  const { data: user } = await supabase
    .from("users")
    .select("avatar_url")
    .eq("id", userId)
    .single();

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const ext = file.name.split(".").pop() || "jpg";
  const key = `avatars/${userId}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      })
    );

    const avatarUrl = `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    // Update user record
    const { error: updateErr } = await supabase
      .from("users")
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Delete old avatar from S3 if exists
    if (user.avatar_url) {
      try {
        const oldKey = new URL(user.avatar_url).pathname.slice(1);
        await deleteFromS3(oldKey);
      } catch {}
    }

    return NextResponse.json({ data: { avatar_url: avatarUrl } });
  } catch (err) {
    console.error("Avatar upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
