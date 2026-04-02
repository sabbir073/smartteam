"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Search, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useSession } from "next-auth/react";
import type { ConversationItem } from "@/hooks/use-messages";

interface ConversationListProps {
  conversations: ConversationItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationList({ conversations, activeId, onSelect }: ConversationListProps) {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");

  function getDisplayName(conv: ConversationItem) {
    if (conv.type === "group") return conv.name || "Group";
    const other = conv.members.find((m) => m.id !== session?.user?.id);
    return other?.name || "Unknown User";
  }

  function getAvatar(conv: ConversationItem) {
    if (conv.type === "group") return null;
    return conv.members.find((m) => m.id !== session?.user?.id)?.avatar_url || null;
  }

  function getInitials(name: string) {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  }

  const filtered = search.trim()
    ? conversations.filter((c) => getDisplayName(c).toLowerCase().includes(search.toLowerCase()))
    : conversations;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {search ? "No matches" : "No conversations yet"}
          </div>
        ) : (
          filtered.map((conv) => {
            const name = getDisplayName(conv);
            const avatar = getAvatar(conv);
            const isActive = conv.id === activeId;
            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors ${
                  isActive ? "bg-primary/10" : "hover:bg-muted/50"
                }`}
              >
                <div className="relative shrink-0">
                  {conv.type === "group" ? (
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                  ) : (
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={avatar || undefined} />
                      <AvatarFallback className="text-xs">{getInitials(name)}</AvatarFallback>
                    </Avatar>
                  )}
                  {conv.unread_count > 0 && (
                    <div className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-[9px] text-primary-foreground flex items-center justify-center font-medium">
                      {conv.unread_count > 9 ? "9+" : conv.unread_count}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm truncate ${conv.unread_count > 0 ? "font-semibold" : "font-medium"}`}>
                      {name}
                    </span>
                    {conv.last_message && (
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                        {formatDistanceToNow(new Date(conv.last_message.created_at), { addSuffix: false })}
                      </span>
                    )}
                  </div>
                  {conv.last_message && (
                    <p className={`text-xs truncate mt-0.5 ${conv.unread_count > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                      {conv.last_message.sender_id === session?.user?.id ? "You: " : ""}
                      {conv.last_message.content || "📎 Attachment"}
                    </p>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
