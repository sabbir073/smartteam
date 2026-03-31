"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <Card className="max-w-lg mx-auto mt-12">
      <CardContent className="p-8 text-center space-y-4">
        <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
        <h3 className="text-lg font-semibold">Something went wrong</h3>
        <p className="text-sm text-muted-foreground">{error.message || "An unexpected error occurred."}</p>
        <Button onClick={reset}>Try Again</Button>
      </CardContent>
    </Card>
  );
}
