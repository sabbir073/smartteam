"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMessaging } from "@/providers/messaging-provider";

export function MessageIcon() {
  const { totalUnread, togglePanel } = useMessaging();

  return (
    <Button variant="ghost" size="icon" className="relative" onClick={togglePanel}>
      <MessageCircle className="h-4 w-4" />
      {totalUnread > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]"
        >
          {totalUnread > 99 ? "99+" : totalUnread}
        </Badge>
      )}
      <span className="sr-only">Messages</span>
    </Button>
  );
}
