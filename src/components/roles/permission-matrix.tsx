"use client";

import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MODULES, ACTIONS, DATA_SCOPES, MODULE_LABELS } from "@/lib/constants";
import type { Permission } from "@/types";

interface PermissionMatrixProps {
  selectedPermissionIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function PermissionMatrix({
  selectedPermissionIds,
  onChange,
  disabled = false,
}: PermissionMatrixProps) {
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPermissions() {
      try {
        const res = await fetch("/api/permissions");
        if (res.ok) {
          const json = await res.json();
          setAllPermissions(json.permissions || []);
        }
      } catch {
        console.error("Failed to fetch permissions");
      } finally {
        setLoading(false);
      }
    }
    fetchPermissions();
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  // Group permissions by module
  const permissionsByModule = new Map<string, Permission[]>();
  for (const perm of allPermissions) {
    const existing = permissionsByModule.get(perm.module) || [];
    existing.push(perm);
    permissionsByModule.set(perm.module, existing);
  }

  function findPermission(
    module: string,
    action: string,
    scope: string
  ): Permission | undefined {
    return allPermissions.find(
      (p) => p.module === module && p.action === action && p.data_scope === scope
    );
  }

  function isChecked(permId: string): boolean {
    return selectedPermissionIds.includes(permId);
  }

  function togglePermission(permId: string) {
    if (disabled) return;
    if (isChecked(permId)) {
      onChange(selectedPermissionIds.filter((id) => id !== permId));
    } else {
      onChange([...selectedPermissionIds, permId]);
    }
  }

  function toggleModuleAll(module: string) {
    if (disabled) return;
    const modulePerms = permissionsByModule.get(module) || [];
    const moduleIds = modulePerms.map((p) => p.id);
    const allSelected = moduleIds.every((id) => selectedPermissionIds.includes(id));

    if (allSelected) {
      onChange(selectedPermissionIds.filter((id) => !moduleIds.includes(id)));
    } else {
      const newIds = new Set([...selectedPermissionIds, ...moduleIds]);
      onChange(Array.from(newIds));
    }
  }

  function selectAll() {
    if (disabled) return;
    onChange(allPermissions.map((p) => p.id));
  }

  function deselectAll() {
    if (disabled) return;
    onChange([]);
  }

  const scopeColors: Record<string, string> = {
    own: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    team: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    department: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    all: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selectedPermissionIds.length} of {allPermissions.length} permissions selected
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectAll}
            disabled={disabled}
            className="text-sm text-primary hover:underline disabled:opacity-50"
          >
            Select All
          </button>
          <span className="text-muted-foreground">|</span>
          <button
            type="button"
            onClick={deselectAll}
            disabled={disabled}
            className="text-sm text-primary hover:underline disabled:opacity-50"
          >
            Deselect All
          </button>
        </div>
      </div>

      <div className="rounded-md border overflow-auto max-h-[600px]">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-40">Module</TableHead>
              {ACTIONS.map((action) => (
                <TableHead key={action} colSpan={DATA_SCOPES.length} className="text-center border-l">
                  <span className="capitalize">{action}</span>
                </TableHead>
              ))}
            </TableRow>
            <TableRow>
              <TableHead>
                <span className="text-xs text-muted-foreground">Scope →</span>
              </TableHead>
              {ACTIONS.map((action) =>
                DATA_SCOPES.map((scope) => (
                  <TableHead key={`${action}-${scope}`} className="text-center text-xs px-1 border-l first:border-l-0">
                    <Badge variant="outline" className={`text-[9px] px-1 ${scopeColors[scope]}`}>
                      {scope}
                    </Badge>
                  </TableHead>
                ))
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {MODULES.map((module) => {
              const modulePerms = permissionsByModule.get(module) || [];
              const moduleIds = modulePerms.map((p) => p.id);
              const allModuleSelected = moduleIds.length > 0 && moduleIds.every((id) =>
                selectedPermissionIds.includes(id)
              );

              return (
                <TableRow key={module}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={allModuleSelected}
                        onCheckedChange={() => toggleModuleAll(module)}
                        disabled={disabled}
                      />
                      <span className="text-sm">
                        {MODULE_LABELS[module] || module}
                      </span>
                    </div>
                  </TableCell>
                  {ACTIONS.map((action) =>
                    DATA_SCOPES.map((scope) => {
                      const perm = findPermission(module, action, scope);
                      return (
                        <TableCell
                          key={`${action}-${scope}`}
                          className="text-center border-l first:border-l-0"
                        >
                          {perm ? (
                            <Checkbox
                              checked={isChecked(perm.id)}
                              onCheckedChange={() => togglePermission(perm.id)}
                              disabled={disabled}
                            />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      );
                    })
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
