export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { logAudit, getRequestMeta } from "@/lib/audit";

// GET /api/settings
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase.from("system_settings").select("*").order("key");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const settings: Record<string, unknown> = {};
  for (const row of data || []) settings[row.key] = row.value;

  return NextResponse.json({ data: settings });
}

// PATCH /api/settings
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "settings", "edit");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json() as Record<string, unknown>;

  for (const [key, value] of Object.entries(body)) {
    await supabase
      .from("system_settings")
      .upsert(
        { key, value: JSON.parse(JSON.stringify(value)), updated_by: session.user.id, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
  }

  const meta = getRequestMeta(request);
  await logAudit({ userId: session.user.id, action: "update", module: "settings", entityType: "system_settings", newValues: body, ...meta });

  return NextResponse.json({ success: true });
}
