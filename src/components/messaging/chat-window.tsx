"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { MessageBubble } from "./message-bubble";
import { MessageInput } from "./message-input";
import { GroupInfoPanel } from "./group-info-panel";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, Loader2, Info } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { MessageItem, ConversationItem } from "@/hooks/use-messages";

interface ChatWindowProps {
  conversation: ConversationItem;
  messages: MessageItem[];
  loading: boolean;
  hasMore: boolean;
  onSend: (convId: string, content: string, file?: File) => Promise<boolean>;
  onBack: () => void;
  onLoadMore: () => void;
  onRefreshConversations?: () => void;
}

export function ChatWindow({ conversation, messages, loading, hasMore, onSend, onBack, onLoadMore, onRefreshConversations }: ChatWindowProps) {
  const { data: session } = useSession();
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  useEffect(() => {
    if (messages.length > prevLengthRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevLengthRef.current = messages.length;
  }, [messages.length]);

  // Reset group info when conversation changes
  useEffect(() => { setShowGroupInfo(false); }, [conversation.id]);

  const otherUser = conversation.type === "direct"
    ? conversation.members.find((m) => m.id !== session?.user?.id)
    : null;

  const displayName = conversation.type === "group"
    ? conversation.name || "Group"
    : otherUser?.name || "Unknown";

  const displayMessages = [...messages].reverse();

  // Show group info panel
  if (showGroupInfo && conversation.type === "group") {
    return (
      <GroupInfoPanel
        conversationId={conversation.id}
        conversationName={displayName}
        onBack={() => setShowGroupInfo(false)}
        onUpdated={() => onRefreshConversations?.()}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-card shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {conversation.type === "group" ? (
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Users className="h-4 w-4 text-primary" />
          </div>
        ) : (
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={otherUser?.avatar_url || undefined} />
            <AvatarFallback className="text-[9px]">
              {displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
            </AvatarFallback>
          </Avatar>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{displayName}</p>
          {conversation.type === "group" && (
            <p className="text-[10px] text-muted-foreground">{conversation.members.length} members</p>
          )}
        </div>
        {conversation.type === "group" && (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setShowGroupInfo(true)} title="Group info">
            <Info className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {hasMore && (
          <div className="text-center py-2">
            <Button variant="ghost" size="sm" className="text-xs" onClick={onLoadMore} disabled={loading}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Load older messages
            </Button>
          </div>
        )}
        {displayMessages.map((msg, i) => {
          const isOwn = msg.sender_id === session?.user?.id;
          const prevMsg = i > 0 ? displayMessages[i - 1] : null;
          const showSender = conversation.type === "group" && !isOwn && msg.sender_id !== prevMsg?.sender_id;
          return <MessageBubble key={msg.id} message={msg} isOwn={isOwn} showSender={showSender || (i === 0 && !isOwn)} />;
        })}
        {displayMessages.length === 0 && !loading && (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            No messages yet. Say hello!
          </div>
        )}
      </div>

      {/* Input */}
      <MessageInput onSend={(content, file) => onSend(conversation.id, content, file)} />
    </div>
  );
}
