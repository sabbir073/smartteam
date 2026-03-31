"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, X, FileText, Image as ImageIcon, FileSpreadsheet, FileArchive, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Shared constants ──────────────────────────────────────────
export const ORDER_FILE_ACCEPT =
  "image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,.rar,.7z,.psd,.ai,.fig,.sketch";

export const AVATAR_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

function getFileIcon(mime: string | undefined) {
  if (!mime) return FileText;
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv"))
    return FileSpreadsheet;
  if (mime.includes("zip") || mime.includes("rar") || mime.includes("7z") || mime.includes("archive"))
    return FileArchive;
  return FileText;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Single File Upload (for profile pictures, etc.) ───────────
interface FileUploadProps {
  uploadUrl: string;
  onSuccess: (data?: Record<string, unknown>) => void;
  onError?: (message: string) => void;
  maxSizeMB?: number;
  accept?: string;
  disabled?: boolean;
  label?: string;
}

export function FileUpload({
  uploadUrl,
  onSuccess,
  onError,
  maxSizeMB = 50,
  accept,
  disabled = false,
  label = "Upload File",
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxSizeMB * 1024 * 1024) {
      onError?.(`File exceeds ${maxSizeMB}MB limit`);
      e.target.value = "";
      return;
    }

    setFileName(file.name);
    uploadFile(file);
  }

  function uploadFile(file: File) {
    setUploading(true);
    setProgress(0);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    const formData = new FormData();
    formData.append("file", file);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setProgress(100);
        let responseData: Record<string, unknown> | undefined;
        try { responseData = JSON.parse(xhr.responseText); } catch {}
        setTimeout(() => {
          setUploading(false);
          setProgress(0);
          setFileName("");
          if (inputRef.current) inputRef.current.value = "";
          onSuccess(responseData);
        }, 400);
      } else {
        try {
          const json = JSON.parse(xhr.responseText);
          onError?.(json.error || "Upload failed");
        } catch {
          onError?.("Upload failed");
        }
        setUploading(false);
        setProgress(0);
      }
    });

    xhr.addEventListener("error", () => {
      onError?.("Upload failed. Check your connection.");
      setUploading(false);
      setProgress(0);
    });

    xhr.open("POST", uploadUrl);
    xhr.send(formData);
  }

  function cancelUpload() {
    xhrRef.current?.abort();
    xhrRef.current = null;
    setUploading(false);
    setProgress(0);
    setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  }

  if (uploading) {
    return (
      <div className="space-y-2 min-w-[200px]">
        <div className="flex items-center justify-between text-sm">
          <span className="truncate max-w-[180px]">{fileName}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{progress}%</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelUpload}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        onChange={handleFileSelect}
        className="absolute inset-0 opacity-0 cursor-pointer"
        disabled={disabled}
        accept={accept}
      />
      <Button size="sm" variant="outline" disabled={disabled} type="button">
        <Upload className="mr-1.5 h-4 w-4" />
        {label}
      </Button>
    </div>
  );
}

// ─── Multi-File Upload (for orders, etc.) ──────────────────────
interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
  xhr?: XMLHttpRequest;
}

interface MultiFileUploadProps {
  uploadUrl: string;
  onFileUploaded: () => void;
  onError?: (message: string) => void;
  maxSizeMB?: number;
  accept?: string;
  disabled?: boolean;
  maxFiles?: number;
}

