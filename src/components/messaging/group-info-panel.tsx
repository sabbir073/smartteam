"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Crown, UserPlus, UserMinus, ShieldCheck, ShieldOff, Search, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

interface Member {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  is_active: boolean;
  company_id: string | null;
  group_role: "admin" | "member";
}

interface GroupInfoPanelProps {
  conversationId: string;
  conversationName: string;
  onBack: () => void;
  onUpdated: () => void;
}

export function GroupInfoPanel({ conversationId, conversationName, onBack, onUpdated }: GroupInfoPanelProps) {
  const { data: session } = useSession();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; email: string; avatar_url: string | null; company_id: string | null }[]>([]);
  const [addSearch, setAddSearch] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isSystemAdmin = session?.user?.roleLevel === 0;
  const myMembership = members.find((m) => m.id === session?.user?.id);
  const isGroupAdmin = myMembership?.group_role === "admin";
  const canManage = isSystemAdmin || isGroupAdmin;

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}`);
      if (res.ok) {
        const json = await res.json();
        setMembers(json.data?.members || []);
      }
    } catch {}
    finally { setLoading(false); }
  }, [conversationId]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  async function handleAddMember(userId: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ add_members: [userId] }),
      });
      if (res.ok) { toast.success("Member added"); fetchMembers(); onUpdated(); }
      else { const j = await res.json(); toast.error(j.error || "Failed"); }
    } catch { toast.error("Error"); }
    finally { setSaving(false); }
  }

  async function handleRemoveMember() {
    if (!removing) return;
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remove_members: [removing] }),
      });
      if (res.ok) { toast.success("Member removed"); fetchMembers(); onUpdated(); }
      else { const j = await res.json(); toast.error(j.error || "Failed"); }
    } catch { toast.error("Error"); }
    finally { setRemoving(null); }
  }

  async function handleToggleAdmin(userId: string, currentRole: string) {
    const action = currentRole === "admin" ? { demote_to_member: [userId] } : { promote_to_admin: [userId] };
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      if (res.ok) { toast.success(currentRole === "admin" ? "Demoted to member" : "Promoted to admin"); fetchMembers(); }
      else { const j = await res.json(); toast.error(j.error || "Failed"); }
    } catch { toast.error("Error"); }
  }

  // Load all users for add-member search
  useEffect(() => {
    if (!showAddMembers) return;
    fetch("/api/conversations/users").then(r => r.json()).then(j => {
      const existing = new Set(members.map(m => m.id));
      setAllUsers((j.data || []).filter((u: { id: string }) => !existing.has(u.id)));
    }).catch(() => {});
  }, [showAddMembers, members]);

  const filteredUsers = addSearch.trim()
    ? allUsers.filter(u => u.name.toLowerCase().includes(addSearch.toLowerCase()) || u.email.toLowerCase().includes(addSearch.toLowerCase()))
    : allUsers;

  function getInitials(name: string) {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  }

  if (showAddMembers) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowAddMembers(false)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold">Add Members</span>
        </div>
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={addSearch} onChange={e => setAddSearch(e.target.value)} placeholder="Search users..." className="h-8 pl-8 text-sm" />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {filteredUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No users to add</p>
          ) : (
            filteredUsers.map(u => (
              <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={u.avatar_url || undefined} />
                  <AvatarFallback className="text-[9px]">{getInitials(u.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">{u.name}</span>
                  <span className="text-xs text-muted-foreground truncate block">{u.email}</span>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAddMember(u.id)} disabled={saving}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3 mr-1" />}
                  Add
                </Button>
              </div>
            ))
          )}
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold truncate block">{conversationName}</span>
          <span className="text-[10px] text-muted-foreground">{members.length} members</span>
        </div>
        {canManage && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowAddMembers(true)}>
            <UserPlus className="h-3 w-3 mr-1" />Add
          </Button>
        )}
      </div>

      {/* Members */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className="p-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/50">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={m.avatar_url || undefined} />
                  <AvatarFallback className="text-[9px]">{getInitials(m.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{m.name}</span>
                    {!m.is_active && <Badge variant="secondary" className="text-[8px] px-1">Inactive</Badge>}
                    {m.group_role === "admin" && (
                      <Badge className="text-[8px] px-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                        <Crown className="h-2.5 w-2.5 mr-0.5" />Admin
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground truncate block">{m.email}</span>
                </div>

                {/* Actions — only show for others, not self */}
                {canManage && m.id !== session?.user?.id && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    {/* Promote/Demote — system admin only */}
                    {isSystemAdmin && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleAdmin(m.id, m.group_role)}
                        title={m.group_role === "admin" ? "Demote to member" : "Promote to admin"}>
                        {m.group_role === "admin" ? <ShieldOff className="h-3.5 w-3.5 text-muted-foreground" /> : <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
                      </Button>
                    )}
                    {/* Remove */}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setRemoving(m.id)}>
                      <UserMinus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Remove Confirmation */}
      <AlertDialog open={!!removing} onOpenChange={() => setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>Remove {members.find(m => m.id === removing)?.name} from this group?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
