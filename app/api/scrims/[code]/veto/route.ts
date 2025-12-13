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

  if (scrim.status !== "STARTING") {
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

  // --- Apply ban ---
  const newPool = state.pool.filter((m) => m !== map);
  const newBanned = [...state.banned, { map, by: myTeam }];

  let newTurn: TeamSide | null = null;
  let phase: VetoPhase = "IN_PROGRESS";
  let finalMap: string | undefined;
  let statusUpdate: "STARTING" | "IN_PROGRESS" = "STARTING";

  // Finish only when one map remains (let both teams ban down to a single map)
  if (newPool.length <= 1) {
    phase = "DONE";
    newTurn = null;
    finalMap = newPool[0] ?? map;
    statusUpdate = "IN_PROGRESS";
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

    if (finalMap) {
      await launchScrimServer({
        address: scrim.server.address,
        rconPassword: scrim.server.rconPassword,
        map: finalMap,
        connectPassword: getConnectPassword(),
      });
    }
  } catch (err) {
    console.error("Failed to update veto / launch server", err);
    return NextResponse.json(
      { error: "Failed to update veto state" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, state: updatedState });
}
