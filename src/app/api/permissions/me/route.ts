export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserPermissions } from "@/lib/permissions";

// GET /api/permissions/me - Get current user's permissions
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const permissions = await getUserPermissions(session.user.id);

  return NextResponse.json({ permissions });
}
