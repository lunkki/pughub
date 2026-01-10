// app/api/scrims/[code]/veto/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  advanceVetoState,
  getVetoVoteLimit,
  type TeamSide,
  type VetoState,
} from "@/lib/veto";
import { getConnectPassword, launchScrimServer } from "@/lib/serverControl";

function normalizeSelections(
  selections?: Record<string, string[] | string>
): Record<string, string[]> {
  if (!selections) return {};
  const normalized: Record<string, string[]> = {};
  for (const [userId, selection] of Object.entries(selections)) {
    if (Array.isArray(selection)) {
      normalized[userId] = selection.filter((m) => typeof m === "string");
    } else if (typeof selection === "string") {
      normalized[userId] = [selection];
    }
  }
  return normalized;
}

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
    const remaining = pool.filter((m) => !picks.includes(m));
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

  const selections = normalizeSelections(state.pendingVotes.selections);
  const counts: Record<string, number> = {};
  Object.values(selections).forEach((maps) => {
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

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  // Next 16: params is a Promise
  const { code } = await context.params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let scrim = await prisma.scrim.findUnique({
    where: { code },
    include: { players: true, server: true },
  });

  if (!scrim) {
    return NextResponse.json({ error: "Scrim not found" }, { status: 404 });
  }
  if (!scrim.server) {
    return NextResponse.json(
      { error: "No server configured for this scrim" },
      { status: 500 }
    );
  }

  if (scrim.status !== "MAP_VETO") {
    return NextResponse.json(
      { error: "Veto is not in progress" },
      { status: 400 }
    );
  }

  async function autoBanExpiredTurn(currentScrim: NonNullable<typeof scrim>) {
    const state: VetoState | null = currentScrim.vetoState
      ? JSON.parse(currentScrim.vetoState)
      : null;

    if (
      !state ||
      state.phase !== "IN_PROGRESS" ||
      !state.turn ||
      !state.deadline ||
      state.pool.length === 0
    ) {
      return null;
    }

    if (new Date(state.deadline).getTime() > Date.now()) {
      return null;
    }

    const banCount =
      currentScrim.vetoMode === "PLAYERS" ? getVetoVoteLimit(state) : 1;
    const banChoices: BanChoice[] =
      currentScrim.vetoMode === "PLAYERS"
        ? pickTimedOutBansFromVotes(state, state.turn, banCount)
        : pickRandomMaps(state.pool, 1).map((map) => ({ map, by: "RANDOM" }));

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

    try {
      const updateResult = await prisma.scrim.updateMany({
        where: { id: currentScrim.id, vetoState: currentScrim.vetoState },
        data: {
          status: statusUpdate,
          vetoState: JSON.stringify(workingState),
          ...(finalMap ? { selectedMap: finalMap } : {}),
        },
      });

      if (updateResult.count === 0) {
        return null;
      }

      if (finalMap && currentScrim.server) {
        try {
          await launchScrimServer({
            address: currentScrim.server.rconAddress ?? currentScrim.server.address,
            rconPassword: currentScrim.server.rconPassword,
            map: finalMap,
            connectPassword: getConnectPassword(),
          });
        } catch (err) {
          console.error("Auto-veto RCON launch failed", err);
        }
      }

      return {
        ...currentScrim,
        status: statusUpdate,
        vetoState: JSON.stringify(workingState),
        ...(finalMap ? { selectedMap: finalMap } : {}),
      };
    } catch (err) {
      console.error("Auto-veto update failed", err);
      return null;
    }
  }

  const autoScrim = scrim ? await autoBanExpiredTurn(scrim) : null;
  if (autoScrim) {
    scrim = autoScrim;
  }

  const player = scrim.players.find((p) => p.userId === user.id);
  if (!player || (player.team !== "TEAM1" && player.team !== "TEAM2")) {
    return NextResponse.json(
      { error: "You are not on a team in this scrim" },
      { status: 400 }
    );
  }

  const myTeam = player.team as TeamSide;

  // Enforce veto mode: CAPTAINS vs PLAYERS
  if (scrim.vetoMode === "CAPTAINS" && !player.isCaptain) {
    return NextResponse.json(
      { error: "Only captains can veto maps" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { action, map } = body as { action: "BAN"; map: string };

  let state: VetoState | null = scrim.vetoState
    ? JSON.parse(scrim.vetoState)
    : null;

  if (!state || state.phase !== "IN_PROGRESS") {
    return NextResponse.json(
      { error: "Veto not initialised" },
      { status: 400 }
    );
  }

  if (state.turn !== myTeam) {
    return NextResponse.json(
      { error: "It is not your team's turn" },
      { status: 403 }
    );
  }

  if (action !== "BAN") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  if (!state.pool.includes(map)) {
    return NextResponse.json(
      { error: "Map is not in remaining pool" },
      { status: 400 }
    );
  }

  let updatedState: VetoState | null = null;
  let statusUpdate: "MAP_VETO" | "READY_TO_PLAY" | null = null;
  let finalMap: string | undefined;

  if (scrim.vetoMode === "PLAYERS") {
    if (!state) {
      return NextResponse.json(
        { error: "Veto state missing" },
        { status: 400 }
      );
    }
    const stateNonNull: VetoState = state;
    const teamPlayers = scrim.players.filter(
      (p) => p.team === myTeam && !p.isPlaceholder && p.userId
    );
    const currentTurn = stateNonNull.banned.length;
    const voteLimit = getVetoVoteLimit(stateNonNull);

    const isSameTurnPending =
      stateNonNull.pendingVotes &&
      stateNonNull.pendingVotes.turn === currentTurn &&
      stateNonNull.pendingVotes.team === myTeam;

    const existingSelections = normalizeSelections(
      isSameTurnPending ? stateNonNull.pendingVotes?.selections : undefined
    );
    const userSelections = new Set(existingSelections[user.id] ?? []);

    if (userSelections.has(map)) {
      userSelections.delete(map);
    } else {
      userSelections.add(map);
      if (userSelections.size > voteLimit) {
        return NextResponse.json(
          { error: `You can vote for up to ${voteLimit} maps` },
          { status: 400 }
        );
      }
    }

    const selections = { ...existingSelections };
    if (userSelections.size === 0) {
      delete selections[user.id];
    } else {
      selections[user.id] = Array.from(userSelections);
    }

    const voterIds = teamPlayers
      .map((p) => p.userId)
      .filter((id): id is string => Boolean(id));
    const activeVoters = voterIds.length > 0 ? voterIds : [user.id];
    const allVoted = activeVoters.every(
      (id) => (selections[id]?.length ?? 0) >= voteLimit
    );

    if (!allVoted) {
      const pendingState: VetoState = {
        ...stateNonNull,
        pendingVotes: { team: myTeam, turn: currentTurn, selections },
      };

      await prisma.scrim.update({
        where: { id: scrim.id },
        data: {
          vetoState: JSON.stringify(pendingState),
        },
      });

      return NextResponse.json({ ok: true, state: pendingState, pending: true });
    }

    // All votes in -> pick top maps by vote (ties broken randomly)
    const counts: Record<string, number> = {};
    Object.values(selections).forEach((maps) => {
      maps.forEach((m) => {
        counts[m] = (counts[m] ?? 0) + 1;
      });
    });
    const banChoices = pickTopMaps(counts, stateNonNull.pool, voteLimit);

    let workingState: VetoState = {
      ...stateNonNull,
      pendingVotes: undefined,
    };
    let workingStatus: "MAP_VETO" | "READY_TO_PLAY" = "MAP_VETO";
    let workingFinal: string | undefined;

    for (const banChoice of banChoices) {
      const result = advanceVetoState({
        state: workingState,
        banChoice,
        turnTeam: myTeam,
      });
      workingState = result.updatedState;
      workingStatus = result.statusUpdate;
      if (result.finalMap) {
        workingFinal = result.finalMap;
      }
      if (workingState.phase === "DONE" || workingState.turn !== myTeam) {
        break;
      }
    }

    updatedState = workingState;
    statusUpdate = workingStatus;
    finalMap = workingFinal;
  } else {
    const result = advanceVetoState({
      state: { ...state, pendingVotes: undefined },
      banChoice: map,
      turnTeam: myTeam,
    });
    updatedState = result.updatedState;
    statusUpdate = result.statusUpdate;
    finalMap = result.finalMap;
  }

  if (!updatedState || !statusUpdate) {
    return NextResponse.json({ error: "Veto state missing" }, { status: 400 });
  }

  try {
    await prisma.scrim.update({
      where: { id: scrim.id },
      data: {
        status: statusUpdate,
        vetoState: JSON.stringify(updatedState),
        ...(finalMap ? { selectedMap: finalMap } : {}),
      },
    });
  } catch (err) {
    console.error("Failed to persist veto state", err);
    return NextResponse.json(
      { error: "Failed to update veto state" },
      { status: 500 }
    );
  }

  let rconError: string | null = null;
  if (finalMap) {
    try {
      await launchScrimServer({
        address: scrim.server.rconAddress ?? scrim.server.address,
        rconPassword: scrim.server.rconPassword,
        map: finalMap,
        connectPassword: getConnectPassword(),
      });
    } catch (err) {
      console.error("Failed to launch server via RCON", err);
      rconError = "RCON launch failed";
      // Do not fail the veto state update if RCON fails; lobby will still have the final map.
    }
  }

  return NextResponse.json({ ok: true, state: updatedState, rconError });
}
