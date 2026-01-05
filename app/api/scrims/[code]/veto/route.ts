// app/api/scrims/[code]/veto/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { advanceVetoState, type TeamSide, type VetoState } from "@/lib/veto";
import { getConnectPassword, launchScrimServer } from "@/lib/serverControl";

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

    const banChoice = state.pool[Math.floor(Math.random() * state.pool.length)];

    const { updatedState, statusUpdate, finalMap } = advanceVetoState({
      state: { ...state, pendingVotes: undefined },
      banChoice,
      turnTeam: state.turn,
      by: "RANDOM",
    });

    try {
      const updateResult = await prisma.scrim.updateMany({
        where: { id: currentScrim.id, vetoState: currentScrim.vetoState },
        data: {
          status: statusUpdate,
          vetoState: JSON.stringify(updatedState),
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
        vetoState: JSON.stringify(updatedState),
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
  let banChoice = map;

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

  // --- Player-vote veto mode ---
  let baseState: VetoState | null = state ? { ...state, pendingVotes: undefined } : null;

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
    const totalVoters = Math.max(teamPlayers.length, 1);
    const currentTurn = stateNonNull.banned.length;

    const isSameTurnPending =
      stateNonNull.pendingVotes &&
      stateNonNull.pendingVotes.turn === currentTurn &&
      stateNonNull.pendingVotes.team === myTeam;

    const selections = {
      ...(isSameTurnPending ? stateNonNull.pendingVotes?.selections ?? {} : {}),
      [user.id]: banChoice,
    };

    const allVoted = Object.keys(selections).length >= totalVoters;

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

    // All votes in -> pick the map with most votes (ties broken randomly)
    const counts: Record<string, number> = {};
    Object.values(selections).forEach((m) => {
      counts[m] = (counts[m] ?? 0) + 1;
    });
    const maxVotes = Math.max(...Object.values(counts));
    const topMaps = Object.entries(counts)
      .filter(([_, v]) => v === maxVotes)
      .map(([m]) => m)
      .filter((m) => stateNonNull.pool.includes(m));

    banChoice =
      topMaps.length === 0
        ? stateNonNull.pool[0]
        : topMaps[Math.floor(Math.random() * topMaps.length)];

    // Clear pending votes for next turn
    baseState = {
      ...stateNonNull,
      pendingVotes: undefined,
    };
  }

  if (!baseState) {
    return NextResponse.json({ error: "Veto state missing" }, { status: 400 });
  }

  const { updatedState, statusUpdate, finalMap } = advanceVetoState({
    state: baseState,
    banChoice,
    turnTeam: myTeam,
  });

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
