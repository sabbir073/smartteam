/**
 * Seed Dummy Data Script
 *
 * Run with: npx tsx scripts/seed-dummy-data.ts
 *
 * Seeds: Roles, Users, Departments, Services, Teams, Order Statuses (already exist),
 *        Platforms (already exist), Orders, Targets, Requisitions, Inventory
 */

import { createClient } from "@supabase/supabase-js";
import { hash } from "bcryptjs";

// ─── Config ────────────────────────────────────────────────────
const SUPABASE_URL = "https://ugkwelfuwavlenfeouok.supabase.co";
const SUPABASE_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVna3dlbGZ1d2F2bGVuZmVvdW9rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg3ODY4MCwiZXhwIjoyMDkwNDU0NjgwfQ.UxS6V8WGRd5NjgtcBeKFnxwNwO9Q_HagJipUEuWvuGQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMIN_USER_ID = "00000000-0000-0000-0000-000000000002";
const DEFAULT_PASSWORD = "Test@123";

// ─── Helpers ───────────────────────────────────────────────────
function log(step: string, msg: string) {
  console.log(`  [${step}] ${msg}`);
}

async function getPermissionIds(
  module: string,
  actions: string[],
  scope: string = "all"
): Promise<string[]> {
  const { data } = await supabase
    .from("permissions")
    .select("id")
    .eq("module", module)
    .eq("data_scope", scope)
    .in("action", actions);
  return (data || []).map((p) => p.id);
}

async function assignPermissions(roleId: string, permIds: string[]) {
  if (permIds.length === 0) return;
  const rows = permIds.map((pid) => ({ role_id: roleId, permission_id: pid }));
  await supabase.from("role_permissions").upsert(rows, { onConflict: "role_id,permission_id" });
}

