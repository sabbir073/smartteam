export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";

// GET /api/reports?type=revenue|orders|targets&format=csv&start_date=&end_date=
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perm = await checkPermission(session.user.id, "reports", "view");
  if (!perm.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const type = sp.get("type") || "orders";
  const format = sp.get("format") || "csv";
  const startDate = sp.get("start_date") || "";
  const endDate = sp.get("end_date") || "";

  if (format === "csv") {
    let csvContent = "";
    let filename = "";

    if (type === "orders") {
      let query = supabase
        .from("orders")
        .select(`
          order_number, order_date, client_name, external_order_id,
          gross_amount, platform_charge, net_amount, deadline,
          platforms:platform_id(name),
          order_statuses:status_id(name),
          service_categories:service_category_id(name),
          assigned_user:assigned_to(name)
        `)
        .order("order_date", { ascending: false });

      if (startDate) query = query.gte("order_date", startDate);
      if (endDate) query = query.lte("order_date", endDate);

      const { data: orders } = await query;

      csvContent = "Order #,Date,Client,External ID,Gross,Platform Charge,Net,Platform,Status,Service,Assigned To,Deadline\n";
      for (const o of orders || []) {
        const platform = Array.isArray(o.platforms) ? o.platforms[0] : o.platforms;
        const status = Array.isArray(o.order_statuses) ? o.order_statuses[0] : o.order_statuses;
        const service = Array.isArray(o.service_categories) ? o.service_categories[0] : o.service_categories;
        const assigned = Array.isArray(o.assigned_user) ? o.assigned_user[0] : o.assigned_user;

        csvContent += `"${o.order_number}","${o.order_date}","${o.client_name}","${o.external_order_id || ""}",${o.gross_amount},${o.platform_charge},${o.net_amount},"${(platform as Record<string, string>)?.name || ""}","${(status as Record<string, string>)?.name || ""}","${(service as Record<string, string>)?.name || ""}","${(assigned as Record<string, string>)?.name || ""}","${o.deadline || ""}"\n`;
      }
      filename = `orders-report-${startDate || "all"}.csv`;

    } else if (type === "revenue") {
      let query = supabase
        .from("orders")
        .select(`order_date, gross_amount, platform_charge, net_amount, platforms:platform_id(name), service_categories:service_category_id(name)`)
        .order("order_date", { ascending: false });

      if (startDate) query = query.gte("order_date", startDate);
      if (endDate) query = query.lte("order_date", endDate);

      const { data: orders } = await query;

      csvContent = "Date,Gross,Platform Charge,Net,Platform,Service\n";
      for (const o of orders || []) {
        const platform = Array.isArray(o.platforms) ? o.platforms[0] : o.platforms;
        const service = Array.isArray(o.service_categories) ? o.service_categories[0] : o.service_categories;
        csvContent += `"${o.order_date}",${o.gross_amount},${o.platform_charge},${o.net_amount},"${(platform as Record<string, string>)?.name || ""}","${(service as Record<string, string>)?.name || ""}"\n`;
      }
      filename = `revenue-report-${startDate || "all"}.csv`;

    } else if (type === "targets") {
      const { data: targets } = await supabase
        .from("targets")
        .select(`*, users:user_id(name)`)
        .order("period_start", { ascending: false });

      csvContent = "User,Period Type,Start,End,Target Amount\n";
      for (const t of targets || []) {
        const user = Array.isArray(t.users) ? t.users[0] : t.users;
        csvContent += `"${(user as Record<string, string>)?.name || ""}","${t.period_type}","${t.period_start}","${t.period_end}",${t.target_amount}\n`;
      }
      filename = `targets-report.csv`;
    }

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({ error: "Unsupported format. Use format=csv" }, { status: 400 });
}
