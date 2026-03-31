export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { logAudit, getRequestMeta } from "@/lib/audit";
import { notifyOrderAssigned } from "@/lib/notifications";
import { calculateOrderAmounts } from "@/lib/order-utils";
import { z } from "zod";

const updateSchema = z.object({
  order_date: z.string().optional(),
  client_name: z.string().min(1).optional(),
  external_order_id: z.string().optional().nullable(),
  employee_id: z.string().uuid().optional().nullable(),
  platform_id: z.string().uuid().optional(),
  platform_profile_id: z.string().uuid().optional().nullable(),
  profile_name: z.string().optional().nullable(),
  order_link: z.string().optional().nullable(),
  gross_amount: z.number().positive().optional(),
  instruction_text: z.string().optional().nullable(),
  instruction_sheet_link: z.string().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  team_id: z.string().uuid().optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  service_category_id: z.string().uuid().optional().nullable(),
  service_line_id: z.string().uuid().optional().nullable(),
  deadline: z.string().optional().nullable(),
  delivery_time: z.string().optional().nullable(),
});

// GET /api/orders/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "orders", "view");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: order, error } = await supabase
    .from("orders")
    .select(`
      *,
      platforms:platform_id(id, name, charge_percentage),
      order_statuses:status_id(id, name, color, is_terminal),
      service_categories:service_category_id(id, name),
      service_lines:service_line_id(id, name),
      assigned_user:assigned_to(id, name, email, avatar_url, company_id),
      employee:employee_id(id, name, email, avatar_url, company_id),
      platform_profiles:platform_profile_id(id, name, profile_url),
      teams:team_id(id, name, type),
      departments:department_id(id, name),
      created_by_user:created_by(id, name, email),
      order_files(*),
      order_status_history(*, from_status:from_status_id(name, color), to_status:to_status_id(name, color), changed_by_user:changed_by(id, name))
    `)
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  return NextResponse.json({ data: order });
}

// PATCH /api/orders/[id]
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
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });

  const { data: existing } = await supabase.from("orders").select("*").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const d = parsed.data;

  if (d.order_date !== undefined) update.order_date = d.order_date;
  if (d.client_name !== undefined) update.client_name = d.client_name;
  if (d.external_order_id !== undefined) update.external_order_id = d.external_order_id;
  if (d.employee_id !== undefined) update.employee_id = d.employee_id;
  if (d.platform_profile_id !== undefined) update.platform_profile_id = d.platform_profile_id;
  if (d.profile_name !== undefined) update.profile_name = d.profile_name;
  if (d.order_link !== undefined) update.order_link = d.order_link;
  if (d.instruction_text !== undefined) update.instruction_text = d.instruction_text;
  if (d.instruction_sheet_link !== undefined) update.instruction_sheet_link = d.instruction_sheet_link;
  if (d.team_id !== undefined) update.team_id = d.team_id;
  if (d.department_id !== undefined) update.department_id = d.department_id;
  if (d.service_category_id !== undefined) update.service_category_id = d.service_category_id;
  if (d.service_line_id !== undefined) update.service_line_id = d.service_line_id;
  if (d.deadline !== undefined) update.deadline = d.deadline;
  if (d.delivery_time !== undefined) update.delivery_time = d.delivery_time;

  // Handle assignment change
  if (d.assigned_to !== undefined && d.assigned_to !== existing.assigned_to) {
    update.assigned_to = d.assigned_to;
    update.assigned_by = session.user.id;
    if (d.assigned_to) {
      await notifyOrderAssigned(d.assigned_to, existing.order_number, id);
    }
  }

  // Recalculate amounts if gross_amount or platform changed
  if (d.gross_amount !== undefined || d.platform_id !== undefined) {
    const platformId = d.platform_id || existing.platform_id;
    const grossAmount = d.gross_amount || existing.gross_amount;

    const { data: platform } = await supabase
      .from("platforms")
      .select("charge_percentage")
      .eq("id", platformId)
      .single();

    if (platform) {
      const { platformCharge, netAmount } = calculateOrderAmounts(grossAmount, platform.charge_percentage);
      update.platform_id = platformId;
      update.gross_amount = grossAmount;
      update.platform_charge = platformCharge;
      update.net_amount = netAmount;
    }
  }

  const { data: order, error } = await supabase.from("orders").update(update).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const meta = getRequestMeta(request);
  await logAudit({
    userId: session.user.id, action: "update", module: "orders",
    entityType: "order", entityId: id,
    oldValues: { client_name: existing.client_name, gross_amount: existing.gross_amount, assigned_to: existing.assigned_to },
    newValues: update, ...meta,
  });

  return NextResponse.json({ data: order });
}

// DELETE /api/orders/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "orders", "delete");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: existing } = await supabase.from("orders").select("*").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const meta = getRequestMeta(request);
  await logAudit({
    userId: session.user.id, action: "delete", module: "orders",
    entityType: "order", entityId: id,
    oldValues: { order_number: existing.order_number, client_name: existing.client_name }, ...meta,
  });

  return NextResponse.json({ success: true });
}
