"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FileText, Image as ImageIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { MessageItem } from "@/hooks/use-messages";

interface MessageBubbleProps {
  message: MessageItem;
  isOwn: boolean;
  showSender?: boolean;
}

export function MessageBubble({ message, isOwn, showSender = false }: MessageBubbleProps) {
  const sender = message.sender;
  const senderName = sender?.name || "Deleted User";
  const initials = senderName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const attachments = message.message_attachments || [];

  return (
    <div className={`flex gap-2 ${isOwn ? "flex-row-reverse" : ""}`}>
      {!isOwn && showSender && (
        <Avatar className="h-7 w-7 shrink-0 mt-1">
          <AvatarImage src={sender?.avatar_url || undefined} />
          <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
        </Avatar>
      )}
      {!isOwn && !showSender && <div className="w-7 shrink-0" />}

      <div className={`max-w-[75%] space-y-1 ${isOwn ? "items-end" : ""}`}>
        {showSender && !isOwn && (
          <p className="text-[10px] text-muted-foreground ml-1">
            {senderName}
            {sender && !sender.is_active && <span className="text-destructive"> (inactive)</span>}
          </p>
        )}
        <div
          className={`rounded-2xl px-3.5 py-2 text-sm ${
            isOwn
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted rounded-bl-md"
          }`}
        >
          {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}
          {attachments.map((att) => {
            const isImage = att.mime_type?.startsWith("image/");
            return (
              <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer" className="block mt-1.5">
                {isImage ? (
                  <img src={att.file_url} alt={att.file_name} className="rounded-lg max-w-full max-h-48 object-cover" />
                ) : (
                  <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${isOwn ? "bg-primary-foreground/10" : "bg-background"}`}>
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">{att.file_name}</span>
                    <span className="text-[10px] shrink-0 opacity-70">{att.file_size ? `${(att.file_size / 1024).toFixed(0)}KB` : ""}</span>
                  </div>
                )}
              </a>
            );
          })}
        </div>
        <p className={`text-[10px] text-muted-foreground ${isOwn ? "text-right mr-1" : "ml-1"}`}>
          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}