// ─── 1. ROLES ──────────────────────────────────────────────────
async function seedRoles() {
  console.log("\n1. Seeding Roles...");

  const roles = [
    { name: "Member", description: "Team member with basic access to assigned work", level: 5 },
    { name: "Team Leader", description: "Leads a service team (Sales or Operations)", level: 4 },
    { name: "Department Head", description: "Manages a department with full team oversight", level: 3 },
    { name: "Boss", description: "Executive with full view access (read-only admin)", level: 1 },
  ];

  const createdRoles: Record<string, string> = {};

  for (const role of roles) {
    const { data, error } = await supabase
      .from("roles")
      .upsert(role, { onConflict: "name" })
      .select("id")
      .single();

    if (error) {
      log("Roles", `SKIP ${role.name}: ${error.message}`);
      // Try to fetch existing
      const { data: existing } = await supabase
        .from("roles")
        .select("id")
        .eq("name", role.name)
        .single();
      if (existing) createdRoles[role.name] = existing.id;
    } else {
      createdRoles[role.name] = data.id;
      log("Roles", `Created: ${role.name}`);
    }
  }

  // Assign permissions to each role
  // ─ Member: own-scope on dashboard, orders, targets, revenue, requisitions
  const memberPerms = [
    ...(await getPermissionIds("dashboard", ["view"], "own")),
    ...(await getPermissionIds("orders", ["view"], "own")),
    ...(await getPermissionIds("targets", ["view"], "own")),
    ...(await getPermissionIds("revenue", ["view"], "own")),
    ...(await getPermissionIds("requisitions", ["view", "create"], "own")),
    ...(await getPermissionIds("inventory", ["view"], "own")),
  ];
  if (createdRoles["Member"]) {
    await assignPermissions(createdRoles["Member"], memberPerms);
    log("Roles", `Assigned ${memberPerms.length} permissions to Member`);
  }

  // ─ Team Leader: team-scope on most modules
  const tlPerms = [
    ...(await getPermissionIds("dashboard", ["view"], "team")),
    ...(await getPermissionIds("orders", ["view", "create", "edit"], "team")),
    ...(await getPermissionIds("users", ["view"], "team")),
    ...(await getPermissionIds("teams", ["view", "edit"], "team")),
    ...(await getPermissionIds("services", ["view"], "all")),
    ...(await getPermissionIds("platforms", ["view"], "all")),
    ...(await getPermissionIds("targets", ["view", "create", "edit"], "team")),
    ...(await getPermissionIds("revenue", ["view"], "team")),
    ...(await getPermissionIds("reports", ["view"], "team")),
    ...(await getPermissionIds("requisitions", ["view", "create"], "team")),
    ...(await getPermissionIds("inventory", ["view"], "team")),
  ];
  if (createdRoles["Team Leader"]) {
    await assignPermissions(createdRoles["Team Leader"], tlPerms);
    log("Roles", `Assigned ${tlPerms.length} permissions to Team Leader`);
  }

  // ─ Department Head: department-scope + settings
  const dhPerms = [
    ...(await getPermissionIds("dashboard", ["view"], "department")),
    ...(await getPermissionIds("orders", ["view", "create", "edit", "delete"], "department")),
    ...(await getPermissionIds("users", ["view", "create", "edit"], "department")),
    ...(await getPermissionIds("roles", ["view"], "all")),
    ...(await getPermissionIds("teams", ["view", "create", "edit", "delete"], "department")),
    ...(await getPermissionIds("services", ["view"], "all")),
    ...(await getPermissionIds("platforms", ["view"], "all")),
    ...(await getPermissionIds("targets", ["view", "create", "edit", "delete"], "department")),
    ...(await getPermissionIds("revenue", ["view"], "department")),
    ...(await getPermissionIds("reports", ["view", "create"], "department")),
    ...(await getPermissionIds("requisitions", ["view", "create", "edit"], "department")),
    ...(await getPermissionIds("inventory", ["view", "create", "edit"], "department")),
    ...(await getPermissionIds("audit-logs", ["view"], "department")),
  ];
  if (createdRoles["Department Head"]) {
    await assignPermissions(createdRoles["Department Head"], dhPerms);
    log("Roles", `Assigned ${dhPerms.length} permissions to Department Head`);
  }

  // ─ Boss: all-scope VIEW on everything
  const bossPerms = [
    ...(await getPermissionIds("dashboard", ["view"], "all")),
    ...(await getPermissionIds("orders", ["view"], "all")),
    ...(await getPermissionIds("users", ["view"], "all")),
    ...(await getPermissionIds("roles", ["view"], "all")),
    ...(await getPermissionIds("teams", ["view"], "all")),
    ...(await getPermissionIds("services", ["view"], "all")),
    ...(await getPermissionIds("platforms", ["view"], "all")),
    ...(await getPermissionIds("targets", ["view"], "all")),
    ...(await getPermissionIds("revenue", ["view"], "all")),
    ...(await getPermissionIds("reports", ["view", "create"], "all")),
    ...(await getPermissionIds("requisitions", ["view"], "all")),
    ...(await getPermissionIds("inventory", ["view"], "all")),
    ...(await getPermissionIds("audit-logs", ["view"], "all")),
    ...(await getPermissionIds("settings", ["view"], "all")),
  ];
  if (createdRoles["Boss"]) {
    await assignPermissions(createdRoles["Boss"], bossPerms);
    log("Roles", `Assigned ${bossPerms.length} permissions to Boss`);
  }

  return createdRoles;
}

// ─── 2. DEPARTMENTS ────────────────────────────────────────────
async function seedDepartments() {
  console.log("\n2. Seeding Departments...");

  const depts = [
    { name: "Sales", description: "Client acquisition and order generation" },
    { name: "Operations", description: "Project execution and delivery" },
    { name: "Management", description: "Executive and leadership" },
  ];

  const created: Record<string, string> = {};

  for (const dept of depts) {
    const { data, error } = await supabase
      .from("departments")
      .insert(dept)
      .select("id")
      .single();

    if (error) {
      log("Depts", `SKIP ${dept.name}: ${error.message}`);
      const { data: existing } = await supabase
        .from("departments")
        .select("id")
        .eq("name", dept.name)
        .single();
      if (existing) created[dept.name] = existing.id;
    } else {
      created[dept.name] = data.id;
      log("Depts", `Created: ${dept.name}`);
    }
  }

  return created;
}

