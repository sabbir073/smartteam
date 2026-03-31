"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, Column } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, MoreHorizontal, Pencil, Trash2, Shield } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { RequirePermission } from "@/components/shared/require-permission";

interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  level: number;
  is_system_role: boolean;
  permission_count: number;
  user_count: number;
  [key: string]: unknown;
}

export default function RolesPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch("/api/roles");
      if (res.ok) {
        const json = await res.json();
        setRoles(json.data || []);
      }
    } catch {
      toast.error("Failed to load roles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/roles/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Role deleted");
        fetchRoles();
      } else {
        const json = await res.json();
        toast.error(json.error || "Failed to delete role");
      }
    } catch {
      toast.error("Failed to delete role");
    } finally {
      setDeleteId(null);
    }
  }

  const columns: Column<RoleRow>[] = [
    {
      key: "name",
      header: "Role Name",
      render: (role) => (
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{role.name}</span>
          {role.is_system_role && (
            <Badge variant="secondary" className="text-[10px]">
              System
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (role) => (
        <span className="text-muted-foreground">
          {role.description || "-"}
        </span>
      ),
    },
    {
      key: "level",
      header: "Level",
      render: (role) => <Badge variant="outline">{role.level}</Badge>,
    },
    {
      key: "permission_count",
      header: "Permissions",
      render: (role) => <span>{role.permission_count}</span>,
    },
    {
      key: "user_count",
      header: "Users",
      render: (role) => <span>{role.user_count}</span>,
    },
    {
      key: "actions",
      header: "",
      className: "w-12",
      render: (role) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(props) => (
              <Button variant="ghost" size="icon" {...props}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            )}
          />
          <DropdownMenuContent align="end">
            {hasPermission("roles", "edit") && (
              <DropdownMenuItem
                onClick={() => router.push(`/roles/${role.id}`)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            )}
            {hasPermission("roles", "delete") && !role.is_system_role && (
              <DropdownMenuItem
                onClick={() => setDeleteId(role.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <RequirePermission module="roles">
    <div className="space-y-6">
      <PageHeader title="Roles" description="Manage roles and their permissions">
        {hasPermission("roles", "create") && (
          <Button onClick={() => router.push("/roles/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Role
          </Button>
        )}
      </PageHeader>

      <DataTable
        columns={columns}
        data={roles}
        loading={loading}
        emptyMessage="No roles found. Create your first role."
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this role? This action cannot be
              undone. Users assigned to this role must be reassigned first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </RequirePermission>
  );
}
