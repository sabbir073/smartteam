export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { NOTIFICATION_TYPES } from "@/lib/constants";

// GET /api/cron/deadline-check - Vercel Cron: every hour
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Get non-terminal statuses
  const { data: activeStatuses } = await supabase
    .from("order_statuses")
    .select("id")
    .eq("is_terminal", false);

  if (!activeStatuses || activeStatuses.length === 0) {
    return NextResponse.json({ success: true, notified: 0 });
  }

  const activeStatusIds = activeStatuses.map((s) => s.id);

  // Find orders with deadline in next 24h
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, assigned_to, deadline")
    .in("status_id", activeStatusIds)
    .not("assigned_to", "is", null)
    .not("deadline", "is", null)
    .gte("deadline", now.toISOString())
    .lte("deadline", in24h.toISOString());

  let notified = 0;
  for (const order of orders || []) {
    if (order.assigned_to) {
      // Check if already notified (avoid duplicates)
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", order.assigned_to)
        .eq("type", NOTIFICATION_TYPES.DEADLINE_APPROACHING)
        .contains("data", { orderId: order.id })
        .gte("created_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (!existing || existing.length === 0) {
        await createNotification({
          userId: order.assigned_to,
          type: NOTIFICATION_TYPES.DEADLINE_APPROACHING,
          title: "Deadline Approaching",
          message: `Order ${order.order_number} deadline is within 24 hours.`,
          data: { orderId: order.id, orderNumber: order.order_number },
        });
        notified++;
      }
    }
  }

  return NextResponse.json({ success: true, notified });
}
