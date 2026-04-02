"use client";

import { createContext, useContext, useState } from "react";
import { useMessages, ConversationItem, MessageItem } from "@/hooks/use-messages";

interface MessagingContextType {
  isPanelOpen: boolean;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  conversations: ConversationItem[];
  totalUnread: number;
  loading: boolean;
  activeConversationId: string | null;
  messages: MessageItem[];
  messagesLoading: boolean;
  hasMore: boolean;
  openConversation: (id: string) => Promise<void>;
  closeConversation: () => void;
  sendMessage: (convId: string, content: string, file?: File) => Promise<boolean>;
  markAsRead: (convId: string) => Promise<void>;
  fetchConversations: () => Promise<void>;
  createDirectConversation: (userId: string) => Promise<string | null>;
  createGroupConversation: (name: string, memberIds: string[]) => Promise<string | null>;
  loadMore: () => void;
}

const MessagingContext = createContext<MessagingContextType | null>(null);

export function MessagingProvider({ children }: { children: React.ReactNode }) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const msg = useMessages();

  return (
    <MessagingContext.Provider
      value={{
        isPanelOpen,
        togglePanel: () => setIsPanelOpen((v) => !v),
        openPanel: () => setIsPanelOpen(true),
        closePanel: () => setIsPanelOpen(false),
        ...msg,
      }}
    >
      {children}
    </MessagingContext.Provider>
  );
}

export function useMessaging() {
  const ctx = useContext(MessagingContext);
  if (!ctx) throw new Error("useMessaging must be inside MessagingProvider");
  return ctx;
}