// ─── 3. SERVICES ───────────────────────────────────────────────
async function seedServices() {
  console.log("\n3. Seeding Services...");

  const serviceData = [
    {
      name: "FSD",
      description: "Full Stack Development",
      lines: ["UI/UX Design", "Frontend Development", "Backend Development"],
    },
    {
      name: "CMS",
      description: "Content Management Systems",
      lines: ["WordPress", "Shopify", "Custom CMS"],
    },
    {
      name: "Graphics",
      description: "Graphic Design Services",
      lines: ["PowerPoint Design", "Branding & Logo", "Social Media Design", "Motion Graphics"],
    },
  ];

  const created: Record<string, string> = {};

  for (const svc of serviceData) {
    const { data: cat, error } = await supabase
      .from("service_categories")
      .insert({ name: svc.name, description: svc.description })
      .select("id")
      .single();

    if (error) {
      log("Services", `SKIP ${svc.name}: ${error.message}`);
      const { data: existing } = await supabase
        .from("service_categories")
        .select("id")
        .eq("name", svc.name)
        .single();
      if (existing) {
        created[svc.name] = existing.id;
      }
      continue;
    }

    created[svc.name] = cat.id;
    log("Services", `Created category: ${svc.name}`);

    // Create service lines
    const lines = svc.lines.map((name) => ({
      service_category_id: cat.id,
      name,
    }));
    const { error: lineErr } = await supabase.from("service_lines").insert(lines);
    if (lineErr) {
      log("Services", `  Lines error: ${lineErr.message}`);
    } else {
      log("Services", `  Created ${lines.length} service lines`);
    }
  }

  return created;
}

// ─── 4. USERS ──────────────────────────────────────────────────
async function seedUsers(
  roles: Record<string, string>,
  departments: Record<string, string>
) {
  console.log("\n4. Seeding Users...");

  const passwordHash = await hash(DEFAULT_PASSWORD, 12);

  const usersData = [
    // Boss
    { name: "Ahmed Khan", email: "ahmed@smartlab.com", role: "Boss", dept: "Management" },
    // Department Heads
    { name: "Sara Ali", email: "sara@smartlab.com", role: "Department Head", dept: "Sales" },
    { name: "Omar Farooq", email: "omar@smartlab.com", role: "Department Head", dept: "Operations" },
    // Team Leaders
    { name: "Fatima Noor", email: "fatima@smartlab.com", role: "Team Leader", dept: "Sales" },
    { name: "Hassan Raza", email: "hassan@smartlab.com", role: "Team Leader", dept: "Sales" },
    { name: "Ayesha Malik", email: "ayesha@smartlab.com", role: "Team Leader", dept: "Operations" },
    { name: "Bilal Ahmed", email: "bilal@smartlab.com", role: "Team Leader", dept: "Operations" },
    // Members
    { name: "Zainab Shah", email: "zainab@smartlab.com", role: "Member", dept: "Sales" },
    { name: "Ali Hussain", email: "ali@smartlab.com", role: "Member", dept: "Sales" },
    { name: "Maryam Tariq", email: "maryam@smartlab.com", role: "Member", dept: "Sales" },
    { name: "Usman Ghani", email: "usman@smartlab.com", role: "Member", dept: "Operations" },
    { name: "Hira Khan", email: "hira@smartlab.com", role: "Member", dept: "Operations" },
    { name: "Kamran Iqbal", email: "kamran@smartlab.com", role: "Member", dept: "Operations" },
    { name: "Nadia Butt", email: "nadia@smartlab.com", role: "Member", dept: "Operations" },
    { name: "Rizwan Saeed", email: "rizwan@smartlab.com", role: "Member", dept: "Operations" },
  ];

  const created: Record<string, string> = {};

  for (const u of usersData) {
    const { data: user, error } = await supabase
      .from("users")
      .insert({
        email: u.email,
        password_hash: passwordHash,
        name: u.name,
        department_id: departments[u.dept] || null,
        is_active: true,
        created_by: ADMIN_USER_ID,
      })
      .select("id")
      .single();

    if (error) {
      log("Users", `SKIP ${u.name}: ${error.message}`);
      const { data: existing } = await supabase
        .from("users")
        .select("id")
        .eq("email", u.email)
        .single();
      if (existing) created[u.name] = existing.id;
      continue;
    }

    created[u.name] = user.id;

    // Assign role
    const roleId = roles[u.role];
    if (roleId) {
      await supabase.from("user_roles").upsert(
        { user_id: user.id, role_id: roleId, assigned_by: ADMIN_USER_ID },
        { onConflict: "user_id" }
      );
    }

    log("Users", `Created: ${u.name} (${u.role})`);
  }

  return created;
}

