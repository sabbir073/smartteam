"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Shield,
  UsersRound,
  Layers,
  Globe,
  Target,
  DollarSign,
  FileBarChart,
  ClipboardList,
  Package,
  Bell,
  ScrollText,
  Settings,
  UserCircle,
  Star,
  MessageCircle,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Shield,
  UsersRound,
  Layers,
  Globe,
  Target,
  DollarSign,
  FileBarChart,
  ClipboardList,
  Package,
  Bell,
  ScrollText,
  Settings,
  UserCircle,
  Star,
  MessageCircle,
};

interface NavItem {
  title: string;
  href: string;
  icon: string;
  module: string;
}

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/", icon: "LayoutDashboard", module: "dashboard" },
  { title: "Orders", href: "/orders", icon: "ShoppingCart", module: "orders" },
  { title: "Special Orders", href: "/special-orders", icon: "Star", module: "special-orders" },
  { title: "Users", href: "/users", icon: "Users", module: "users" },
  { title: "Roles", href: "/roles", icon: "Shield", module: "roles" },
  { title: "Teams", href: "/teams", icon: "UsersRound", module: "teams" },
  { title: "Services", href: "/services", icon: "Layers", module: "services" },
  { title: "Platforms", href: "/platforms", icon: "Globe", module: "platforms" },
  { title: "Profiles", href: "/profiles", icon: "UserCircle", module: "profiles" },
  { title: "Targets", href: "/targets", icon: "Target", module: "targets" },
  { title: "Revenue", href: "/revenue", icon: "DollarSign", module: "revenue" },
  { title: "Reports", href: "/reports", icon: "FileBarChart", module: "reports" },
  { title: "Messages", href: "/messages", icon: "MessageCircle", module: "messages" },
  { title: "Requisitions", href: "/requisitions", icon: "ClipboardList", module: "requisitions" },
  { title: "Inventory", href: "/inventory", icon: "Package", module: "inventory" },
  { title: "Audit Logs", href: "/audit-logs", icon: "ScrollText", module: "audit-logs" },
  { title: "Settings", href: "/settings", icon: "Settings", module: "settings" },
];

export function NavLinks() {
  const pathname = usePathname();
  const { hasPermission, loading } = usePermissions();

  if (loading) {
    return (
      <SidebarMenu>
        {Array.from({ length: 6 }).map((_, i) => (
          <SidebarMenuItem key={i}>
            <SidebarMenuButton>
              <div className="h-4 w-4 rounded bg-muted animate-pulse" />
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    );
  }

  const filteredItems = navItems.filter((item) =>
    hasPermission(item.module, "view")
  );

  return (
    <SidebarMenu>
      {filteredItems.map((item) => {
        const Icon = iconMap[item.icon];
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);

        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              isActive={isActive}
              render={(props) => (
                <Link href={item.href} {...props}>
                  {Icon && <Icon className="h-4 w-4" />}
                  <span>{item.title}</span>
                </Link>
              )}
            />
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
