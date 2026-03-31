export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { logAudit, getRequestMeta } from "@/lib/audit";
import { z } from "zod";

const createSchema = z.object({
  platform_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  profile_url: z.string().url().optional().or(z.literal("")).nullable(),
  description: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});

// GET /api/platform-profiles
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "profiles", "view");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const platformId = request.nextUrl.searchParams.get("platform_id");
  const activeOnly = request.nextUrl.searchParams.get("active_only");

  let query = supabase
    .from("platform_profiles")
    .select("*, platforms:platform_id(id, name)")
    .order("name");

  if (platformId) query = query.eq("platform_id", platformId);
  if (activeOnly === "true") query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

// POST /api/platform-profiles
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "profiles", "create");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });

  const { data: profile, error } = await supabase
    .from("platform_profiles")
    .insert({
      platform_id: parsed.data.platform_id,
      name: parsed.data.name,
      profile_url: parsed.data.profile_url || null,
      description: parsed.data.description || null,
      is_active: parsed.data.is_active ?? true,
    })
    .select("*, platforms:platform_id(id, name)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const meta = getRequestMeta(request);
  await logAudit({
    userId: session.user.id, action: "create", module: "profiles",
    entityType: "platform_profile", entityId: profile.id,
    newValues: { name: parsed.data.name }, ...meta,
  });

  return NextResponse.json({ data: profile }, { status: 201 });
}
