"use client";

import { useState, useEffect } from "react";
import { useMessaging } from "@/providers/messaging-provider";
import { ConversationList } from "@/components/messaging/conversation-list";
import { ChatWindow } from "@/components/messaging/chat-window";
import { NewConversationDialog } from "@/components/messaging/new-conversation-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { RequirePermission } from "@/components/shared/require-permission";
import { SquarePen, MessageCircle } from "lucide-react";

export default function MessagesPage() {
  const {
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
    closePanel,
    fetchConversations,
  } = useMessaging();

  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const activeConv = conversations.find((c) => c.id === activeConversationId) || null;

  // Close floating panel when on full page
  useEffect(() => { closePanel(); }, [closePanel]);

  return (
    <RequirePermission module="messages">
      <div className="space-y-6">
        <PageHeader title="Messages" description="Your conversations">
          <Button onClick={() => setNewDialogOpen(true)}>
            <SquarePen className="mr-2 h-4 w-4" />New Conversation
          </Button>
        </PageHeader>

        <div className="flex rounded-xl border bg-card overflow-hidden" style={{ height: "calc(100vh - 220px)" }}>
          {/* Conversation List (left) */}
          <div className="w-80 border-r shrink-0">
            <ConversationList
              conversations={conversations}
              activeId={activeConversationId}
              onSelect={openConversation}
            />
          </div>

          {/* Chat Window (right) */}
          <div className="flex-1 min-w-0">
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
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageCircle className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm">Or start a new one</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <NewConversationDialog
        open={newDialogOpen}
        onClose={() => setNewDialogOpen(false)}
        onCreateDirect={createDirectConversation}
        onCreateGroup={createGroupConversation}
        onConversationCreated={(convId) => openConversation(convId)}
      />
    </RequirePermission>
  );
}
