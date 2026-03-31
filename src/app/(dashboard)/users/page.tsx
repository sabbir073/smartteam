"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, Column } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { RequirePermission } from "@/components/shared/require-permission";
import { useDebounce } from "@/hooks/use-debounce";

interface UserRow {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
  user_roles: { role_id: string; roles: { id: string; name: string; level: number } }[] | { role_id: string; roles: { id: string; name: string; level: number } };
  [key: string]: unknown;
}

export default function UsersPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "20",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/users?${params}`);
      if (res.ok) {
        const json = await res.json();
        setUsers(json.data || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 1);
      }
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/users/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("User deactivated");
        fetchUsers();
      } else {
        const json = await res.json();
        toast.error(json.error || "Failed to delete user");
      }
    } catch {
      toast.error("Failed to delete user");
    } finally {
      setDeleteId(null);
    }
  }

  const columns: Column<UserRow>[] = [
    {
      key: "name",
      header: "User",
      render: (user) => {
        const initials = user.name
          ?.split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);

        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.avatar_url || undefined} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "role",
      header: "Role",
      render: (user) => {
        const ur = Array.isArray(user.user_roles) ? user.user_roles[0] : user.user_roles;
        const roleData = ur?.roles;
        const role = Array.isArray(roleData) ? roleData[0] : roleData;
        return role ? (
          <Badge variant="outline">{role.name}</Badge>
        ) : (
          <span className="text-muted-foreground">No role</span>
        );
      },
    },
    {
      key: "is_active",
      header: "Status",
      render: (user) => (
        <Badge variant={user.is_active ? "default" : "secondary"}>
          {user.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "created_at",
      header: "Joined",
      render: (user) =>
        new Date(user.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
    },
    {
      key: "actions",
      header: "",
      className: "w-12",
      render: (user) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(props) => (
              <Button variant="ghost" size="icon" {...props}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            )}
          />
          <DropdownMenuContent align="end">
            {hasPermission("users", "edit") && (
              <DropdownMenuItem
                onClick={() => router.push(`/users/${user.id}`)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            )}
            {hasPermission("users", "delete") && (
              <DropdownMenuItem
                onClick={() => setDeleteId(user.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Deactivate
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <RequirePermission module="users">
    <div className="space-y-6">
      <PageHeader title="Users" description="Manage user accounts and role assignments">
        {hasPermission("users", "create") && (
          <Button onClick={() => router.push("/users/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        )}
      </PageHeader>

      {/* Summary Cards */}
      {users.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="stat-card"><div className="text-sm text-muted-foreground">Total Users</div><div className="text-2xl font-bold">{total}</div></div>
          <div className="stat-card"><div className="text-sm text-muted-foreground">Active</div><div className="text-2xl font-bold text-success">{users.filter(u => u.is_active).length}</div></div>
          <div className="stat-card"><div className="text-sm text-muted-foreground">Inactive</div><div className="text-2xl font-bold text-muted-foreground">{users.filter(u => !u.is_active).length}</div></div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        searchable
        searchPlaceholder="Search users by name or email..."
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        emptyMessage="No users found."
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate User</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the user account. They will no longer be able
              to sign in. You can reactivate the account later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </RequirePermission>
  );
}
