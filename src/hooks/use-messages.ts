"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSSE } from "@/providers/sse-provider";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ConversationItem {
  id: string;
  type: "direct" | "group";
  name: string | null;
  updated_at: string;
  members: { id: string; name: string; avatar_url: string | null; is_active: boolean }[];
  last_message: { id: string; content: string | null; sender_id: string; sender_name: string; created_at: string } | null;
  unread_count: number;
}

export interface MessageItem {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  content: string | null;
  has_attachment: boolean;
  created_at: string;
  sender: { id: string; name: string; avatar_url: string | null; is_active?: boolean } | null;
  message_attachments: { id: string; file_name: string; file_url: string; file_size: number; mime_type: string }[];
}

export function useMessages() {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const { subscribe } = useSSE();
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const json = await res.json();
        const data: ConversationItem[] = json.data || [];
        setConversations(data);
        setTotalUnread(data.reduce((s, c) => s + c.unread_count, 0));
      }
    } catch {}
    finally { setLoading(false); }
  }, []);

  const fetchMessages = useCallback(async (convId: string, cursor?: string) => {
    setMessagesLoading(true);
    try {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/conversations/${convId}/messages?${params}`);
      if (res.ok) {
        const json = await res.json();
        const newMsgs: MessageItem[] = json.data || [];
        setHasMore(json.hasMore);
        if (cursor) {
          setMessages((prev) => [...prev, ...newMsgs]);
        } else {
          setMessages(newMsgs);
        }
      }
    } catch {}
    finally { setMessagesLoading(false); }
  }, []);

  const sendMessage = useCallback(async (convId: string, content: string, file?: File) => {
    try {
      let res;
      if (file) {
        const fd = new FormData();
        if (content) fd.append("content", content);
        fd.append("file", file);
        res = await fetch(`/api/conversations/${convId}/messages`, { method: "POST", body: fd });
      } else {
        res = await fetch(`/api/conversations/${convId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
      }
      if (res.ok) {
        const json = await res.json();
        // Prepend new message (messages are newest-first)
        setMessages((prev) => [json.data, ...prev]);
        // Refresh conversation list to update last_message
        fetchConversations();
        return true;
      }
    } catch {}
    return false;
  }, [fetchConversations]);

  const markAsRead = useCallback(async (convId: string) => {
    await fetch(`/api/conversations/${convId}/read`, { method: "PATCH" });
    setConversations((prev) =>
      prev.map((c) => c.id === convId ? { ...c, unread_count: 0 } : c)
    );
    setTotalUnread((prev) => {
      const conv = conversations.find((c) => c.id === convId);
      return Math.max(0, prev - (conv?.unread_count || 0));
    });
  }, [conversations]);

  const openConversation = useCallback(async (convId: string) => {
    setActiveConversationId(convId);
    await fetchMessages(convId);
    await markAsRead(convId);
  }, [fetchMessages, markAsRead]);

  const createDirectConversation = useCallback(async (userId: string) => {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "direct", member_ids: [userId] }),
    });
    if (res.ok) {
      const json = await res.json();
      await fetchConversations();
      return json.data.id;
    }
    return null;
  }, [fetchConversations]);

  const createGroupConversation = useCallback(async (name: string, memberIds: string[]) => {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "group", name, member_ids: memberIds }),
    });
    if (res.ok) {
      const json = await res.json();
      await fetchConversations();
      return json.data.id;
    }
    return null;
  }, [fetchConversations]);

  // Initial fetch
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Polling fallback (every 10s)
  useEffect(() => {
    pollRef.current = setInterval(fetchConversations, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchConversations]);

  // SSE real-time
  useEffect(() => {
    const unsub = subscribe("new-message", (data: any) => {
      fetchConversations();
      if (activeConversationId && data.conversationId === activeConversationId) {
        fetchMessages(activeConversationId);
        markAsRead(activeConversationId);
      }
    });
    return unsub;
  }, [subscribe, activeConversationId, fetchConversations, fetchMessages, markAsRead]);

  return {
    conversations,
    totalUnread,
    loading,
    activeConversationId,
    messages,
    messagesLoading,
    hasMore,
    openConversation,
    closeConversation: () => setActiveConversationId(null),
    sendMessage,
    markAsRead,
    fetchConversations,
    fetchMessages,
    createDirectConversation,
    createGroupConversation,
    loadMore: () => {
      if (activeConversationId && messages.length > 0) {
        const oldest = messages[messages.length - 1].created_at;
        fetchMessages(activeConversationId, oldest);
      }
    },
  };
}
