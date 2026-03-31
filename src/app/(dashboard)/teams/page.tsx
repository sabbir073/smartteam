"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { RequirePermission } from "@/components/shared/require-permission";

interface TeamData {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  service_categories: { id: string; name: string } | null;
  leader: { id: string; name: string; avatar_url: string | null } | null;
  team_members: { id: string; user_id: string; users: { id: string; name: string; avatar_url: string | null } }[];
}

export default function TeamsPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<string>("sales");
  const [formServiceId, setFormServiceId] = useState("");
  const [formLeaderId, setFormLeaderId] = useState("");

  // Options
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [teamsRes, servicesRes, usersRes] = await Promise.all([
        fetch("/api/teams"),
        fetch("/api/services"),
        fetch("/api/users?pageSize=100"),
      ]);

      if (teamsRes.ok) {
        const json = await teamsRes.json();
        setTeams(json.data || []);
      }
      if (servicesRes.ok) {
        const json = await servicesRes.json();
        setServices(json.data || []);
      }
      if (usersRes.ok) {
        const json = await usersRes.json();
        setUsers((json.data || []).map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })));
      }
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openCreate() {
    setFormName("");
    setFormType("sales");
    setFormServiceId("");
    setFormLeaderId("");
    setDialogOpen(true);
  }

  async function handleCreate() {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: formName,
        type: formType,
        service_category_id: formServiceId || null,
        leader_id: formLeaderId || null,
      };

      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Team created");
        setDialogOpen(false);
        fetchData();
      } else {
        const json = await res.json();
        toast.error(json.error || "Failed to create team");
      }
    } catch { toast.error("An error occurred"); }
    finally { setSaving(false); }
  }

  if (loading) {
    return (
      <RequirePermission module="teams">
      <div className="space-y-6">
        <PageHeader title="Teams" description="Manage sales and operations teams" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-6"><div className="h-24 bg-muted animate-pulse rounded" /></CardContent></Card>
          ))}
        </div>
      </div>
      </RequirePermission>
    );
  }

  return (
    <RequirePermission module="teams">
    <div className="space-y-6">
      <PageHeader title="Teams" description="Manage sales and operations teams">
        {hasPermission("teams", "create") && (
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Create Team</Button>
        )}
      </PageHeader>

      {/* Summary Cards */}
      {teams.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="stat-card"><div className="text-sm text-muted-foreground">Total Teams</div><div className="text-2xl font-bold">{teams.length}</div></div>
          <div className="stat-card"><div className="text-sm text-muted-foreground">Sales Teams</div><div className="text-2xl font-bold text-primary">{teams.filter(t => t.type === "sales").length}</div></div>
          <div className="stat-card"><div className="text-sm text-muted-foreground">Operations Teams</div><div className="text-2xl font-bold text-info">{teams.filter(t => t.type === "operations").length}</div></div>
        </div>
      )}

      {teams.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No teams yet. Create your first team.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => {
            const serviceData = team.service_categories;
            const service = Array.isArray(serviceData) ? serviceData[0] : serviceData;
            const leaderData = team.leader;
            const leader = Array.isArray(leaderData) ? leaderData[0] : leaderData;
            const members = (team.team_members || []).map((m) => {
              const u = Array.isArray(m.users) ? m.users[0] : m.users;
              return u;
            }).filter(Boolean);

            return (
              <Card
                key={team.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => router.push(`/teams/${team.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{team.name}</CardTitle>
                    <Badge variant={team.type === "sales" ? "default" : "secondary"}>
                      {team.type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {service && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Service: </span>
                      <span>{service.name}</span>
                    </div>
                  )}
                  {leader && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Leader: </span>
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={leader.avatar_url || undefined} />
                        <AvatarFallback className="text-[8px]">{leader.name?.[0]}</AvatarFallback>
                      </Avatar>
                      <span>{leader.name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{members.length} members</span>
                    <div className="flex -space-x-2 ml-auto">
                      {members.slice(0, 4).map((m) => (
                        <Avatar key={m.id} className="h-6 w-6 border-2 border-background">
                          <AvatarImage src={m.avatar_url || undefined} />
                          <AvatarFallback className="text-[8px]">{m.name?.[0]}</AvatarFallback>
                        </Avatar>
                      ))}
                      {members.length > 4 && (
                        <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[8px] font-medium">
                          +{members.length - 4}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Team</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Team Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g., FSD Sales Team" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v || "sales")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="operations">Operations</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Service Category (optional)</Label>
              <Select value={formServiceId} onValueChange={(v) => setFormServiceId(v || "")} items={{ none: "None", ...Object.fromEntries(services.map(s => [s.id, s.name])) }}>
                <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {services.map((s) => <SelectItem key={s.id} value={s.id} label={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Team Leader (optional)</Label>
              <Select value={formLeaderId} onValueChange={(v) => setFormLeaderId(v || "")} items={{ none: "None", ...Object.fromEntries(users.map(u => [u.id, u.name])) }}>
                <SelectTrigger><SelectValue placeholder="Select leader" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {users.map((u) => <SelectItem key={u.id} value={u.id} label={u.name}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !formName.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </RequirePermission>
  );
}
