export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "SmartTeam";

export const MODULES = [
  "dashboard",
  "orders",
  "special-orders",
  "users",
  "roles",
  "teams",
  "services",
  "platforms",
  "profiles",
  "targets",
  "revenue",
  "reports",
  "requisitions",
  "inventory",
  "messages",
  "notifications",
  "audit-logs",
  "settings",
] as const;

export const ACTIONS = ["view", "create", "edit", "delete"] as const;

export const DATA_SCOPES = ["own", "team", "department", "all"] as const;

export const MODULE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  orders: "Orders",
  "special-orders": "Special Orders",
  users: "Users",
  roles: "Roles & Permissions",
  teams: "Teams",
  services: "Services",
  platforms: "Platforms",
  profiles: "Platform Profiles",
  targets: "Targets",
  revenue: "Revenue",
  reports: "Reports",
  requisitions: "Tech Requisitions",
  inventory: "Tech Inventory",
  messages: "Messages",
  notifications: "Notifications",
  "audit-logs": "Audit Logs",
  settings: "Settings",
};

export const MODULE_ICONS: Record<string, string> = {
  dashboard: "LayoutDashboard",
  orders: "ShoppingCart",
  "special-orders": "Star",
  users: "Users",
  roles: "Shield",
  teams: "UsersRound",
  services: "Layers",
  platforms: "Globe",
  profiles: "UserCircle",
  targets: "Target",
  revenue: "DollarSign",
  reports: "FileBarChart",
  requisitions: "ClipboardList",
  inventory: "Package",
  messages: "MessageCircle",
  notifications: "Bell",
  "audit-logs": "ScrollText",
  settings: "Settings",
};

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

export const URGENCY_LEVELS = [
  { value: "low", label: "Low", color: "bg-blue-100 text-blue-800" },
  { value: "medium", label: "Medium", color: "bg-yellow-100 text-yellow-800" },
  { value: "high", label: "High", color: "bg-orange-100 text-orange-800" },
  { value: "critical", label: "Critical", color: "bg-red-100 text-red-800" },
] as const;

export const REQUISITION_STATUSES = [
  { value: "pending", label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  { value: "approved", label: "Approved", color: "bg-green-100 text-green-800" },
  { value: "rejected", label: "Rejected", color: "bg-red-100 text-red-800" },
  { value: "fulfilled", label: "Fulfilled", color: "bg-blue-100 text-blue-800" },
] as const;

export const INVENTORY_STATUSES = [
  { value: "active", label: "Active" },
  { value: "retired", label: "Retired" },
  { value: "under_repair", label: "Under Repair" },
] as const;

export const PERIOD_TYPES = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
] as const;

export const ITEMS_PER_PAGE = 20;
