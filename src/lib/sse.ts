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
