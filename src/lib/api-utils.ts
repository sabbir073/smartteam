import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkPermission } from "./permissions";
import type { PermissionCheck } from "@/types";

/**
 * Standard API error response
 */
export function apiError(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Get authenticated session or return 401
 */
export async function getAuthSession() {
  const session = await auth();
  if (!session?.user?.id) {
    return { session: null, error: apiError("Unauthorized", 401) };
  }
  return { session, error: null };
}

/**
 * Check permission and return 403 if not allowed
 */
export async function requirePermission(
  userId: string,
  module: string,
  action: string
): Promise<{ perm: PermissionCheck; error: NextResponse | null }> {
  const perm = await checkPermission(userId, module, action);
  if (!perm.allowed) {
    return { perm, error: apiError("Forbidden", 403) };
  }
  return { perm, error: null };
}
