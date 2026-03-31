import { supabase } from "./db";
import type { Permission, PermissionCheck, DataScope } from "@/types";

/**
 * Get all permissions for a user based on their role
 */
export async function getUserPermissions(userId: string): Promise<Permission[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role_id")
    .eq("user_id", userId)
    .single();

  if (error || !data) return [];

  const { data: permissions, error: permError } = await supabase
    .from("role_permissions")
    .select(`
      permission_id,
      permissions:permission_id (
        id,
        module,
        action,
        data_scope,
        description
      )
    `)
    .eq("role_id", data.role_id);

  if (permError || !permissions) return [];

  return permissions
    .map((rp: Record<string, unknown>) => rp.permissions as Permission)
    .filter(Boolean);
}

/**
 * Check if a user has a specific permission (module + action)
 * Returns the highest data_scope available for that module+action
 */
export async function checkPermission(
  userId: string,
  module: string,
  action: string
): Promise<PermissionCheck> {
  const permissions = await getUserPermissions(userId);

  const matching = permissions.filter(
    (p) => p.module === module && p.action === action
  );

  if (matching.length === 0) {
    return { allowed: false, dataScope: "own" };
  }

  // Return the highest scope (all > department > team > own)
  const scopeOrder: DataScope[] = ["all", "department", "team", "own"];
  for (const scope of scopeOrder) {
    if (matching.some((p) => p.data_scope === scope)) {
      return { allowed: true, dataScope: scope };
    }
  }

  return { allowed: true, dataScope: "own" };
}

/**
 * Get the SQL filter condition based on data scope
 */
export function getDataScopeFilter(
  dataScope: DataScope,
  userId: string,
  fieldName = "assigned_to"
): { column: string; value: string } | null {
  switch (dataScope) {
    case "all":
      return null; // No filter
    case "own":
      return { column: fieldName, value: userId };
    // team and department scopes require additional queries
    // handled in individual API routes
    default:
      return { column: fieldName, value: userId };
  }
}

/**
 * Get team member IDs for data scope filtering
 */
export async function getTeamMemberIds(userId: string): Promise<string[]> {
  // Find teams the user belongs to
  const { data: userTeams } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId);

  if (!userTeams || userTeams.length === 0) return [userId];

  const teamIds = userTeams.map((t) => t.team_id);

  // Get all members of those teams
  const { data: members } = await supabase
    .from("team_members")
    .select("user_id")
    .in("team_id", teamIds);

  if (!members) return [userId];

  return [...new Set(members.map((m) => m.user_id))];
}

/**
 * Get department member IDs for data scope filtering
 */
export async function getDepartmentMemberIds(userId: string): Promise<string[]> {
  // Get user's department
  const { data: user } = await supabase
    .from("users")
    .select("department_id")
    .eq("id", userId)
    .single();

  if (!user?.department_id) return [userId];

  // Get all users in the same department
  const { data: members } = await supabase
    .from("users")
    .select("id")
    .eq("department_id", user.department_id);

  if (!members) return [userId];

  return members.map((m) => m.id);
}

/**
 * Get filtered user IDs based on data scope
 */
export async function getFilteredUserIds(
  dataScope: DataScope,
  userId: string
): Promise<string[] | null> {
  switch (dataScope) {
    case "all":
      return null; // No filter needed
    case "department":
      return getDepartmentMemberIds(userId);
    case "team":
      return getTeamMemberIds(userId);
    case "own":
      return [userId];
    default:
      return [userId];
  }
}

/**
 * Check if user has any permission for a module (used for sidebar visibility)
 */
export async function hasModuleAccess(
  userId: string,
  module: string
): Promise<boolean> {
  const check = await checkPermission(userId, module, "view");
  return check.allowed;
}
