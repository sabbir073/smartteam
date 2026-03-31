export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { logAudit, getRequestMeta } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({
  attribution_mode: z.enum(["sales", "operations", "split"]).optional(),
  sales_split_percentage: z.number().min(0).max(100).optional(),
  operations_split_percentage: z.number().min(0).max(100).optional(),
  cost_entry_role_ids: z.array(z.string().uuid()).optional(),
});

// GET /api/revenue/settings
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase.from("revenue_settings").select("*").limit(1).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

// PATCH /api/revenue/settings
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "settings", "edit");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const { data: existing } = await supabase.from("revenue_settings").select("*").limit(1).single();

  const updateData = { ...parsed.data, updated_by: session.user.id, updated_at: new Date().toISOString() };

  const { data, error } = await supabase
    .from("revenue_settings")
    .update(updateData)
    .eq("id", existing?.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const meta = getRequestMeta(request);
  await logAudit({ userId: session.user.id, action: "update", module: "settings", entityType: "revenue_settings", oldValues: existing, newValues: updateData, ...meta });

  return NextResponse.json({ data });
}
