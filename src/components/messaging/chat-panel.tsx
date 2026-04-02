"use client";

import { useState } from "react";
import { useMessaging } from "@/providers/messaging-provider";
import { ConversationList } from "./conversation-list";
import { ChatWindow } from "./chat-window";
import { NewConversationDialog } from "./new-conversation-dialog";
import { Button } from "@/components/ui/button";
import { X, SquarePen, Maximize2 } from "lucide-react";
import Link from "next/link";

export function ChatPanel() {
  const {
    isPanelOpen,
    closePanel,
    conversations,
    activeConversationId,
    messages,
    messagesLoading,
    hasMore,
    openConversation,
    closeConversation,
    sendMessage,
    createDirectConversation,
    createGroupConversation,
    loadMore,
    fetchConversations,
  } = useMessaging();

  const [newDialogOpen, setNewDialogOpen] = useState(false);

  if (!isPanelOpen) return null;

  const activeConv = conversations.find((c) => c.id === activeConversationId) || null;

  return (
    <>
      <div className="fixed bottom-0 right-4 z-50 w-[380px] h-[520px] rounded-t-2xl border bg-background shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
        {/* Panel Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-card shrink-0">
          <h3 className="font-semibold text-sm">Messages</h3>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setNewDialogOpen(true)} title="New conversation">
              <SquarePen className="h-3.5 w-3.5" />
            </Button>
            <Link href="/messages">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={closePanel} title="Full page">
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={closePanel}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0">
          {activeConv ? (
            <ChatWindow
              conversation={activeConv}
              messages={messages}
              loading={messagesLoading}
              hasMore={hasMore}
              onSend={sendMessage}
              onBack={closeConversation}
              onLoadMore={loadMore}
              onRefreshConversations={fetchConversations}
            />
          ) : (
            <ConversationList
              conversations={conversations}
              activeId={activeConversationId}
              onSelect={openConversation}
            />
          )}
        </div>
      </div>

      <NewConversationDialog
        open={newDialogOpen}
        onClose={() => setNewDialogOpen(false)}
        onCreateDirect={createDirectConversation}
        onCreateGroup={createGroupConversation}
        onConversationCreated={(convId) => openConversation(convId)}
      />
    </>
  );
}
