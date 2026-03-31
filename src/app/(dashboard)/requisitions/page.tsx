"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, Column } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Check, X, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { RequirePermission } from "@/components/shared/require-permission";
import { formatCurrency } from "@/lib/order-utils";
import { format } from "date-fns";
import { URGENCY_LEVELS, REQUISITION_STATUSES } from "@/lib/constants";

interface ReqRow {
  id: string;
  item_description: string;
  purpose: string;
  estimated_cost: number | null;
  urgency: string;
  status: string;
  created_at: string;
  review_notes: string | null;
  requester: { id: string; name: string } | null;
  reviewer: { id: string; name: string } | null;
  [key: string]: unknown;
}

export default function RequisitionsPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const [reqs, setReqs] = useState<ReqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  // Review dialog
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<"approved" | "rejected" | "fulfilled">("approved");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/requisitions${params}`);
      if (res.ok) { const json = await res.json(); setReqs(json.data || []); }
    } catch { toast.error("Failed to load requisitions"); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleReview() {
    if (!reviewId) return;
    setReviewing(true);
    try {
      const res = await fetch(`/api/requisitions/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: reviewAction, review_notes: reviewNotes }),
      });
      if (res.ok) { toast.success(`Requisition ${reviewAction}`); setReviewId(null); setReviewNotes(""); fetchData(); }
      else { const json = await res.json(); toast.error(json.error || "Failed"); }
    } catch { toast.error("An error occurred"); }
    finally { setReviewing(false); }
  }

  const getUrgencyBadge = (urgency: string) => {
    const u = URGENCY_LEVELS.find((l) => l.value === urgency);
    return <Badge className={u?.color || ""}>{u?.label || urgency}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const s = REQUISITION_STATUSES.find((l) => l.value === status);
    return <Badge className={s?.color || ""}>{s?.label || status}</Badge>;
  };

  const columns: Column<ReqRow>[] = [
    { key: "item_description", header: "Item", render: (r) => <span className="font-medium">{r.item_description}</span> },
    { key: "purpose", header: "Purpose", render: (r) => <span className="text-sm text-muted-foreground line-clamp-1">{r.purpose}</span> },
    { key: "estimated_cost", header: "Est. Cost", render: (r) => r.estimated_cost ? formatCurrency(r.estimated_cost) : "-" },
    { key: "urgency", header: "Urgency", render: (r) => getUrgencyBadge(r.urgency) },
    { key: "status", header: "Status", render: (r) => getStatusBadge(r.status) },
    {
      key: "requester", header: "Requester",
      render: (r) => { const u = Array.isArray(r.requester) ? r.requester[0] : r.requester; return <span className="text-sm">{(u as Record<string, string>)?.name || "-"}</span>; },
    },
    { key: "created_at", header: "Date", render: (r) => <span className="text-sm">{format(new Date(r.created_at), "MMM d, yyyy")}</span> },
    {
      key: "actions", header: "", className: "w-28",
      render: (r) => {
        if (r.status !== "pending" && r.status !== "approved") return null;
        return (
          <div className="flex items-center gap-1">
            {hasPermission("requisitions", "edit") && r.status === "pending" && (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => { setReviewId(r.id); setReviewAction("approved"); }}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setReviewId(r.id); setReviewAction("rejected"); }}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
            {hasPermission("requisitions", "edit") && r.status === "approved" && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600" onClick={() => { setReviewId(r.id); setReviewAction("fulfilled"); }}>
                <Package className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <RequirePermission module="requisitions">
    <div className="space-y-6">
      <PageHeader title="Tech Requisitions" description="Request and manage technology equipment">
        {hasPermission("requisitions", "create") && (
          <Button onClick={() => router.push("/requisitions/new")}><Plus className="mr-2 h-4 w-4" />New Request</Button>
        )}
      </PageHeader>

      <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === "all" ? "" : (v || ""))}>
        <SelectTrigger className="w-40"><SelectValue placeholder="All Statuses" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {REQUISITION_STATUSES.map((s) => <SelectItem key={s.value} value={s.value} label={s.label}>{s.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <DataTable columns={columns} data={reqs} loading={loading} emptyMessage="No requisitions found." />

      <Dialog open={!!reviewId} onOpenChange={() => setReviewId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approved" ? "Approve" : reviewAction === "rejected" ? "Reject" : "Mark as Fulfilled"} Requisition
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Notes (optional)" rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewId(null)}>Cancel</Button>
            <Button onClick={handleReview} disabled={reviewing}
              className={reviewAction === "rejected" ? "bg-destructive hover:bg-destructive/90" : reviewAction === "fulfilled" ? "bg-blue-600 hover:bg-blue-700" : ""}>
              {reviewing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {reviewAction === "approved" ? "Approve" : reviewAction === "rejected" ? "Reject" : "Mark Fulfilled"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </RequirePermission>
  );
}
