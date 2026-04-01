export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { logAudit, getRequestMeta } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).max(100).optional(),
  charge_percentage: z.number().min(0).max(100).optional(),
  bdt_conversion_rate: z.number().min(0).optional(),
  is_active: z.boolean().optional(),
});

// PATCH /api/platforms/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "platforms", "edit");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const { data: existing } = await supabase.from("platforms").select("*").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase.from("platforms").update(parsed.data).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const meta = getRequestMeta(request);
  await logAudit({ userId: session.user.id, action: "update", module: "platforms", entityType: "platform", entityId: id, oldValues: existing, newValues: parsed.data, ...meta });

  return NextResponse.json({ data });
}

// DELETE /api/platforms/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "platforms", "delete");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Check if platform has orders
  const { data: orders } = await supabase.from("orders").select("id").eq("platform_id", id).limit(1);
  if (orders && orders.length > 0) {
    return NextResponse.json({ error: "Cannot delete platform with existing orders. Deactivate it instead." }, { status: 400 });
  }

  const { data: existing } = await supabase.from("platforms").select("*").eq("id", id).single();
  const { error } = await supabase.from("platforms").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const meta = getRequestMeta(request);
  await logAudit({ userId: session.user.id, action: "delete", module: "platforms", entityType: "platform", entityId: id, oldValues: existing, ...meta });

  return NextResponse.json({ success: true });
}
