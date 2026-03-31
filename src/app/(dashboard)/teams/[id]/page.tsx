"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { RequirePermission } from "@/components/shared/require-permission";

interface MemberUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

interface TeamDetail {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  service_categories: { id: string; name: string } | null;
  leader: MemberUser | null;
  team_members: { id: string; user_id: string; joined_at: string; users: MemberUser }[];
}

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const teamId = params.id as string;

  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<{ id: string; name: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [adding, setAdding] = useState(false);
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);

  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}`);
      if (res.ok) {
        const json = await res.json();
        setTeam(json.data);
      }
    } catch { toast.error("Failed to load team"); }
    finally { setLoading(false); }
  }, [teamId]);

  useEffect(() => {
    fetchTeam();
    fetch("/api/users?pageSize=200").then((r) => r.json()).then((json) => {
      setAllUsers((json.data || []).map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })));
    }).catch(() => {});
  }, [fetchTeam]);

  async function handleAddMember() {
    if (!selectedUserId) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: selectedUserId }),
      });
      if (res.ok) {
        toast.success("Member added");
        setSelectedUserId("");
        fetchTeam();
      } else {
        const json = await res.json();
        toast.error(json.error || "Failed to add member");
      }
    } catch { toast.error("An error occurred"); }
    finally { setAdding(false); }
  }

  async function handleRemoveMember() {
    if (!removeMemberId) return;
    try {
      const res = await fetch(`/api/teams/${teamId}/members?user_id=${removeMemberId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Member removed");
        fetchTeam();
      } else {
        const json = await res.json();
        toast.error(json.error || "Failed to remove member");
      }
    } catch { toast.error("An error occurred"); }
    finally { setRemoveMemberId(null); }
  }

  async function handleDeleteTeam() {
    try {
      const res = await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Team deleted");
        router.push("/teams");
      } else {
        const json = await res.json();
        toast.error(json.error || "Failed to delete team");
      }
    } catch { toast.error("An error occurred"); }
  }

  if (loading) {
    return <RequirePermission module="teams"><div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div></RequirePermission>;
  }

  if (!team) {
    return <RequirePermission module="teams"><div className="text-center py-12"><p className="text-muted-foreground">Team not found.</p></div></RequirePermission>;
  }

  const serviceData = team.service_categories;
  const service = Array.isArray(serviceData) ? serviceData[0] : serviceData;
  const leaderData = team.leader;
  const leader = Array.isArray(leaderData) ? leaderData[0] : leaderData;
  const members = (team.team_members || []).map((m) => {
    const u = Array.isArray(m.users) ? m.users[0] : m.users;
    return { ...m, user: u };
  });

  const memberIds = new Set(members.map((m) => m.user_id));
  const availableUsers = allUsers.filter((u) => !memberIds.has(u.id));

  return (
    <RequirePermission module="teams">
    <div className="space-y-6">
      <PageHeader title={team.name} description={`${team.type} team`}>
        {hasPermission("teams", "delete") && (
          <Button variant="destructive" size="sm" onClick={handleDeleteTeam}>
            <Trash2 className="mr-2 h-4 w-4" />Delete Team
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Type</CardTitle></CardHeader>
          <CardContent><Badge>{team.type}</Badge></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Service</CardTitle></CardHeader>
          <CardContent><span>{service?.name || "Not assigned"}</span></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Leader</CardTitle></CardHeader>
          <CardContent>
            {leader ? (
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={leader.avatar_url || undefined} />
                  <AvatarFallback className="text-[8px]">{leader.name?.[0]}</AvatarFallback>
                </Avatar>
                <span>{leader.name}</span>
              </div>
            ) : <span className="text-muted-foreground">Not assigned</span>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Members ({members.length})</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasPermission("teams", "edit") && (
            <div className="flex items-center gap-2">
              <Select value={selectedUserId} onValueChange={(v) => setSelectedUserId(v || "")} items={Object.fromEntries(availableUsers.map(u => [u.id, u.name]))}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="Select user to add..." />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id} label={u.name}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAddMember} disabled={adding || !selectedUserId} size="sm">
                <UserPlus className="mr-1 h-4 w-4" />Add
              </Button>
            </div>
          )}

          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No members in this team yet.</p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-md border">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={m.user?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">{m.user?.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{m.user?.name}</p>
                      <p className="text-xs text-muted-foreground">{m.user?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Joined {new Date(m.joined_at).toLocaleDateString()}
                    </span>
                    {hasPermission("teams", "edit") && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setRemoveMemberId(m.user_id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!removeMemberId} onOpenChange={() => setRemoveMemberId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>Remove this member from the team?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </RequirePermission>
  );
}
