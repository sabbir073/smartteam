"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { RoleForm } from "@/components/roles/role-form";
import { Skeleton } from "@/components/ui/skeleton";
import { RequirePermission } from "@/components/shared/require-permission";

export default function EditRolePage() {
  const params = useParams();
  const id = params.id as string;
  const [role, setRole] = useState<{
    id: string;
    name: string;
    description: string;
    level: number;
    permission_ids: string[];
    is_system_role: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      try {
        const res = await fetch(`/api/roles/${id}`);
        if (res.ok) {
          const json = await res.json();
          setRole(json.data);
        }
      } catch {
        console.error("Failed to fetch role");
      } finally {
        setLoading(false);
      }
    }
    fetchRole();
  }, [id]);

  if (loading) {
    return (
      <RequirePermission module="roles">
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
      </RequirePermission>
    );
  }

  if (!role) {
    return (
      <RequirePermission module="roles">
      <div className="text-center py-12">
        <p className="text-muted-foreground">Role not found.</p>
      </div>
      </RequirePermission>
    );
  }

  return (
    <RequirePermission module="roles">
    <div className="space-y-6">
      <PageHeader
        title={`Edit Role: ${role.name}`}
        description="Modify role details and permissions"
      />
      <RoleForm initialData={role} />
    </div>
    </RequirePermission>
  );
}
