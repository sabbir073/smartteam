"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RequirePermissionProps {
  module: string;
  action?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Wraps page content and blocks rendering if user lacks the required permission.
 * Shows a loading spinner while session/permissions load, then either renders
 * children or an access denied message.
 */
export function RequirePermission({
  module,
  action = "view",
  children,
  fallback,
}: RequirePermissionProps) {
  const { status } = useSession();
  const router = useRouter();
  const { hasPermission, loading: permLoading } = usePermissions();

  // Session loading
  if (status === "loading" || permLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  // Not authenticated (shouldn't happen due to middleware, but safety net)
  if (status === "unauthenticated") {
    router.replace("/login");
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Permission check
  if (!hasPermission(module, action)) {
    if (fallback) return <>{fallback}</>;

    return (
      <div className="flex items-center justify-center py-24">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
            <h3 className="text-lg font-semibold">Access Denied</h3>
            <p className="text-sm text-muted-foreground">
              You don&apos;t have permission to access this page. Contact your administrator
              if you believe this is an error.
            </p>
            <Button variant="outline" onClick={() => router.push("/")}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
