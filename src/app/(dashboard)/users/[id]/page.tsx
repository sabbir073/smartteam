"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { UserForm } from "@/components/users/user-form";
import { Skeleton } from "@/components/ui/skeleton";
import { RequirePermission } from "@/components/shared/require-permission";

export default function EditUserPage() {
  const params = useParams();
  const id = params.id as string;
  const [user, setUser] = useState<{
    id: string;
    name: string;
    email: string;
    is_active: boolean;
    department_id: string | null;
    user_roles: { role_id: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch(`/api/users/${id}`);
        if (res.ok) {
          const json = await res.json();
          setUser(json.data);
        }
      } catch {
        console.error("Failed to fetch user");
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [id]);

  if (loading) {
    return (
      <RequirePermission module="users">
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
      </RequirePermission>
    );
  }

  if (!user) {
    return (
      <RequirePermission module="users">
      <div className="text-center py-12">
        <p className="text-muted-foreground">User not found.</p>
      </div>
      </RequirePermission>
    );
  }

  return (
    <RequirePermission module="users">
    <div className="space-y-6">
      <PageHeader
        title={`Edit User: ${user.name}`}
        description="Update user details and role assignment"
      />
      <UserForm initialData={user} />
    </div>
    </RequirePermission>
  );
}
