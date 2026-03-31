"use client";

import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  name: string;
  color: string;
}

export function StatusBadge({ name, color }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className="gap-1.5"
      style={{ borderColor: color, color }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {name}
    </Badge>
  );
}
