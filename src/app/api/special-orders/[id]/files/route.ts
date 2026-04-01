export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { s3Client, S3_BUCKET, initiateMultipartUpload, completeMultipartUpload, abortMultipartUpload, deleteFromS3, getFileUrl } from "@/lib/s3";
import { UploadPartCommand } from "@aws-sdk/client-s3";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const CHUNK_SIZE = 4 * 1024 * 1024;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "special-orders", "edit");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: order } = await supabase.from("special_orders").select("id").eq("id", id).single();
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "File exceeds 50MB" }, { status: 400 });

  const key = `special-orders/${id}/${Date.now()}-${file.name}`;
  const contentType = file.type || "application/octet-stream";

  try {
    let fileUrl: string;
    if (file.size > CHUNK_SIZE) {
      const partCount = Math.ceil(file.size / CHUNK_SIZE);
      const { uploadId, fileUrl: fUrl } = await initiateMultipartUpload(key, contentType, partCount);
      fileUrl = fUrl;
      const buffer = Buffer.from(await file.arrayBuffer());
      const parts: { ETag: string; PartNumber: number }[] = [];
      try {
        for (let i = 0; i < partCount; i++) {
          const chunk = buffer.subarray(i * CHUNK_SIZE, Math.min((i + 1) * CHUNK_SIZE, file.size));
          const res = await s3Client.send(new UploadPartCommand({ Bucket: S3_BUCKET, Key: key, UploadId: uploadId, PartNumber: i + 1, Body: chunk }));
          parts.push({ ETag: res.ETag!, PartNumber: i + 1 });
        }
        await completeMultipartUpload(key, uploadId, parts);
      } catch (err) { await abortMultipartUpload(key, uploadId).catch(() => {}); throw err; }
    } else {
      const { PutObjectCommand } = await import("@aws-sdk/client-s3");
      await s3Client.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: Buffer.from(await file.arrayBuffer()), ContentType: contentType }));
      fileUrl = getFileUrl(key);
    }

    const { data: record, error } = await supabase.from("special_order_files").insert({
      special_order_id: id, file_name: file.name, file_key: key, file_url: fileUrl,
      file_size: file.size, mime_type: contentType, uploaded_by: session.user.id,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: record }, { status: 201 });
  } catch { return NextResponse.json({ error: "Upload failed" }, { status: 500 }); }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const fileId = request.nextUrl.searchParams.get("file_id");
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "special-orders", "edit");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!fileId) return NextResponse.json({ error: "file_id required" }, { status: 400 });

  const { data: file } = await supabase.from("special_order_files").select("*").eq("id", fileId).eq("special_order_id", id).single();
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try { await deleteFromS3(file.file_key); } catch {}
  await supabase.from("special_order_files").delete().eq("id", fileId);

  return NextResponse.json({ success: true });
}
