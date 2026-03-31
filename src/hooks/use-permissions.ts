"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import type { Permission } from "@/types";

interface UsePermissionsReturn {
  permissions: Permission[];
  loading: boolean;
  hasPermission: (module: string, action: string) => boolean;
  getDataScope: (module: string, action: string) => string;
}

export function usePermissions(): UsePermissionsReturn {
  const { data: session } = useSession();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPermissions() {
      if (!session?.user?.id) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/permissions/me");
        if (res.ok) {
          const data = await res.json();
          setPermissions(data.permissions || []);
        }
      } catch {
        console.error("Failed to fetch permissions");
      } finally {
        setLoading(false);
      }
    }

    fetchPermissions();
  }, [session?.user?.id]);

  const hasPermission = useCallback(
    (module: string, action: string): boolean => {
      return permissions.some((p) => p.module === module && p.action === action);
    },
    [permissions]
  );

  const getDataScope = useCallback(
    (module: string, action: string): string => {
      const scopeOrder = ["all", "department", "team", "own"];
      const matching = permissions.filter(
        (p) => p.module === module && p.action === action
      );

      for (const scope of scopeOrder) {
        if (matching.some((p) => p.data_scope === scope)) {
          return scope;
        }
      }

      return "own";
    },
    [permissions]
  );

  return { permissions, loading, hasPermission, getDataScope };
}