// ─── 5. TEAMS ──────────────────────────────────────────────────
async function seedTeams(
  users: Record<string, string>,
  services: Record<string, string>,
  departments: Record<string, string>
) {
  console.log("\n5. Seeding Teams...");

  const teamsData = [
    {
      name: "FSD Sales Team",
      type: "sales",
      service: "FSD",
      dept: "Sales",
      leader: "Fatima Noor",
      members: ["Zainab Shah", "Ali Hussain"],
    },
    {
      name: "Graphics Sales Team",
      type: "sales",
      service: "Graphics",
      dept: "Sales",
      leader: "Hassan Raza",
      members: ["Maryam Tariq"],
    },
    {
      name: "FSD Operations Team",
      type: "operations",
      service: "FSD",
      dept: "Operations",
      leader: "Ayesha Malik",
      members: ["Usman Ghani", "Hira Khan", "Kamran Iqbal"],
    },
    {
      name: "Graphics Operations Team",
      type: "operations",
      service: "Graphics",
      dept: "Operations",
      leader: "Bilal Ahmed",
      members: ["Nadia Butt", "Rizwan Saeed"],
    },
  ];

  const created: Record<string, string> = {};

  for (const t of teamsData) {
    const { data: team, error } = await supabase
      .from("teams")
      .insert({
        name: t.name,
        type: t.type,
        service_category_id: services[t.service] || null,
        department_id: departments[t.dept] || null,
        leader_id: users[t.leader] || null,
      })
      .select("id")
      .single();

    if (error) {
      log("Teams", `SKIP ${t.name}: ${error.message}`);
      continue;
    }

    created[t.name] = team.id;
    log("Teams", `Created: ${t.name}`);

    // Add members
    const memberRows = t.members
      .filter((m) => users[m])
      .map((m) => ({ team_id: team.id, user_id: users[m] }));
    // Also add leader as member
    if (users[t.leader]) {
      memberRows.push({ team_id: team.id, user_id: users[t.leader] });
    }

    if (memberRows.length > 0) {
      const { error: memErr } = await supabase.from("team_members").insert(memberRows);
      if (memErr) {
        log("Teams", `  Members error: ${memErr.message}`);
      } else {
        log("Teams", `  Added ${memberRows.length} members`);
      }
    }
  }

  return created;
}

