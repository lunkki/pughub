// app/api/scrims/[code]/veto/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getNextTeamABBA, type TeamSide, type VetoState, type VetoPhase } from "@/lib/veto";
import { getConnectPassword, launchScrimServer } from "@/lib/serverControl";

const TURN_SECONDS = 40;

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

  const scrim = await prisma.scrim.findUnique({
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
  if (scrim.vetoMode === "PLAYERS") {
    if (!state) {
      return NextResponse.json(
        { error: "Veto state missing" },
        { status: 400 }
      );
    }
    const stateNonNull: VetoState = state;
    const teamPlayers = scrim.players.filter((p) => p.team === myTeam);
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
    state = {
      ...stateNonNull,
      pendingVotes: undefined,
    };
  }

  // --- Apply ban ---
  const newPool = state.pool.filter((m) => m !== banChoice);
  const newBanned = [...state.banned, { map: banChoice, by: myTeam }];

  let newTurn: TeamSide | null = null;
  let phase: VetoPhase = "IN_PROGRESS";
  let finalMap: string | undefined;
  let statusUpdate: "MAP_VETO" | "READY_TO_PLAY" = "MAP_VETO";

  // Finish only when one map remains (let both teams ban down to a single map)
  if (newPool.length <= 1) {
    phase = "DONE";
    newTurn = null;
    finalMap = newPool[0] ?? banChoice;
    statusUpdate = "READY_TO_PLAY";
  } else {
    // If exactly two maps remain, give the *other* team the final ban so they choose between the last two.
    if (newPool.length === 2) {
      newTurn = myTeam === "TEAM1" ? "TEAM2" : "TEAM1";
    } else {
      newTurn = getNextTeamABBA(newBanned.length);
    }
  }

  const deadline = newTurn
    ? new Date(Date.now() + TURN_SECONDS * 1000).toISOString()
    : undefined;

  const updatedState: VetoState = {
    phase,
    pool: newPool,
    banned: newBanned,
    turn: newTurn,
    deadline,
    ...(finalMap ? { finalMap } : {}),
  };

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
