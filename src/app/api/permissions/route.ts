export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";

// GET /api/permissions - List all available permissions
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: permissions, error } = await supabase
    .from("permissions")
    .select("*")
    .order("module")
    .order("action")
    .order("data_scope");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ permissions });
}
