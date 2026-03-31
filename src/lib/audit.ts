import { supabase } from "./db";

interface AuditParams {
  userId: string | null;
  action: "create" | "update" | "delete" | "login" | "logout" | "assign" | "approve" | "reject";
  module: string;
  entityType?: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an action to the audit trail
 */
export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await supabase.from("audit_logs").insert({
      user_id: params.userId,
      action: params.action,
      module: params.module,
      entity_type: params.entityType || null,
      entity_id: params.entityId || null,
      old_values: params.oldValues || null,
      new_values: params.newValues || null,
      ip_address: params.ipAddress || null,
      user_agent: params.userAgent || null,
    });
  } catch (error) {
    console.error("Failed to log audit:", error);
  }
}

/**
 * Extract IP address and user agent from request headers
 */
export function getRequestMeta(request: Request): {
  ipAddress: string;
  userAgent: string;
} {
  return {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown",
    userAgent: request.headers.get("user-agent") || "unknown",
  };
}
