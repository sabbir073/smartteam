export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { logAudit, getRequestMeta } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().optional(),
  sort_order: z.number().int().optional(),
  is_default: z.boolean().optional(),
  is_terminal: z.boolean().optional(),
});

// PATCH /api/order-statuses/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "settings", "edit");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  // If setting as default, unset current default
  if (parsed.data.is_default) {
    await supabase.from("order_statuses").update({ is_default: false }).eq("is_default", true);
  }

  const { data: existing } = await supabase.from("order_statuses").select("*").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase.from("order_statuses").update(parsed.data).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const meta = getRequestMeta(request);
  await logAudit({ userId: session.user.id, action: "update", module: "settings", entityType: "order_status", entityId: id, oldValues: existing, newValues: parsed.data, ...meta });

  return NextResponse.json({ data });
}

// DELETE /api/order-statuses/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "settings", "delete");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Check if status is in use
  const { data: orders } = await supabase.from("orders").select("id").eq("status_id", id).limit(1);
  if (orders && orders.length > 0) {
    return NextResponse.json({ error: "Cannot delete status in use by orders" }, { status: 400 });
  }

  const { data: existing } = await supabase.from("order_statuses").select("*").eq("id", id).single();
  const { error } = await supabase.from("order_statuses").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const meta = getRequestMeta(request);
  await logAudit({ userId: session.user.id, action: "delete", module: "settings", entityType: "order_status", entityId: id, oldValues: existing, ...meta });

  return NextResponse.json({ success: true });
}
