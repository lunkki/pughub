import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getNextTeamABBA } from "@/lib/veto";
import { getConnectPassword, launchScrimServer } from "@/lib/serverControl";
import { isScrimStarter } from "@/lib/permissions";

const TURN_SECONDS = 40;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  // Next 16 app routes receive params as a Promise
  const { code } = await context.params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scrim = await prisma.scrim.findUnique({
    where: { code },
    include: { server: true },
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

  if (scrim.creatorId !== user.id) {
    return NextResponse.json({ error: "Only scrim creator can start" }, { status: 403 });
  }

  if (!isScrimStarter(user.steamId)) {
    return NextResponse.json(
      { error: "You are not allowed to start scrims" },
      { status: 403 }
    );
  }

  if (scrim.status !== "LOBBY") {
    return NextResponse.json(
      { error: "Scrim already started" },
      { status: 400 }
    );
  }

  const pool: string[] = scrim.mapPool ? JSON.parse(scrim.mapPool) : [];

  if (pool.length === 0) {
    return NextResponse.json(
      { error: "No maps selected for veto" },
      { status: 400 }
    );
  }

  // If only one map -> skip veto, lock it in
  if (pool.length === 1) {
    const finalMap = pool[0];

    try {
      await prisma.scrim.update({
        where: { id: scrim.id },
        data: {
          status: "READY_TO_PLAY",
          selectedMap: finalMap,
          vetoState: JSON.stringify({
            phase: "DONE",
            pool,
            banned: [],
            turn: null,
            finalMap,
          }),
        },
      });

      await launchScrimServer({
        address: scrim.server.rconAddress ?? scrim.server.address,
        rconPassword: scrim.server.rconPassword,
        map: finalMap,
        connectPassword: getConnectPassword(),
      });
    } catch (err) {
      console.error("Failed to start server via RCON", err);
      return NextResponse.json(
        { error: "Failed to start server via RCON" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: "READY_TO_PLAY",
      finalMap,
    });
  }
  // If two maps -> skip bans, lock one in (first)
  if (pool.length === 2) {
    const finalMap = pool[0];

    try {
      await prisma.scrim.update({
        where: { id: scrim.id },
        data: {
          status: "READY_TO_PLAY",
          selectedMap: finalMap,
          vetoState: JSON.stringify({
            phase: "DONE",
            pool,
            banned: [],
            turn: null,
            finalMap,
          }),
        },
      });

      await launchScrimServer({
        address: scrim.server.rconAddress ?? scrim.server.address,
        rconPassword: scrim.server.rconPassword,
        map: finalMap,
        connectPassword: getConnectPassword(),
      });
    } catch (err) {
      console.error("Failed to start server via RCON", err);
      return NextResponse.json(
        { error: "Failed to start server via RCON" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: "READY_TO_PLAY",
      finalMap,
    });
  }

  // Normal case: start veto
  const deadline = new Date(Date.now() + TURN_SECONDS * 1000).toISOString();

  const initialState = {
    phase: "IN_PROGRESS",
    pool,
    banned: [],
    turn: getNextTeamABBA(0),
    deadline,
  };

  await prisma.scrim.update({
    where: { id: scrim.id },
    data: {
      status: "MAP_VETO",
      vetoState: JSON.stringify(initialState),
    },
  });

  return NextResponse.json({ ok: true, status: "MAP_VETO", state: initialState });
}
