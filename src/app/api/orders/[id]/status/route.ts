export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { logAudit, getRequestMeta } from "@/lib/audit";
import { notifyOrderStatusChanged } from "@/lib/notifications";
import { z } from "zod";

const schema = z.object({
  status_id: z.string().uuid(),
  notes: z.string().optional(),
});

// PATCH /api/orders/[id]/status - Change order status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "orders", "edit");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const { data: order } = await supabase.from("orders").select("*, order_statuses:status_id(name)").eq("id", id).single();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (order.status_id === parsed.data.status_id) {
    return NextResponse.json({ error: "Order already has this status" }, { status: 400 });
  }

  // Get new status name
  const { data: newStatus } = await supabase.from("order_statuses").select("name").eq("id", parsed.data.status_id).single();
  if (!newStatus) return NextResponse.json({ error: "Status not found" }, { status: 404 });

  // Update order status
  await supabase.from("orders").update({
    status_id: parsed.data.status_id,
    updated_at: new Date().toISOString(),
  }).eq("id", id);

  // Create status history entry
  await supabase.from("order_status_history").insert({
    order_id: id,
    from_status_id: order.status_id,
    to_status_id: parsed.data.status_id,
    changed_by: session.user.id,
    notes: parsed.data.notes || null,
  });

  // Notify relevant users
  const recipients = [order.created_by, order.assigned_to].filter(Boolean) as string[];
  const uniqueRecipients = [...new Set(recipients)].filter((r) => r !== session.user.id);
  await notifyOrderStatusChanged(uniqueRecipients, order.order_number, id, newStatus.name);

  const meta = getRequestMeta(request);
  const oldStatusData = order.order_statuses as unknown as { name: string } | null;
  await logAudit({
    userId: session.user.id, action: "update", module: "orders",
    entityType: "order", entityId: id,
    oldValues: { status: oldStatusData?.name },
    newValues: { status: newStatus.name, notes: parsed.data.notes }, ...meta,
  });

  return NextResponse.json({ success: true });
}
