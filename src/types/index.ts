// ============================================================
// Database Row Types
// ============================================================

export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  avatar_url: string | null;
  department_id: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  level: number;
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  module: string;
  action: string;
  data_scope: DataScope;
  description: string | null;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  assigned_by: string | null;
  assigned_at: string;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  parent_department_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ServiceLine {
  id: string;
  service_category_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  type: "sales" | "operations";
  service_category_id: string | null;
  department_id: string | null;
  leader_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  joined_at: string;
}

export interface Platform {
  id: string;
  name: string;
  charge_percentage: number;
  is_active: boolean;
  created_at: string;
}

export interface OrderStatus {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_default: boolean;
  is_terminal: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  order_date: string;
  external_order_id: string | null;
  client_name: string;
  client_profile_url: string | null;
  platform_id: string;
  gross_amount: number;
  platform_charge: number;
  net_amount: number;
  service_category_id: string | null;
  service_line_id: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  status_id: string;
  deadline: string | null;
  instruction_text: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OrderFile {
  id: string;
  order_id: string;
  file_name: string;
  file_key: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string;
  uploaded_at: string;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  from_status_id: string | null;
  to_status_id: string;
  changed_by: string;
  changed_at: string;
  notes: string | null;
}

export interface RevenueSettings {
  id: string;
  attribution_mode: "sales" | "operations" | "split";
  sales_split_percentage: number;
  operations_split_percentage: number;
  cost_entry_role_ids: string[];
  updated_by: string | null;
  updated_at: string;
}

export interface MarketingCost {
  id: string;
  order_id: string | null;
  amount: number;
  description: string | null;
  cost_date: string;
  added_by: string;
  created_at: string;
}

export interface Target {
  id: string;
  user_id: string;
  period_type: "monthly" | "quarterly" | "yearly";
  period_start: string;
  period_end: string;
  target_amount: number;
  set_by: string;
  created_at: string;
  updated_at: string;
}

export interface TargetHistory {
  id: string;
  target_id: string;
  old_amount: number | null;
  new_amount: number;
  changed_by: string;
  changed_at: string;
}

export interface TechRequisition {
  id: string;
  requester_id: string;
  item_description: string;
  purpose: string;
  estimated_cost: number | null;
  urgency: "low" | "medium" | "high" | "critical";
  status: "pending" | "approved" | "rejected" | "fulfilled";
  reviewer_id: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  fulfilled_by: string | null;
  fulfilled_at: string | null;
  created_at: string;
}

export interface TechInventory {
  id: string;
  item_name: string;
  description: string | null;
  category: string | null;
  assigned_to: string | null;
  purchase_date: string | null;
  cost: number | null;
  status: "active" | "retired" | "under_repair";
  serial_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  module: string;
  entity_type: string | null;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: unknown;
  updated_by: string | null;
  updated_at: string;
}

// ============================================================
// Enums & Constants
// ============================================================

export type DataScope = "own" | "team" | "department" | "all";

export type PermissionAction = "view" | "create" | "edit" | "delete";

export const MODULES = [
  "dashboard",
  "orders",
  "users",
  "roles",
  "teams",
  "services",
  "platforms",
  "targets",
  "revenue",
  "reports",
  "requisitions",
  "inventory",
  "notifications",
  "audit-logs",
  "settings",
] as const;

export type Module = (typeof MODULES)[number];

export const NOTIFICATION_TYPES = {
  ORDER_CREATED: "order_created",
  ORDER_ASSIGNED: "order_assigned",
  ORDER_STATUS_CHANGED: "order_status_changed",
  DEADLINE_APPROACHING: "deadline_approaching",
  TARGET_SET: "target_set",
  TARGET_UPDATED: "target_updated",
  REQUISITION_SUBMITTED: "requisition_submitted",
  REQUISITION_REVIEWED: "requisition_reviewed",
  USER_CREATED: "user_created",
  ROLE_CHANGED: "role_changed",
} as const;

// ============================================================
// API / Component Types
// ============================================================

export interface PermissionCheck {
  allowed: boolean;
  dataScope: DataScope;
}

export interface UserWithRole extends User {
  role: Role | null;
  permissions: Permission[];
}

export interface OrderWithRelations extends Order {
  platform?: Platform;
  status?: OrderStatus;
  service_category?: ServiceCategory;
  service_line?: ServiceLine;
  assigned_user?: Pick<User, "id" | "name" | "email" | "avatar_url">;
  created_by_user?: Pick<User, "id" | "name" | "email">;
  files?: OrderFile[];
}

export interface TargetWithProgress extends Target {
  achieved_amount: number;
  gap: number;
  achievement_percentage: number;
  user?: Pick<User, "id" | "name" | "email">;
}

export interface TeamWithMembers extends Team {
  members: (TeamMember & { user: Pick<User, "id" | "name" | "email" | "avatar_url"> })[];
  leader?: Pick<User, "id" | "name" | "email" | "avatar_url">;
  service_category?: ServiceCategory;
}

export interface SSEEvent {
  type: "notification" | "order-update" | "dashboard-refresh";
  data: Record<string, unknown>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
