export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";

// GET /api/conversations/users — all active users for messaging (no data scope filter)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "messages", "create");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, avatar_url, company_id")
    .eq("is_active", true)
    .neq("id", session.user.id)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}
