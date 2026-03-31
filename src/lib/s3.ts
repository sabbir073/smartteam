import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

if (
  process.env.NODE_ENV !== "production" &&
  (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET || !process.env.AWS_REGION)
) {
  console.warn("AWS S3 environment variables not fully configured. File uploads will not work.");
}

export const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export const S3_BUCKET = process.env.AWS_S3_BUCKET || "";

/**
 * Generate a presigned URL for direct client-to-S3 upload.
 * This bypasses the server entirely, avoiding body size limits.
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<{ uploadUrl: string; fileUrl: string }> {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });
  const fileUrl = `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

  return { uploadUrl, fileUrl };
}

/**
 * Upload directly from server (for small files < 5MB)
 */
export async function uploadToS3(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  return `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

/**
 * Generate presigned URLs for multipart upload (large files)
 * Returns uploadId and presigned URLs for each part
 */
export async function initiateMultipartUpload(
  key: string,
  contentType: string,
  partCount: number
): Promise<{ uploadId: string; partUrls: string[]; fileUrl: string }> {
  // Initiate multipart upload
  const createRes = await s3Client.send(
    new CreateMultipartUploadCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType,
    })
  );

  const uploadId = createRes.UploadId!;

  // Generate presigned URL for each part
  const partUrls: string[] = [];
  for (let i = 1; i <= partCount; i++) {
    const command = new UploadPartCommand({
      Bucket: S3_BUCKET,
      Key: key,
      UploadId: uploadId,
      PartNumber: i,
    });
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    partUrls.push(url);
  }

  const fileUrl = `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

  return { uploadId, partUrls, fileUrl };
}

/**
 * Complete a multipart upload after all parts are uploaded
 */
export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: { ETag: string; PartNumber: number }[]
): Promise<void> {
  await s3Client.send(
    new CompleteMultipartUploadCommand({
      Bucket: S3_BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    })
  );
}

/**
 * Abort a multipart upload
 */
export async function abortMultipartUpload(
  key: string,
  uploadId: string
): Promise<void> {
  await s3Client.send(
    new AbortMultipartUploadCommand({
      Bucket: S3_BUCKET,
      Key: key,
      UploadId: uploadId,
    })
  );
}

/**
 * Generate a presigned download URL
 */
export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Delete a file from S3
 */
export async function deleteFromS3(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    })
  );
}
