export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { logAudit, getRequestMeta } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().optional(),
  sort_order: z.number().int().optional(),
  is_default: z.boolean().optional(),
  is_terminal: z.boolean().optional(),
});

// GET /api/order-statuses
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase.from("order_statuses").select("*").order("sort_order");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

// POST /api/order-statuses
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "settings", "create");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });

  // If setting as default, unset current default
  if (parsed.data.is_default) {
    await supabase.from("order_statuses").update({ is_default: false }).eq("is_default", true);
  }

  const { data, error } = await supabase.from("order_statuses").insert(parsed.data).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const meta = getRequestMeta(request);
  await logAudit({ userId: session.user.id, action: "create", module: "settings", entityType: "order_status", entityId: data.id, newValues: parsed.data, ...meta });

  return NextResponse.json({ data }, { status: 201 });
}
