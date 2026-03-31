import type { SSEEvent } from "@/types";

// In-memory connection store (per serverless instance)
const connections = new Map<string, ReadableStreamDefaultController>();

export function addConnection(
  userId: string,
  controller: ReadableStreamDefaultController
): void {
  // Close existing connection for this user if any
  const existing = connections.get(userId);
  if (existing) {
    try {
      existing.close();
    } catch {
      // Already closed
    }
  }
  connections.set(userId, controller);
}

export function removeConnection(userId: string): void {
  connections.delete(userId);
}

export function broadcastToUser(userId: string, event: SSEEvent): void {
  const controller = connections.get(userId);
  if (!controller) return;

  try {
    const data = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
    controller.enqueue(new TextEncoder().encode(data));
  } catch {
    // Connection closed, remove it
    connections.delete(userId);
  }
}

export function broadcastToUsers(userIds: string[], event: SSEEvent): void {
  for (const userId of userIds) {
    broadcastToUser(userId, event);
  }
}

export function broadcastToAll(event: SSEEvent): void {
  for (const userId of connections.keys()) {
    broadcastToUser(userId, event);
  }
}

export function getConnectionCount(): number {
  return connections.size;
}
