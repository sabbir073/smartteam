export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  current_password: z.string().optional(),
  new_password: z.string().min(6).optional(),
});

// GET /api/profile — get current user's profile
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, company_id, avatar_url, created_at")
    .eq("id", session.user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get role
  const { data: ur } = await supabase
    .from("user_roles")
    .select("roles:role_id(name)")
    .eq("user_id", session.user.id)
    .single();

  const role = ur?.roles ? (Array.isArray(ur.roles) ? ur.roles[0] : ur.roles) : null;

  return NextResponse.json({
    data: { ...data, role_name: (role as Record<string, string>)?.name || "No role" },
  });
}

// PATCH /api/profile — update name or password
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });

  const { name, email, current_password, new_password } = parsed.data;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (name) update.name = name;

  // Email change — check for duplicates
  if (email) {
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .neq("id", session.user.id)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
    update.email = email;
  }

  // Password change requires current password verification
  if (new_password) {
    if (!current_password) {
      return NextResponse.json({ error: "Current password is required" }, { status: 400 });
    }

    const { data: user } = await supabase
      .from("users")
      .select("password_hash")
      .eq("id", session.user.id)
      .single();

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    update.password_hash = await bcrypt.hash(new_password, 12);
  }

  const { error } = await supabase
    .from("users")
    .update(update)
    .eq("id", session.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
