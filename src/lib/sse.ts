// In-memory connection store (per serverless instance)
const connections = new Map<string, ReadableStreamDefaultController>();

export function addConnection(
  userId: string,
  controller: ReadableStreamDefaultController
): void {
  const existing = connections.get(userId);
  if (existing) {
    try { existing.close(); } catch {}
  }
  connections.set(userId, controller);
}

export function removeConnection(userId: string): void {
  connections.delete(userId);
}

export function sendEvent(userId: string, eventType: string, data: Record<string, unknown>): boolean {
  const controller = connections.get(userId);
  if (!controller) return false;
  try {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    controller.enqueue(new TextEncoder().encode(payload));
    return true;
  } catch {
    connections.delete(userId);
    return false;
  }
}
