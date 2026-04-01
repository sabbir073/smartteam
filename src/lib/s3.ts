import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";

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
const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL || "";

/**
 * Get the public URL for a file. Uses CloudFront CDN if configured, otherwise direct S3.
 */
export function getFileUrl(key: string): string {
  if (CDN_URL) return `${CDN_URL}/${key}`;
  return `https://${S3_BUCKET}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${key}`;
}

/**
 * Initiate multipart upload for large files.
 */
export async function initiateMultipartUpload(
  key: string,
  contentType: string,
  partCount: number
): Promise<{ uploadId: string; partUrls: string[]; fileUrl: string }> {
  const createRes = await s3Client.send(
    new CreateMultipartUploadCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType,
    })
  );

  const uploadId = createRes.UploadId!;
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

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

  return { uploadId, partUrls, fileUrl: getFileUrl(key) };
}

/**
 * Complete a multipart upload after all parts are uploaded.
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
 * Abort a multipart upload.
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
 * Delete a file from S3.
 */
export async function deleteFromS3(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    })
  );
}
