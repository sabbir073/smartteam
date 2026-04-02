"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Send, Paperclip, X } from "lucide-react";

interface MessageInputProps {
  onSend: (content: string, file?: File) => Promise<boolean>;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleSend() {
    if ((!text.trim() && !file) || sending) return;
    setSending(true);
    const success = await onSend(text.trim(), file || undefined);
    if (success) {
      setText("");
      setFile(null);
    }
    setSending(false);
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-t bg-card p-3 space-y-2">
      {file && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted text-sm">
          <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate flex-1">{file.name}</span>
          <button onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || sending}
          type="button"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); e.target.value = ""; }}
        />
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={disabled || sending}
          rows={1}
          className="flex-1 resize-none rounded-xl border bg-muted/50 px-3.5 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 max-h-24 min-h-[36px]"
          style={{ height: "36px" }}
          onInput={(e) => {
            const el = e.target as HTMLTextAreaElement;
            el.style.height = "36px";
            el.style.height = Math.min(el.scrollHeight, 96) + "px";
          }}
        />
        <Button
          size="icon"
          className="h-9 w-9 shrink-0 rounded-xl"
          onClick={handleSend}
          disabled={(!text.trim() && !file) || disabled || sending}
          type="button"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
