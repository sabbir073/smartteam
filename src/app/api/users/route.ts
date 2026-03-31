export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission, getFilteredUserIds } from "@/lib/permissions";
import { logAudit, getRequestMeta } from "@/lib/audit";
import { notifyUserCreated } from "@/lib/notifications";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).max(100),
  role_id: z.string().uuid(),
  department_id: z.string().uuid().optional().nullable(),
  company_id: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});

// GET /api/users - List users
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perm = await checkPermission(session.user.id, "users", "view");
  if (!perm.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "20");
  const search = searchParams.get("search") || "";
  const roleId = searchParams.get("role_id") || "";
  const isActive = searchParams.get("is_active");

  let query = supabase
    .from("users")
    .select(
      `*, user_roles!user_roles_user_id_fkey(role_id, roles:role_id(id, name, level))`,
      { count: "exact" }
    );

  // Apply data scope filter
  const filteredIds = await getFilteredUserIds(perm.dataScope, session.user.id);
  if (filteredIds) {
    query = query.in("id", filteredIds);
  }

  // Apply filters
  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
  }
  if (roleId) {
    query = query.eq("user_roles.role_id", roleId);
  }
  if (isActive !== null && isActive !== undefined && isActive !== "") {
    query = query.eq("is_active", isActive === "true");
  }

  // Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: users, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Clean up password_hash from response
  const cleanUsers = users?.map((u) => {
    const { password_hash, ...rest } = u;
    return rest;
  });

  return NextResponse.json({
    data: cleanUsers,
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  });
}

// POST /api/users - Create user (admin only)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perm = await checkPermission(session.user.id, "users", "create");
  if (!perm.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, password, name, role_id, department_id, company_id, is_active } = parsed.data;

  // Hash password
  const password_hash = await bcrypt.hash(password, 12);

  // Create user
  const { data: user, error } = await supabase
    .from("users")
    .insert({
      email,
      password_hash,
      name,
      department_id: department_id || null,
      company_id: company_id || null,
      is_active: is_active ?? true,
      created_by: session.user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Assign role
  await supabase.from("user_roles").insert({
    user_id: user.id,
    role_id,
    assigned_by: session.user.id,
  });

  // Notify new user
  await notifyUserCreated(user.id, user.name);

  const meta = getRequestMeta(request);
  await logAudit({
    userId: session.user.id,
    action: "create",
    module: "users",
    entityType: "user",
    entityId: user.id,
    newValues: { email, name, role_id },
    ...meta,
  });

  const { password_hash: _, ...cleanUser } = user;
  return NextResponse.json({ data: cleanUser }, { status: 201 });
}
