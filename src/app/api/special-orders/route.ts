export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { logAudit, getRequestMeta } from "@/lib/audit";
import { calculateOrderAmounts } from "@/lib/order-utils";
import { z } from "zod";
import { format } from "date-fns";

const createSchema = z.object({
  order_date: z.string().optional(),
  platform_id: z.string().uuid(),
  platform_profile_id: z.string().uuid().optional().nullable(),
  client_name: z.string().min(1),
  external_order_id: z.string().optional().nullable(),
  order_link: z.string().optional().nullable(),
  gross_amount: z.number().positive(),
  deadline: z.string().optional().nullable(),
  delivery_time: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

async function generateSpecialOrderNumber(): Promise<string> {
  const prefix = `SPO-${format(new Date(), "yyyyMM")}`;
  const { data } = await supabase
    .from("special_orders")
    .select("order_number")
    .like("order_number", `${prefix}%`)
    .order("order_number", { ascending: false })
    .limit(1);

  let next = 1;
  if (data && data.length > 0) {
    const last = parseInt(data[0].order_number.split("-")[2], 10);
    next = last + 1;
  }
  return `${prefix}-${String(next).padStart(4, "0")}`;
}

// GET /api/special-orders
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "special-orders", "view");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const page = parseInt(sp.get("page") || "1");
  const pageSize = parseInt(sp.get("pageSize") || "20");
  const search = sp.get("search") || "";
  const platformId = sp.get("platform_id") || "";
  const statusId = sp.get("status_id") || "";

  let query = supabase
    .from("special_orders")
    .select(`
      *,
      platforms:platform_id(id, name, charge_percentage),
      order_statuses:status_id(id, name, color, is_terminal),
      platform_profiles:platform_profile_id(id, name, profile_url),
      created_by_user:created_by(id, name, email)
    `, { count: "exact" });

  if (search) {
    query = query.or(`client_name.ilike.%${search}%,order_number.ilike.%${search}%,external_order_id.ilike.%${search}%,notes.ilike.%${search}%`);
  }
  if (platformId) query = query.eq("platform_id", platformId);
  if (statusId) query = query.eq("status_id", statusId);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, total: count || 0, page, pageSize, totalPages: Math.ceil((count || 0) / pageSize) });
}

// POST /api/special-orders
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "special-orders", "create");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });

  const d = parsed.data;

  const { data: platform } = await supabase.from("platforms").select("charge_percentage").eq("id", d.platform_id).single();
  if (!platform) return NextResponse.json({ error: "Platform not found" }, { status: 400 });

  const { platformCharge, netAmount } = calculateOrderAmounts(d.gross_amount, platform.charge_percentage);

  const { data: defaultStatus } = await supabase.from("order_statuses").select("id").eq("is_default", true).single();
  if (!defaultStatus) return NextResponse.json({ error: "No default status" }, { status: 400 });

  const orderNumber = await generateSpecialOrderNumber();

  const { data: order, error } = await supabase
    .from("special_orders")
    .insert({
      order_number: orderNumber,
      order_date: d.order_date || new Date().toISOString().split("T")[0],
      platform_id: d.platform_id,
      platform_profile_id: d.platform_profile_id || null,
      client_name: d.client_name,
      external_order_id: d.external_order_id || null,
      order_link: d.order_link || null,
      gross_amount: d.gross_amount,
      platform_charge: platformCharge,
      net_amount: netAmount,
      status_id: defaultStatus.id,
      deadline: d.deadline || null,
      delivery_time: d.delivery_time || null,
      notes: d.notes || null,
      created_by: session.user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("special_order_status_history").insert({
    special_order_id: order.id, from_status_id: null, to_status_id: defaultStatus.id,
    changed_by: session.user.id, notes: "Special order created",
  });

  const meta = getRequestMeta(request);
  await logAudit({
    userId: session.user.id, action: "create", module: "special-orders",
    entityType: "special_order", entityId: order.id,
    newValues: { order_number: orderNumber, client_name: d.client_name, gross_amount: d.gross_amount }, ...meta,
  });

  return NextResponse.json({ data: order }, { status: 201 });
}