// ─── 6. ORDERS ─────────────────────────────────────────────────
async function seedOrders(
  users: Record<string, string>,
  services: Record<string, string>
) {
  console.log("\n6. Seeding Orders...");

  // Get platform IDs
  const { data: platforms } = await supabase.from("platforms").select("id, name, charge_percentage");
  const platformMap: Record<string, { id: string; charge: number }> = {};
  platforms?.forEach((p) => {
    platformMap[p.name] = { id: p.id, charge: p.charge_percentage };
  });

  // Get status IDs
  const { data: statuses } = await supabase.from("order_statuses").select("id, name");
  const statusMap: Record<string, string> = {};
  statuses?.forEach((s) => {
    statusMap[s.name] = s.id;
  });

  // Get service line IDs
  const { data: serviceLines } = await supabase
    .from("service_lines")
    .select("id, name, service_category_id");

  const ordersData = [
    {
      client: "TechNova Inc.", platform: "Fiverr", gross: 850,
      service: "FSD", line: "Frontend Development",
      assigned: "Usman Ghani", status: "In Progress",
      days_ago: 3, deadline_days: 7,
    },
    {
      client: "BlueHorizon LLC", platform: "Upwork", gross: 1200,
      service: "FSD", line: "Backend Development",
      assigned: "Hira Khan", status: "New",
      days_ago: 1, deadline_days: 14,
    },
    {
      client: "PixelPerfect Studio", platform: "Fiverr", gross: 350,
      service: "Graphics", line: "PowerPoint Design",
      assigned: "Nadia Butt", status: "In Progress",
      days_ago: 5, deadline_days: 2,
    },
    {
      client: "GreenLeaf Organics", platform: "Upwork", gross: 500,
      service: "Graphics", line: "Branding & Logo",
      assigned: "Rizwan Saeed", status: "Under Review",
      days_ago: 8, deadline_days: -1,
    },
    {
      client: "CloudSync Solutions", platform: "Fiverr", gross: 2000,
      service: "FSD", line: "UI/UX Design",
      assigned: "Kamran Iqbal", status: "New",
      days_ago: 0, deadline_days: 21,
    },
    {
      client: "MediaBuzz Corp", platform: "Upwork", gross: 400,
      service: "Graphics", line: "Social Media Design",
      assigned: "Nadia Butt", status: "Completed",
      days_ago: 15, deadline_days: -5,
    },
    {
      client: "SwiftPay Fintech", platform: "Fiverr", gross: 3500,
      service: "FSD", line: "Backend Development",
      assigned: "Usman Ghani", status: "In Progress",
      days_ago: 10, deadline_days: 10,
    },
    {
      client: "UrbanNest Realty", platform: "Upwork", gross: 650,
      service: "CMS", line: "WordPress",
      assigned: "Hira Khan", status: "New",
      days_ago: 2, deadline_days: 10,
    },
    {
      client: "FoodieHub App", platform: "Fiverr", gross: 1500,
      service: "FSD", line: "Frontend Development",
      assigned: "Kamran Iqbal", status: "Revision",
      days_ago: 12, deadline_days: -2,
    },
    {
      client: "EduSpark Learning", platform: "Upwork", gross: 750,
      service: "CMS", line: "Shopify",
      assigned: "Rizwan Saeed", status: "Completed",
      days_ago: 20, deadline_days: -10,
    },
    {
      client: "AutoDrive Motors", platform: "Fiverr", gross: 280,
      service: "Graphics", line: "Motion Graphics",
      assigned: "Nadia Butt", status: "In Progress",
      days_ago: 4, deadline_days: 5,
    },
    {
      client: "HealthPlus Clinic", platform: "Upwork", gross: 900,
      service: "FSD", line: "UI/UX Design",
      assigned: "Usman Ghani", status: "Completed",
      days_ago: 25, deadline_days: -15,
    },
    {
      client: "LegalEase Firm", platform: "Fiverr", gross: 450,
      service: "CMS", line: "WordPress",
      assigned: "Hira Khan", status: "In Progress",
      days_ago: 6, deadline_days: 4,
    },
    {
      client: "SkyTravel Agency", platform: "Upwork", gross: 1800,
      service: "FSD", line: "Backend Development",
      assigned: "Kamran Iqbal", status: "New",
      days_ago: 1, deadline_days: 18,
    },
    {
      client: "CraftBrew Co.", platform: "Fiverr", gross: 550,
      service: "Graphics", line: "Branding & Logo",
      assigned: "Rizwan Saeed", status: "Cancelled",
      days_ago: 14, deadline_days: -4,
    },
  ];

  let orderNum = 1000;

  for (const o of ordersData) {
    orderNum++;
    const plat = platformMap[o.platform];
    if (!plat) continue;

    const charge = (o.gross * plat.charge) / 100;
    const net = o.gross - charge;

    const orderDate = new Date();
    orderDate.setDate(orderDate.getDate() - o.days_ago);

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + o.deadline_days);

    const serviceCatId = services[o.service] || null;
    const lineMatch = serviceLines?.find(
      (sl) => sl.name === o.line && sl.service_category_id === serviceCatId
    );

    const createdBy = users["Sara Ali"] || users["Omar Farooq"] || ADMIN_USER_ID;

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        order_number: `ORD-${orderNum}`,
        order_date: orderDate.toISOString().split("T")[0],
        client_name: o.client,
        platform_id: plat.id,
        gross_amount: o.gross,
        platform_charge: charge,
        net_amount: net,
        service_category_id: serviceCatId,
        service_line_id: lineMatch?.id || null,
        assigned_to: users[o.assigned] || null,
        assigned_by: createdBy,
        status_id: statusMap[o.status] || statusMap["New"],
        deadline: deadline.toISOString(),
        instruction_text: `Requirements for ${o.client} project. Deliver high-quality work matching client specifications.`,
        created_by: createdBy,
      })
      .select("id")
      .single();

    if (error) {
      log("Orders", `SKIP ${o.client}: ${error.message}`);
      continue;
    }

    // Add status history entry
    await supabase.from("order_status_history").insert({
      order_id: order.id,
      from_status_id: null,
      to_status_id: statusMap[o.status] || statusMap["New"],
      changed_by: createdBy,
      notes: "Order created",
    });

    log("Orders", `Created: ORD-${orderNum} - ${o.client} ($${o.gross} ${o.platform})`);
  }
}

