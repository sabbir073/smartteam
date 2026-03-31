export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission, getFilteredUserIds } from "@/lib/permissions";
import { logAudit, getRequestMeta } from "@/lib/audit";
import { notifyOrderCreated } from "@/lib/notifications";
import { calculateOrderAmounts, generateOrderNumber } from "@/lib/order-utils";
import { z } from "zod";

const createOrderSchema = z.object({
  order_date: z.string().optional(),
  // Employee who got the order (sales person)
  employee_id: z.string().uuid().optional().nullable(),
  // Platform details
  platform_id: z.string().uuid(),
  platform_profile_id: z.string().uuid().optional().nullable(),
  profile_name: z.string().optional().nullable(),
  client_name: z.string().min(1),
  external_order_id: z.string().optional().nullable(),
  order_link: z.string().optional().nullable(),
  gross_amount: z.number().positive(),
  instruction_text: z.string().optional().nullable(),
  instruction_sheet_link: z.string().optional().nullable(),
  // Assignment
  assigned_to: z.string().uuid().optional().nullable(),
  team_id: z.string().uuid().optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  service_category_id: z.string().uuid().optional().nullable(),
  service_line_id: z.string().uuid().optional().nullable(),
  // Timing
  deadline: z.string().optional().nullable(),
  delivery_time: z.string().optional().nullable(),
});

// GET /api/orders - List orders with filters
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "orders", "view");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const page = parseInt(sp.get("page") || "1");
  const pageSize = parseInt(sp.get("pageSize") || "20");
  const search = sp.get("search") || "";
  const platformId = sp.get("platform_id") || "";
  const statusId = sp.get("status_id") || "";
  const serviceCategoryId = sp.get("service_category_id") || "";
  const assignedTo = sp.get("assigned_to") || "";

  let query = supabase
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
      created_by_user:created_by(id, name, email)
    `, { count: "exact" });

  // Data scope filtering
  const filteredIds = await getFilteredUserIds(perm.dataScope, session.user.id);
  if (filteredIds) {
    query = query.or(`assigned_to.in.(${filteredIds.join(",")}),created_by.in.(${filteredIds.join(",")}),employee_id.in.(${filteredIds.join(",")})`);
  }

  // Filters
  if (search) {
    query = query.or(`client_name.ilike.%${search}%,order_number.ilike.%${search}%,external_order_id.ilike.%${search}%,profile_name.ilike.%${search}%`);
  }
  if (platformId) query = query.eq("platform_id", platformId);
  if (statusId) query = query.eq("status_id", statusId);
  if (serviceCategoryId) query = query.eq("service_category_id", serviceCategoryId);
  if (assignedTo) query = query.eq("assigned_to", assignedTo);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    data,
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  });
}

// POST /api/orders - Create order
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "orders", "create");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Get platform charge percentage
  const { data: platform } = await supabase
    .from("platforms")
    .select("charge_percentage")
    .eq("id", data.platform_id)
    .single();

  if (!platform) return NextResponse.json({ error: "Platform not found" }, { status: 400 });

  const { platformCharge, netAmount } = calculateOrderAmounts(data.gross_amount, platform.charge_percentage);

  // Get default status
  const { data: defaultStatus } = await supabase
    .from("order_statuses")
    .select("id")
    .eq("is_default", true)
    .single();

  if (!defaultStatus) return NextResponse.json({ error: "No default order status configured" }, { status: 400 });

  const orderNumber = await generateOrderNumber();

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      order_date: data.order_date || new Date().toISOString().split("T")[0],
      employee_id: data.employee_id || null,
      platform_id: data.platform_id,
      platform_profile_id: data.platform_profile_id || null,
      profile_name: data.profile_name || null,
      client_name: data.client_name,
      client_profile_url: null,
      external_order_id: data.external_order_id || null,
      order_link: data.order_link || null,
      gross_amount: data.gross_amount,
      platform_charge: platformCharge,
      net_amount: netAmount,
      instruction_text: data.instruction_text || null,
      instruction_sheet_link: data.instruction_sheet_link || null,
      assigned_to: data.assigned_to || null,
      assigned_by: data.assigned_to ? session.user.id : null,
      team_id: data.team_id || null,
      department_id: data.department_id || null,
      service_category_id: data.service_category_id || null,
      service_line_id: data.service_line_id || null,
      status_id: defaultStatus.id,
      deadline: data.deadline || null,
      delivery_time: data.delivery_time || null,
      created_by: session.user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Create initial status history
  await supabase.from("order_status_history").insert({
    order_id: order.id,
    from_status_id: null,
    to_status_id: defaultStatus.id,
    changed_by: session.user.id,
    notes: "Order created",
  });

  // Notifications
  if (data.assigned_to) {
    const { data: teamMember } = await supabase
      .from("team_members")
      .select("team_id, teams:team_id(leader_id)")
      .eq("user_id", data.assigned_to)
      .limit(1)
      .single();

    const teamData = teamMember?.teams as unknown as { leader_id: string } | null;
    const leaderId = teamData?.leader_id || null;

    await notifyOrderCreated(data.assigned_to, leaderId, orderNumber, order.id);
  }

  const meta = getRequestMeta(request);
  await logAudit({
    userId: session.user.id, action: "create", module: "orders",
    entityType: "order", entityId: order.id,
    newValues: { order_number: orderNumber, client_name: data.client_name, gross_amount: data.gross_amount, net_amount: netAmount },
    ...meta,
  });

  return NextResponse.json({ data: order }, { status: 201 });
}
