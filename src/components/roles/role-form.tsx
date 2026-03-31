"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PermissionMatrix } from "./permission-matrix";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface RoleFormProps {
  initialData?: {
    id?: string;
    name: string;
    description: string;
    level: number;
    permission_ids: string[];
    is_system_role?: boolean;
  };
}

export function RoleForm({ initialData }: RoleFormProps) {
  const router = useRouter();
  const isEditing = !!initialData?.id;
  const isSystemRole = initialData?.is_system_role || false;

  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [level, setLevel] = useState(initialData?.level ?? 5);
  const [permissionIds, setPermissionIds] = useState<string[]>(
    initialData?.permission_ids || []
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        name,
        description,
        level,
        permission_ids: permissionIds,
      };

      const url = isEditing ? `/api/roles/${initialData.id}` : "/api/roles";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(isEditing ? "Role updated" : "Role created");
        router.push("/roles");
        router.refresh();
      } else {
        const json = await res.json();
        toast.error(json.error || "Failed to save role");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Role Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Role Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Sales Manager"
                required
                disabled={isSystemRole}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="level">
                Hierarchy Level{" "}
                <span className="text-xs text-muted-foreground">
                  (lower = higher authority)
                </span>
              </Label>
              <Input
                id="level"
                type="number"
                min={0}
                max={999}
                value={level}
                onChange={(e) => setLevel(parseInt(e.target.value) || 0)}
                disabled={isSystemRole}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this role's responsibilities..."
              rows={3}
              disabled={isSystemRole}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <PermissionMatrix
            selectedPermissionIds={permissionIds}
            onChange={setPermissionIds}
            disabled={isSystemRole}
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={saving || isSystemRole}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? "Update Role" : "Create Role"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/roles")}
        >
          Cancel
        </Button>
        {isSystemRole && (
          <p className="text-sm text-muted-foreground">
            System roles cannot be modified.
          </p>
        )}
      </div>
    </form>
  );
}
