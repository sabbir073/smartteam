"use client";

import { PageHeader } from "@/components/shared/page-header";
import { RoleForm } from "@/components/roles/role-form";
import { RequirePermission } from "@/components/shared/require-permission";

export default function NewRolePage() {
  return (
    <RequirePermission module="roles" action="create">
    <div className="space-y-6">
      <PageHeader
        title="Create Role"
        description="Define a new role with specific permissions"
      />
      <RoleForm />
    </div>
    </RequirePermission>
  );
}
