export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

// GET /api/cron/cleanup-audit - Vercel Cron: daily at 2 AM
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: setting } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "audit_retention_days")
    .single();

  const retentionDays = parseInt(String(setting?.value || "365"));
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const { error, count } = await supabase
    .from("audit_logs")
    .delete()
    .lt("created_at", cutoffDate.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted: count, cutoffDate: cutoffDate.toISOString() });
}
