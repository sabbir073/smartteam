import { addConnection, removeConnection } from "@/lib/sse";
import { auth } from "@/auth";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Verify authentication - prevent unauthorized SSE connections
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Use the authenticated user's ID, not the query param (prevents spoofing)
  const userId = session.user.id;

  const stream = new ReadableStream({
    start(controller) {
      const data = `event: connected\ndata: ${JSON.stringify({ connected: true })}\n\n`;
      controller.enqueue(new TextEncoder().encode(data));

      addConnection(userId, controller);

      const heartbeat = setInterval(() => {
        try {
          const ping = `event: heartbeat\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`;
          controller.enqueue(new TextEncoder().encode(ping));
        } catch {
          clearInterval(heartbeat);
          removeConnection(userId);
        }
      }, 25000);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        removeConnection(userId);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