export function MultiFileUpload({
  uploadUrl,
  onFileUploaded,
  onError,
  maxSizeMB = 50,
  accept = ORDER_FILE_ACCEPT,
  disabled = false,
  maxFiles = 20,
}: MultiFileUploadProps) {
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadSingleFile = useCallback(
    (uploadFile: UploadingFile) => {
      const xhr = new XMLHttpRequest();

      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, status: "uploading" as const, xhr } : f
        )
      );

      const formData = new FormData();
      formData.append("file", uploadFile.file);

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setFiles((prev) =>
            prev.map((f) => (f.id === uploadFile.id ? { ...f, progress: pct } : f))
          );
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id
                ? { ...f, status: "done" as const, progress: 100 }
                : f
            )
          );
          onFileUploaded();
        } else {
          let errMsg = "Upload failed";
          try {
            errMsg = JSON.parse(xhr.responseText).error || errMsg;
          } catch {}
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id
                ? { ...f, status: "error" as const, error: errMsg }
                : f
            )
          );
          onError?.(errMsg);
        }
      });

      xhr.addEventListener("error", () => {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id
              ? { ...f, status: "error" as const, error: "Network error" }
              : f
          )
        );
        onError?.("Network error");
      });

      xhr.open("POST", uploadUrl);
      xhr.send(formData);
    },
    [uploadUrl, onFileUploaded, onError]
  );

  function addFiles(fileList: FileList | File[]) {
    const newFiles: UploadingFile[] = [];

    for (const file of Array.from(fileList)) {
      if (file.size > maxSizeMB * 1024 * 1024) {
        onError?.(`${file.name} exceeds ${maxSizeMB}MB limit`);
        continue;
      }

      if (files.length + newFiles.length >= maxFiles) {
        onError?.(`Maximum ${maxFiles} files allowed`);
        break;
      }

      const uploadFile: UploadingFile = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        progress: 0,
        status: "pending",
      };

      newFiles.push(uploadFile);
    }

    if (newFiles.length === 0) return;
    setFiles((prev) => [...prev, ...newFiles]);

    // Start uploading each file
    for (const f of newFiles) {
      uploadSingleFile(f);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  }

  function cancelFile(id: string) {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.xhr) file.xhr.abort();
      return prev.filter((f) => f.id !== id);
    });
  }

  function clearCompleted() {
    setFiles((prev) => prev.filter((f) => f.status !== "done"));
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  const hasCompleted = files.some((f) => f.status === "done");

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      <div
        className={cn(
          "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50",
          disabled && "opacity-50 pointer-events-none"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
          accept={accept}
        />
        <Upload className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm font-medium">
          Drop files here or{" "}
          <span className="text-primary">browse</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Images, PDF, Excel, CSV, ZIP, DOCX up to {maxSizeMB}MB each
        </p>
      </div>

      {/* File Queue */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {files.length} file{files.length > 1 ? "s" : ""}
            </span>
            {hasCompleted && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto py-0.5 px-1.5 text-xs"
                onClick={clearCompleted}
                type="button"
              >
                Clear completed
              </Button>
            )}
          </div>
          {files.map((f) => {
            const Icon = getFileIcon(f.file.type);
            return (
              <div
                key={f.id}
                className="flex items-center gap-2 rounded-lg border bg-card p-2.5"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm truncate">{f.file.name}</span>
                    <span className="text-xs text-muted-foreground ml-2 shrink-0">
                      {formatFileSize(f.file.size)}
                    </span>
                  </div>
                  {f.status === "uploading" && (
                    <Progress value={f.progress} className="h-1" />
                  )}
                  {f.status === "error" && (
                    <p className="text-xs text-destructive">{f.error}</p>
                  )}
                </div>
                {f.status === "done" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      cancelFile(f.id);
                    }}
                    type="button"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Avatar Upload ─────────────────────────────────────────────
interface AvatarUploadProps {
  currentUrl?: string | null;
  uploadUrl: string;
  onSuccess: (url: string) => void;
  onError?: (msg: string) => void;
  disabled?: boolean;
}

export function AvatarUpload({
  currentUrl,
  uploadUrl,
  onSuccess,
  onError,
  disabled = false,
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      onError?.("Image must be under 5MB");
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    // Upload
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.addEventListener("load", () => {
      setUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          onSuccess(json.data?.avatar_url || json.data?.url || "");
        } catch {
          onSuccess("");
        }
      } else {
        setPreview(null);
        try {
          onError?.(JSON.parse(xhr.responseText).error || "Upload failed");
        } catch {
          onError?.("Upload failed");
        }
      }
    });
    xhr.addEventListener("error", () => {
      setUploading(false);
      setPreview(null);
      onError?.("Upload failed");
    });

    xhr.open("POST", uploadUrl);
    xhr.send(formData);
  }

  const imgSrc = preview || currentUrl || undefined;

  return (
    <div className="flex items-center gap-4">
      <div
        className={cn(
          "relative h-20 w-20 rounded-full overflow-hidden border-2 border-dashed border-muted-foreground/25 cursor-pointer group transition-colors hover:border-primary/50",
          disabled && "pointer-events-none opacity-50"
        )}
        onClick={() => inputRef.current?.click()}
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt="Avatar"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-muted">
            <Upload className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={AVATAR_ACCEPT}
          onChange={handleSelect}
          disabled={disabled || uploading}
        />
      </div>
      <div className="space-y-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          type="button"
        >
          {uploading ? "Uploading..." : currentUrl ? "Change Photo" : "Upload Photo"}
        </Button>
        <p className="text-xs text-muted-foreground">JPG, PNG, WebP. Max 5MB.</p>
      </div>
    </div>
  );
}
