import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import {
  advanceVetoState,
  getVetoVoteLimit,
  parseVetoState,
  type TeamSide,
  type VetoState,
} from "@/lib/veto";
import { getConnectPassword, launchScrimServer } from "@/lib/serverControl";

export const dynamic = "force-dynamic";

function pickRandomMaps(pool: string[], count: number): string[] {
  const remaining = [...pool];
  const picks: string[] = [];
  while (picks.length < count && remaining.length > 0) {
    const index = Math.floor(Math.random() * remaining.length);
    picks.push(remaining.splice(index, 1)[0]);
  }
  return picks;
}

function pickTopMaps(
  counts: Record<string, number>,
  pool: string[],
  count: number
): string[] {
  const available = new Set(pool);
  const picks: string[] = [];

  for (let i = 0; i < count; i += 1) {
    let max = -1;
    const top: string[] = [];
    for (const map of available) {
      const votes = counts[map] ?? 0;
      if (votes > max) {
        max = votes;
        top.length = 0;
        top.push(map);
      } else if (votes === max) {
        top.push(map);
      }
    }
    if (top.length === 0) break;
    const choice = top[Math.floor(Math.random() * top.length)];
    picks.push(choice);
    available.delete(choice);
  }

  if (picks.length < count) {
    const remaining = pool.filter((map) => !picks.includes(map));
    picks.push(...pickRandomMaps(remaining, count - picks.length));
  }

  return picks;
}

type BanChoice = { map: string; by: TeamSide | "RANDOM" };

function pickTimedOutBansFromVotes(
  state: VetoState,
  team: TeamSide,
  banCount: number
): BanChoice[] {
  if (
    !state.pendingVotes ||
    state.pendingVotes.team !== team ||
    state.pendingVotes.turn !== state.banned.length
  ) {
    return pickRandomMaps(state.pool, banCount).map((map) => ({
      map,
      by: "RANDOM",
    }));
  }

  const counts: Record<string, number> = {};
  Object.values(state.pendingVotes.selections).forEach((maps) => {
    maps.forEach((map) => {
      if (!state.pool.includes(map)) return;
      counts[map] = (counts[map] ?? 0) + 1;
    });
  });

  const votedMaps = Object.keys(counts).filter((map) => state.pool.includes(map));
  if (votedMaps.length === 0) {
    return pickRandomMaps(state.pool, banCount).map((map) => ({
      map,
      by: "RANDOM",
    }));
  }

  const picks = pickTopMaps(counts, votedMaps, banCount);
  const results: BanChoice[] = picks.map((map) => ({ map, by: team }));

  if (results.length < banCount) {
    const remaining = state.pool.filter(
      (map) => !results.some((pick) => pick.map === map)
    );
    const randomPicks = pickRandomMaps(remaining, banCount - results.length);
    randomPicks.forEach((map) => results.push({ map, by: "RANDOM" }));
  }

  return results;
}

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
              vetoMode: true,
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
                const banCount =
                  scrim.vetoMode === "PLAYERS" ? getVetoVoteLimit(state) : 1;
                const banChoices: BanChoice[] =
                  scrim.vetoMode === "PLAYERS"
                    ? pickTimedOutBansFromVotes(state, state.turn, banCount)
                    : pickRandomMaps(state.pool, 1).map((map) => ({
                        map,
                        by: "RANDOM",
                      }));

                let workingState: VetoState = { ...state, pendingVotes: undefined };
                let statusUpdate: "MAP_VETO" | "READY_TO_PLAY" = "MAP_VETO";
                let finalMap: string | undefined;

                for (const banChoice of banChoices) {
                  const result = advanceVetoState({
                    state: workingState,
                    banChoice: banChoice.map,
                    turnTeam: state.turn,
                    by: banChoice.by,
                  });
                  workingState = result.updatedState;
                  statusUpdate = result.statusUpdate;
                  if (result.finalMap) {
                    finalMap = result.finalMap;
                  }
                  if (workingState.phase === "DONE" || workingState.turn !== state.turn) {
                    break;
                  }
                }

                const updateResult = await prisma.scrim.updateMany({
                  where: { id: scrim.id, vetoState: scrim.vetoState },
                  data: {
                    status: statusUpdate,
                    vetoState: JSON.stringify(workingState),
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
