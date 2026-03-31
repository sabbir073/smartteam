"use client";

import { PageHeader } from "@/components/shared/page-header";
import { UserForm } from "@/components/users/user-form";
import { RequirePermission } from "@/components/shared/require-permission";

export default function NewUserPage() {
  return (
    <RequirePermission module="users" action="create">
    <div className="space-y-6">
      <PageHeader
        title="Create User"
        description="Add a new user to the system"
      />
      <UserForm />
    </div>
    </RequirePermission>
  );
}
