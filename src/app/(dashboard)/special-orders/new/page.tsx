"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { ProfileCombobox } from "@/components/shared/profile-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/order-utils";
import { RequirePermission } from "@/components/shared/require-permission";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Platform { id: string; name: string; charge_percentage: number; }
interface ProfileOption { id: string; name: string; profile_url: string | null; platform_id: string; platform_name: string; }

export default function NewSpecialOrderPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);

  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [platformId, setPlatformId] = useState("");
  const [profileId, setProfileId] = useState("");
  const [clientName, setClientName] = useState("");
  const [externalOrderId, setExternalOrderId] = useState("");
  const [orderLink, setOrderLink] = useState("");
  const [grossAmount, setGrossAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/platforms").then((r) => r.json()),
      fetch("/api/platform-profiles?active_only=true").then((r) => r.json()),
    ]).then(([pRes, ppRes]) => {
      setPlatforms(pRes.data || []);
      setProfiles((ppRes.data || []).map((pp: any) => {
        const plat = Array.isArray(pp.platforms) ? pp.platforms[0] : pp.platforms;
        return { id: pp.id, name: pp.name, profile_url: pp.profile_url, platform_id: pp.platform_id, platform_name: plat?.name || "" };
      }));
    }).catch(() => {});
  }, []);

  const selectedPlatform = platforms.find((p) => p.id === platformId);
  const gross = parseFloat(grossAmount) || 0;
  const charge = (gross * (selectedPlatform?.charge_percentage || 0)) / 100;
  const net = gross - charge;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!platformId || !clientName || !grossAmount) { toast.error("Fill required fields"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/special-orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_date: orderDate, platform_id: platformId, platform_profile_id: profileId || null,
          client_name: clientName, external_order_id: externalOrderId || null, order_link: orderLink || null,
          gross_amount: gross, deadline: deadline || null, delivery_time: deliveryTime || null, notes: notes || null,
        }),
      });
      if (res.ok) { const j = await res.json(); toast.success("Special order created"); router.push(`/special-orders/${j.data.id}`); }
      else { const j = await res.json(); toast.error(j.error || "Failed"); }
    } catch { toast.error("Error"); }
    finally { setSaving(false); }
  }

  return (
    <RequirePermission module="special-orders" action="create">
    <div className="space-y-6">
      <PageHeader title="New Special Order" description="Create a special order (for reviews — not counted in revenue)" />
      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        <Card>
          <CardHeader><CardTitle>Order Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Platform *</Label>
                <Select value={platformId} onValueChange={(v) => setPlatformId(v || "")} items={Object.fromEntries(platforms.map(p => [p.id, `${p.name} (${p.charge_percentage}%)`]))}>
                  <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
                  <SelectContent>
                    {platforms.map((p) => <SelectItem key={p.id} value={p.id} label={`${p.name} (${p.charge_percentage}%)`}>{p.name} ({p.charge_percentage}%)</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Profile</Label>
                <ProfileCombobox value={profileId} onChange={(id) => setProfileId(id)} profiles={profiles} platformId={platformId} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Client Name *</Label>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client / buyer name" required />
              </div>
              <div className="space-y-2">
                <Label>Order Amount (USD) *</Label>
                <Input type="number" min="0" step="0.01" value={grossAmount} onChange={(e) => setGrossAmount(e.target.value)} placeholder="0.00" required />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Order ID (Platform)</Label>
                <Input value={externalOrderId} onChange={(e) => setExternalOrderId(e.target.value)} placeholder="Platform order ID" />
              </div>
              <div className="space-y-2">
                <Label>Order Link</Label>
                <Input value={orderLink} onChange={(e) => setOrderLink(e.target.value)} placeholder="https://..." />
              </div>
            </div>
            {gross > 0 && selectedPlatform && (
              <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
                <div className="flex justify-between text-sm"><span>Gross (Spent)</span><span className="font-medium">{formatCurrency(gross)}</span></div>
                <div className="flex justify-between text-sm text-muted-foreground"><span>Platform Charge ({selectedPlatform.charge_percentage}%)</span><span>- {formatCurrency(charge)}</span></div>
                <div className="border-t pt-2 flex justify-between text-sm font-bold"><span>Net Cost</span><span className="text-destructive">{formatCurrency(net)}</span></div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Delivery Time</Label><Input type="datetime-local" value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} /></div>
              <div className="space-y-2"><Label>Deadline</Label><Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Purpose of this special order, review requirements, etc..." rows={4} />
          </CardContent>
        </Card>

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Special Order</Button>
          <Button type="button" variant="outline" onClick={() => router.push("/special-orders")}>Cancel</Button>
        </div>
      </form>
    </div>
    </RequirePermission>
  );
}