// ─── 7. TARGETS ────────────────────────────────────────────────
async function seedTargets(users: Record<string, string>) {
  console.log("\n7. Seeding Targets...");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const quarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0);

  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const setBy = users["Sara Ali"] || users["Omar Farooq"] || ADMIN_USER_ID;

  const targetsData = [
    // Monthly targets for ops members
    { user: "Usman Ghani", period: "monthly", start: monthStart, end: monthEnd, amount: 5000 },
    { user: "Hira Khan", period: "monthly", start: monthStart, end: monthEnd, amount: 4000 },
    { user: "Kamran Iqbal", period: "monthly", start: monthStart, end: monthEnd, amount: 4500 },
    { user: "Nadia Butt", period: "monthly", start: monthStart, end: monthEnd, amount: 3000 },
    { user: "Rizwan Saeed", period: "monthly", start: monthStart, end: monthEnd, amount: 3500 },
    // Quarterly targets for team leaders
    { user: "Fatima Noor", period: "quarterly", start: quarterStart, end: quarterEnd, amount: 15000 },
    { user: "Hassan Raza", period: "quarterly", start: quarterStart, end: quarterEnd, amount: 12000 },
    { user: "Ayesha Malik", period: "quarterly", start: quarterStart, end: quarterEnd, amount: 18000 },
    { user: "Bilal Ahmed", period: "quarterly", start: quarterStart, end: quarterEnd, amount: 14000 },
    // Sales members
    { user: "Zainab Shah", period: "monthly", start: monthStart, end: monthEnd, amount: 6000 },
    { user: "Ali Hussain", period: "monthly", start: monthStart, end: monthEnd, amount: 5500 },
    { user: "Maryam Tariq", period: "monthly", start: monthStart, end: monthEnd, amount: 4000 },
  ];

  for (const t of targetsData) {
    const userId = users[t.user];
    if (!userId) continue;

    const { error } = await supabase.from("targets").insert({
      user_id: userId,
      period_type: t.period,
      period_start: fmt(t.start),
      period_end: fmt(t.end),
      target_amount: t.amount,
      set_by: setBy,
    });

    if (error) {
      log("Targets", `SKIP ${t.user}: ${error.message}`);
    } else {
      log("Targets", `Created: ${t.user} - $${t.amount} (${t.period})`);
    }
  }
}

// ─── 8. REQUISITIONS ───────────────────────────────────────────
async function seedRequisitions(users: Record<string, string>) {
  console.log("\n8. Seeding Requisitions...");

  const reqs = [
    {
      requester: "Ayesha Malik", item: 'Dell UltraSharp 27" Monitor',
      purpose: "Dual monitor setup for UI review and code development",
      cost: 450, urgency: "high", status: "approved",
    },
    {
      requester: "Fatima Noor", item: "Wacom Intuos Pro Tablet",
      purpose: "Digital illustration work for client mockups",
      cost: 350, urgency: "medium", status: "pending",
    },
    {
      requester: "Bilal Ahmed", item: "MacBook Pro M3 16GB",
      purpose: "Current laptop is 4 years old and sluggish for video rendering",
      cost: 2500, urgency: "critical", status: "approved",
    },
    {
      requester: "Hassan Raza", item: "Logitech MX Master 3S Mouse",
      purpose: "Ergonomic mouse for extended design sessions",
      cost: 100, urgency: "low", status: "fulfilled",
    },
    {
      requester: "Sara Ali", item: "Standing Desk Converter",
      purpose: "Health and ergonomics improvement for the sales floor",
      cost: 300, urgency: "medium", status: "rejected",
    },
  ];

  for (const r of reqs) {
    const requesterId = users[r.requester];
    if (!requesterId) continue;

    const payload: Record<string, unknown> = {
      requester_id: requesterId,
      item_description: r.item,
      purpose: r.purpose,
      estimated_cost: r.cost,
      urgency: r.urgency,
      status: r.status,
    };

    if (r.status === "approved" || r.status === "rejected" || r.status === "fulfilled") {
      payload.reviewer_id = ADMIN_USER_ID;
      payload.reviewed_at = new Date().toISOString();
      payload.review_notes =
        r.status === "rejected"
          ? "Budget constraints this quarter. Resubmit next quarter."
          : "Approved. Proceed with procurement.";
    }

    if (r.status === "fulfilled") {
      payload.fulfilled_by = ADMIN_USER_ID;
      payload.fulfilled_at = new Date().toISOString();
    }

    const { error } = await supabase.from("tech_requisitions").insert(payload);

    if (error) {
      log("Requisitions", `SKIP ${r.item}: ${error.message}`);
    } else {
      log("Requisitions", `Created: ${r.item} (${r.status})`);
    }
  }
}

