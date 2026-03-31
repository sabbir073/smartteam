export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { logAudit, getRequestMeta } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({
  item_name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  assigned_to: z.string().uuid().optional().nullable(),
  purchase_date: z.string().optional(),
  cost: z.number().optional(),
  status: z.enum(["active", "retired", "under_repair"]).optional(),
  serial_number: z.string().optional(),
  notes: z.string().optional(),
});

// PATCH /api/inventory/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "inventory", "edit");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const { data: existing } = await supabase.from("tech_inventory").select("*").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase.from("tech_inventory").update({ ...parsed.data, updated_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const meta = getRequestMeta(request);
  await logAudit({ userId: session.user.id, action: "update", module: "inventory", entityType: "tech_inventory", entityId: id, oldValues: existing, newValues: parsed.data, ...meta });

  return NextResponse.json({ data });
}

// DELETE /api/inventory/[id]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "inventory", "delete");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: existing } = await supabase.from("tech_inventory").select("*").eq("id", id).single();
  const { error } = await supabase.from("tech_inventory").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const meta = getRequestMeta(request);
  await logAudit({ userId: session.user.id, action: "delete", module: "inventory", entityType: "tech_inventory", entityId: id, oldValues: existing, ...meta });

  return NextResponse.json({ success: true });
}
