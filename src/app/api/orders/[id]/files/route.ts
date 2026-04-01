export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import {
  s3Client, S3_BUCKET,
  initiateMultipartUpload,
  completeMultipartUpload,
  abortMultipartUpload,
  deleteFromS3,
  getFileUrl,
} from "@/lib/s3";
import { UploadPartCommand } from "@aws-sdk/client-s3";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB per chunk (under Vercel 4.5MB limit)

// POST /api/orders/[id]/files
// Accepts: multipart/form-data with a "file" field
// Uses AWS S3 multipart upload to handle large files
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "orders", "edit");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: order } = await supabase.from("orders").select("id").eq("id", orderId).single();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "File exceeds 50MB limit" }, { status: 400 });

  const timestamp = Date.now();
  const key = `orders/${orderId}/${timestamp}-${file.name}`;
  const contentType = file.type || "application/octet-stream";

  try {
    let fileUrl: string;

    if (file.size > CHUNK_SIZE) {
      // AWS Multipart Upload for files > 4MB
      const partCount = Math.ceil(file.size / CHUNK_SIZE);
      const { uploadId, fileUrl: fUrl } = await initiateMultipartUpload(key, contentType, partCount);
      fileUrl = fUrl;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const parts: { ETag: string; PartNumber: number }[] = [];

      try {
        for (let i = 0; i < partCount; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = buffer.subarray(start, end);

          const uploadRes = await s3Client.send(
            new UploadPartCommand({
              Bucket: S3_BUCKET,
              Key: key,
              UploadId: uploadId,
              PartNumber: i + 1,
              Body: chunk,
            })
          );

          parts.push({ ETag: uploadRes.ETag!, PartNumber: i + 1 });
        }

        await completeMultipartUpload(key, uploadId, parts);
      } catch (uploadErr) {
        // Abort multipart upload on failure
        await abortMultipartUpload(key, uploadId).catch(() => {});
        throw uploadErr;
      }
    } else {
      // Simple PutObject for small files
      const { PutObjectCommand } = await import("@aws-sdk/client-s3");
      const buffer = Buffer.from(await file.arrayBuffer());

      await s3Client.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        })
      );

      fileUrl = getFileUrl(key);
    }

    // Save file record
    const { data: fileRecord, error } = await supabase
      .from("order_files")
      .insert({
        order_id: orderId,
        file_name: file.name,
        file_key: key,
        file_url: fileUrl,
        file_size: file.size,
        mime_type: contentType,
        uploaded_by: session.user.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data: fileRecord }, { status: 201 });
  } catch (err) {
    console.error("S3 upload error:", err);
    return NextResponse.json({ error: "File upload failed" }, { status: 500 });
  }
}

// DELETE /api/orders/[id]/files?file_id=xxx
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  const fileId = request.nextUrl.searchParams.get("file_id");

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "orders", "edit");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!fileId) return NextResponse.json({ error: "file_id required" }, { status: 400 });

  const { data: file } = await supabase
    .from("order_files")
    .select("*")
    .eq("id", fileId)
    .eq("order_id", orderId)
    .single();

  if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });

  try {
    await deleteFromS3(file.file_key);
  } catch {
    // Continue even if S3 delete fails
  }

  await supabase.from("order_files").delete().eq("id", fileId);

  return NextResponse.json({ success: true });
}