// ─── 9. INVENTORY ──────────────────────────────────────────────
async function seedInventory(users: Record<string, string>) {
  console.log("\n9. Seeding Inventory...");

  const items = [
    {
      name: "MacBook Pro 14\" M2", category: "Laptop", assigned: "Usman Ghani",
      cost: 2200, serial: "MBP-2024-001", status: "active",
      purchase: "2024-06-15",
    },
    {
      name: "MacBook Pro 16\" M3", category: "Laptop", assigned: "Kamran Iqbal",
      cost: 2800, serial: "MBP-2024-002", status: "active",
      purchase: "2024-09-20",
    },
    {
      name: "Dell XPS 15", category: "Laptop", assigned: "Hira Khan",
      cost: 1600, serial: "DELL-2024-001", status: "active",
      purchase: "2024-03-10",
    },
    {
      name: 'LG 27" 4K Monitor', category: "Monitor", assigned: "Nadia Butt",
      cost: 400, serial: "LG-MON-001", status: "active",
      purchase: "2024-07-01",
    },
    {
      name: 'Samsung 32" Curved', category: "Monitor", assigned: "Rizwan Saeed",
      cost: 350, serial: "SAM-MON-001", status: "active",
      purchase: "2024-08-15",
    },
    {
      name: "Wacom Cintiq 22", category: "Drawing Tablet", assigned: "Nadia Butt",
      cost: 1200, serial: "WAC-2023-001", status: "active",
      purchase: "2023-11-20",
    },
    {
      name: "HP EliteBook 840", category: "Laptop", assigned: null,
      cost: 1400, serial: "HP-2023-001", status: "retired",
      purchase: "2022-01-15", notes: "Battery degraded. Replaced with MacBook.",
    },
    {
      name: "Logitech MX Keys", category: "Keyboard", assigned: "Fatima Noor",
      cost: 120, serial: "LOG-KB-001", status: "active",
      purchase: "2024-04-10",
    },
    {
      name: 'Dell P2422H 24" Monitor', category: "Monitor", assigned: null,
      cost: 250, serial: "DELL-MON-002", status: "under_repair",
      purchase: "2023-06-01", notes: "Flickering issue. Sent for repair.",
    },
  ];

  for (const item of items) {
    const { error } = await supabase.from("tech_inventory").insert({
      item_name: item.name,
      category: item.category,
      assigned_to: item.assigned ? users[item.assigned] || null : null,
      cost: item.cost,
      serial_number: item.serial,
      status: item.status,
      purchase_date: item.purchase,
      notes: item.notes || null,
      description: `${item.category} - ${item.name}`,
    });

    if (error) {
      log("Inventory", `SKIP ${item.name}: ${error.message}`);
    } else {
      log("Inventory", `Created: ${item.name} (${item.status})`);
    }
  }
}

// ─── MAIN ──────────────────────────────────────────────────────
async function main() {
  console.log("========================================");
  console.log("  SmartTeam — Seeding Dummy Data");
  console.log("========================================");
  console.log(`  All user passwords: ${DEFAULT_PASSWORD}`);

  const roles = await seedRoles();
  const departments = await seedDepartments();
  const services = await seedServices();
  const users = await seedUsers(roles, departments);
  await seedTeams(users, services, departments);
  await seedOrders(users, services);
  await seedTargets(users);
  await seedRequisitions(users);
  await seedInventory(users);

  console.log("\n========================================");
  console.log("  Seeding Complete!");
  console.log("========================================");
  console.log("\n  Login credentials:");
  console.log("  ─────────────────────────────────────");
  console.log("  Admin:      admin@smartlab.com / Admin@123");
  console.log("  Boss:       ahmed@smartlab.com / Test@123");
  console.log("  Dept Head:  sara@smartlab.com  / Test@123");
  console.log("  Dept Head:  omar@smartlab.com  / Test@123");
  console.log("  Team Lead:  fatima@smartlab.com / Test@123");
  console.log("  Member:     usman@smartlab.com / Test@123");
  console.log("  (... and 10 more users with Test@123)");
  console.log("");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
