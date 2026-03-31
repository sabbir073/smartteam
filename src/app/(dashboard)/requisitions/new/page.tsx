"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RequirePermission } from "@/components/shared/require-permission";

export default function NewRequisitionPage() {
  const router = useRouter();
  const [item, setItem] = useState("");
  const [purpose, setPurpose] = useState("");
  const [cost, setCost] = useState("");
  const [urgency, setUrgency] = useState("medium");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_description: item,
          purpose,
          estimated_cost: cost ? parseFloat(cost) : undefined,
          urgency,
        }),
      });
      if (res.ok) { toast.success("Requisition submitted"); router.push("/requisitions"); }
      else { const json = await res.json(); toast.error(json.error || "Failed"); }
    } catch { toast.error("An error occurred"); }
    finally { setSaving(false); }
  }

  return (
    <RequirePermission module="requisitions" action="create">
    <div className="space-y-6">
      <PageHeader title="New Requisition" description="Submit a technology equipment request" />
      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader><CardTitle>Request Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Item Description *</Label>
              <Input value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g., MacBook Pro 16-inch" required />
            </div>
            <div className="space-y-2">
              <Label>Purpose *</Label>
              <Textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Why is this needed?" rows={3} required />
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Estimated Cost (USD)</Label>
                <Input type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Urgency</Label>
                <Select value={urgency} onValueChange={(v) => v && setUrgency(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="flex gap-4">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit Request
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/requisitions")}>Cancel</Button>
        </div>
      </form>
    </div>
    </RequirePermission>
  );
}
