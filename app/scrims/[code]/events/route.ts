import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;

  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        // Initial lastUpdated time
        let lastUpdated = Date.now();

        // Send initial message
        controller.enqueue(encoder.encode(`data: connected\n\n`));

        // Poll DB periodically
        const pollInterval = setInterval(async () => {
          const scrim = await prisma.scrim.findUnique({
            where: { code },
            select: { updatedAt: true },
          });

          if (!scrim) {
            controller.enqueue(
              encoder.encode(`event: error\ndata: scrim_not_found\n\n`)
            );
            clearInterval(pollInterval);
            clearInterval(heartbeatInterval);
            controller.close();
            return;
          }

          const ts = new Date(scrim.updatedAt).getTime();

          if (ts > lastUpdated) {
            lastUpdated = ts;

            controller.enqueue(encoder.encode(`event: update\ndata: updated\n\n`));
          }
        }, 1000); // Check every 1 second

        // Heartbeat to keep the stream alive through proxies
        const heartbeatInterval = setInterval(() => {
          controller.enqueue(encoder.encode(`event: ping\ndata: keepalive\n\n`));
        }, 15000);

        // Stop when client disconnects
        req.signal.addEventListener("abort", () => {
          clearInterval(pollInterval);
          clearInterval(heartbeatInterval);
          controller.close();
        });
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    }
  );
}
