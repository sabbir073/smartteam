"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import type { SSEEvent } from "@/types";

interface SSEContextType {
  isConnected: boolean;
  subscribe: (eventType: string, handler: (data: Record<string, unknown>) => void) => () => void;
}

const SSEContext = createContext<SSEContextType>({
  isConnected: false,
  subscribe: () => () => {},
});

export function SSEProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const handlersRef = useRef<Map<string, Set<(data: Record<string, unknown>) => void>>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!session?.user?.id) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/sse`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
    };

    es.onerror = () => {
      setIsConnected(false);
      es.close();

      // Auto-reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 5000);
    };

    // Listen for all event types
    const eventTypes = ["notification", "order-update", "dashboard-refresh"];
    for (const type of eventTypes) {
      es.addEventListener(type, (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          const handlers = handlersRef.current.get(type);
          if (handlers) {
            handlers.forEach((handler) => handler(data));
          }
        } catch {
          // Invalid JSON
        }
      });
    }
  }, [session?.user?.id]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  const subscribe = useCallback(
    (eventType: string, handler: (data: Record<string, unknown>) => void) => {
      if (!handlersRef.current.has(eventType)) {
        handlersRef.current.set(eventType, new Set());
      }
      handlersRef.current.get(eventType)!.add(handler);

      // Return unsubscribe function
      return () => {
        handlersRef.current.get(eventType)?.delete(handler);
      };
    },
    []
  );

  return (
    <SSEContext.Provider value={{ isConnected, subscribe }}>
      {children}
    </SSEContext.Provider>
  );
}

export function useSSE() {
  return useContext(SSEContext);
}
