export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { logAudit, getRequestMeta } from "@/lib/audit";
import { notifyRequisitionReviewed } from "@/lib/notifications";
import { z } from "zod";

const reviewSchema = z.object({
  status: z.enum(["approved", "rejected", "fulfilled"]),
  review_notes: z.string().optional(),
});

// PATCH /api/requisitions/[id] - Review/fulfill requisition
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "requisitions", "edit");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const { data: existing } = await supabase.from("tech_requisitions").select("*").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const update: Record<string, unknown> = { status: parsed.data.status };

  if (parsed.data.status === "approved" || parsed.data.status === "rejected") {
    update.reviewer_id = session.user.id;
    update.review_notes = parsed.data.review_notes || null;
    update.reviewed_at = new Date().toISOString();
  }

  if (parsed.data.status === "fulfilled") {
    update.fulfilled_by = session.user.id;
    update.fulfilled_at = new Date().toISOString();
  }

  const { data, error } = await supabase.from("tech_requisitions").update(update).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify requester
  if (parsed.data.status === "approved" || parsed.data.status === "rejected") {
    await notifyRequisitionReviewed(existing.requester_id, parsed.data.status, existing.item_description, id);
  }

  const meta = getRequestMeta(request);
  await logAudit({
    userId: session.user.id,
    action: parsed.data.status === "approved" ? "approve" : parsed.data.status === "rejected" ? "reject" : "update",
    module: "requisitions", entityType: "tech_requisition", entityId: id,
    oldValues: { status: existing.status }, newValues: update, ...meta,
  });

  return NextResponse.json({ data });
}

// DELETE /api/requisitions/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "requisitions", "delete");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: existing } = await supabase.from("tech_requisitions").select("*").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase.from("tech_requisitions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const meta = getRequestMeta(request);
  await logAudit({ userId: session.user.id, action: "delete", module: "requisitions", entityType: "tech_requisition", entityId: id, oldValues: existing, ...meta });

  return NextResponse.json({ success: true });
}
