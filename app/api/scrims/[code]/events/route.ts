import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { advanceVetoState, parseVetoState } from "@/lib/veto";
import { getConnectPassword, launchScrimServer } from "@/lib/serverControl";

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

        const pollInterval = setInterval(async () => {
          const scrim = await prisma.scrim.findUnique({
            where: { code },
            select: {
              id: true,
              status: true,
              updatedAt: true,
              vetoState: true,
              server: {
                select: {
                  address: true,
                  rconAddress: true,
                  rconPassword: true,
                },
              },
            },
          });

          if (!scrim) {
            controller.enqueue(
              encoder.encode("event: error\ndata: scrim_not_found\n\n")
            );
            clearInterval(pollInterval);
            clearInterval(heartbeatInterval);
            controller.close();
            return;
          }

          // If a veto turn expired, auto-ban a random map to keep veto moving.
          if (scrim.status === "MAP_VETO" && scrim.vetoState) {
            try {
              const state = parseVetoState(scrim.vetoState);
              if (
                state.phase === "IN_PROGRESS" &&
                state.turn &&
                state.deadline &&
                new Date(state.deadline).getTime() <= Date.now() &&
                state.pool.length > 0
              ) {
                const randomMap =
                  state.pool[Math.floor(Math.random() * state.pool.length)];

                const { updatedState, statusUpdate, finalMap } = advanceVetoState({
                  state: { ...state, pendingVotes: undefined },
                  banChoice: randomMap,
                  turnTeam: state.turn,
                  by: "RANDOM",
                });

                const updateResult = await prisma.scrim.updateMany({
                  where: { id: scrim.id, vetoState: scrim.vetoState },
                  data: {
                    status: statusUpdate,
                    vetoState: JSON.stringify(updatedState),
                    ...(finalMap ? { selectedMap: finalMap } : {}),
                  },
                });

                if (updateResult.count === 0) {
                  return;
                }

                if (finalMap && scrim.server) {
                  try {
                    await launchScrimServer({
                      address: scrim.server?.rconAddress ?? scrim.server?.address ?? "",
                      rconPassword: scrim.server?.rconPassword ?? "",
                      map: finalMap,
                      connectPassword: getConnectPassword(),
                    });
                  } catch (err) {
                    console.error("Auto-veto RCON launch failed", err);
                  }
                }

                lastUpdate = Date.now();
                controller.enqueue(encoder.encode("event: update\ndata: auto_veto\n\n"));
              }
            } catch (err) {
              console.error("Auto-veto failure", err);
            }
          }

          const ts = new Date(scrim.updatedAt).getTime();

          if (ts > lastUpdate) {
            lastUpdate = ts;
            controller.enqueue(encoder.encode("event: update\ndata: ok\n\n"));
          }
        }, 1000);

        // Periodic heartbeat to keep the connection alive through proxies
        const heartbeatInterval = setInterval(() => {
          controller.enqueue(encoder.encode("event: ping\ndata: keepalive\n\n"));
        }, 15000);

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
