"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Check, Loader2, Users } from "lucide-react";

interface UserItem {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  company_id: string | null;
}

interface NewConversationDialogProps {
  open: boolean;
  onClose: () => void;
  onCreateDirect: (userId: string) => Promise<string | null>;
  onCreateGroup: (name: string, memberIds: string[]) => Promise<string | null>;
  onConversationCreated: (convId: string) => void;
}

export function NewConversationDialog({
  open,
  onClose,
  onCreateDirect,
  onCreateGroup,
  onConversationCreated,
}: NewConversationDialogProps) {
  const { data: session } = useSession();
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [users, setUsers] = useState<UserItem[]>([]);
  const [search, setSearch] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const isAdmin = session?.user?.roleLevel === 0;

  useEffect(() => {
    if (!open) return;
    fetch("/api/conversations/users")
      .then((r) => r.json())
      .then((j) => {
        setUsers((j.data || []).map((u: UserItem) => ({
          id: u.id, name: u.name, email: u.email, avatar_url: u.avatar_url, company_id: u.company_id,
        })));
      })
      .catch(() => {});
    setSearch("");
    setSelectedIds(new Set());
    setGroupName("");
    setMode("direct");
  }, [open, session?.user?.id]);

  const filtered = search.trim()
    ? users.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()) || (u.company_id && u.company_id.toLowerCase().includes(search.toLowerCase())))
    : users;

  async function handleDirectSelect(userId: string) {
    setCreating(true);
    const convId = await onCreateDirect(userId);
    setCreating(false);
    if (convId) { onConversationCreated(convId); onClose(); }
  }

  async function handleCreateGroup() {
    if (!groupName.trim() || selectedIds.size === 0) return;
    setCreating(true);
    const convId = await onCreateGroup(groupName, Array.from(selectedIds));
    setCreating(false);
    if (convId) { onConversationCreated(convId); onClose(); }
  }

  function toggleSelect(userId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
        </DialogHeader>

        {/* Mode Tabs */}
        {isAdmin && (
          <div className="flex rounded-lg border bg-muted p-0.5 gap-0.5">
            <button onClick={() => setMode("direct")} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${mode === "direct" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
              Direct Message
            </button>
            <button onClick={() => setMode("group")} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${mode === "group" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
              Group Chat
            </button>
          </div>
        )}

        {mode === "group" && (
          <div className="space-y-2">
            <Label>Group Name</Label>
            <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g., FSD Team Chat" />
            {selectedIds.size > 0 && (
              <p className="text-xs text-muted-foreground">{selectedIds.size} member{selectedIds.size > 1 ? "s" : ""} selected</p>
            )}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." className="pl-8" />
        </div>

        {/* User List */}
        <ScrollArea className="h-[280px] -mx-2">
          {filtered.map((user) => {
            const initials = user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
            const isSelected = selectedIds.has(user.id);
            return (
              <button
                key={user.id}
                onClick={() => mode === "direct" ? handleDirectSelect(user.id) : toggleSelect(user.id)}
                disabled={creating && mode === "direct"}
                className={`flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/50 ${isSelected ? "bg-primary/5" : ""}`}
              >
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{user.name}</span>
                    {user.company_id && <Badge variant="secondary" className="text-[9px]">{user.company_id}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                {mode === "group" && isSelected && (
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </button>
            );
          })}
        </ScrollArea>

        {mode === "group" && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleCreateGroup} disabled={creating || !groupName.trim() || selectedIds.size === 0}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Users className="mr-2 h-4 w-4" />
              Create Group
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
