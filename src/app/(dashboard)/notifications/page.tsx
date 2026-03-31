"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import type { Notification } from "@/types";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications?limit=100");
      if (res.ok) { const json = await res.json(); setNotifications(json.data || []); }
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchNotifications(); }, []);

  async function markAllRead() {
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast.success("All marked as read");
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_read: true }) });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) return <div className="space-y-6"><Skeleton className="h-8 w-48" />{[1,2,3].map((i) => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" description={`${unreadCount} unread`}>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={markAllRead}><CheckCheck className="mr-2 h-4 w-4" />Mark All Read</Button>
        )}
      </PageHeader>

      {notifications.length === 0 ? (
        <Card><CardContent className="p-12 text-center"><Bell className="mx-auto h-12 w-12 text-muted-foreground mb-4" /><p className="text-muted-foreground">No notifications.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card key={n.id} className={`cursor-pointer transition-colors ${!n.is_read ? "border-primary/30 bg-primary/5" : ""}`} onClick={() => !n.is_read && markRead(n.id)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      {!n.is_read && <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
                      <h4 className="font-medium text-sm">{n.title}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">{n.message}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
