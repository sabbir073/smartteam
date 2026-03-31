export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { logAudit, getRequestMeta } from "@/lib/audit";
import { calculateOrderAmounts } from "@/lib/order-utils";
import { z } from "zod";

const updateSchema = z.object({
  order_date: z.string().optional(),
  platform_id: z.string().uuid().optional(),
  platform_profile_id: z.string().uuid().optional().nullable(),
  client_name: z.string().min(1).optional(),
  external_order_id: z.string().optional().nullable(),
  order_link: z.string().optional().nullable(),
  gross_amount: z.number().positive().optional(),
  deadline: z.string().optional().nullable(),
  delivery_time: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// GET /api/special-orders/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "special-orders", "view");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: order, error } = await supabase
    .from("special_orders")
    .select(`
      *,
      platforms:platform_id(id, name, charge_percentage),
      order_statuses:status_id(id, name, color, is_terminal),
      platform_profiles:platform_profile_id(id, name, profile_url),
      created_by_user:created_by(id, name, email),
      special_order_files(*),
      special_order_status_history(*, from_status:from_status_id(name, color), to_status:to_status_id(name, color), changed_by_user:changed_by(id, name))
    `)
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: order });
}

// PATCH /api/special-orders/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "special-orders", "edit");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const { data: existing } = await supabase.from("special_orders").select("*").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const d = parsed.data;

  if (d.order_date !== undefined) update.order_date = d.order_date;
  if (d.client_name !== undefined) update.client_name = d.client_name;
  if (d.external_order_id !== undefined) update.external_order_id = d.external_order_id;
  if (d.platform_profile_id !== undefined) update.platform_profile_id = d.platform_profile_id;
  if (d.order_link !== undefined) update.order_link = d.order_link;
  if (d.deadline !== undefined) update.deadline = d.deadline;
  if (d.delivery_time !== undefined) update.delivery_time = d.delivery_time;
  if (d.notes !== undefined) update.notes = d.notes;

  if (d.gross_amount !== undefined || d.platform_id !== undefined) {
    const platformId = d.platform_id || existing.platform_id;
    const grossAmount = d.gross_amount || existing.gross_amount;
    const { data: platform } = await supabase.from("platforms").select("charge_percentage").eq("id", platformId).single();
    if (platform) {
      const { platformCharge, netAmount } = calculateOrderAmounts(grossAmount, platform.charge_percentage);
      update.platform_id = platformId;
      update.gross_amount = grossAmount;
      update.platform_charge = platformCharge;
      update.net_amount = netAmount;
    }
  }

  const { data: order, error } = await supabase.from("special_orders").update(update).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const meta = getRequestMeta(request);
  await logAudit({ userId: session.user.id, action: "update", module: "special-orders", entityType: "special_order", entityId: id, newValues: update, ...meta });

  return NextResponse.json({ data: order });
}

// DELETE /api/special-orders/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "special-orders", "delete");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabase.from("special_orders").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const meta = getRequestMeta(request);
  await logAudit({ userId: session.user.id, action: "delete", module: "special-orders", entityType: "special_order", entityId: id, ...meta });

  return NextResponse.json({ success: true });
}
