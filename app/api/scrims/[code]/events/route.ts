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
        let lastUpdate = Date.now();

        controller.enqueue(encoder.encode("data: connected\n\n"));

        const interval = setInterval(async () => {
          const scrim = await prisma.scrim.findUnique({
            where: { code },
            select: { updatedAt: true },
          });

          if (!scrim) {
            controller.enqueue(encoder.encode("event: error\ndata: scrim_not_found\n\n"));
            return;
          }

          const ts = new Date(scrim.updatedAt).getTime();

          if (ts > lastUpdate) {
            lastUpdate = ts;
            controller.enqueue(encoder.encode("event: update\ndata: ok\n\n"));
          }
        }, 1000);

        req.signal.addEventListener("abort", () => clearInterval(interval));
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
