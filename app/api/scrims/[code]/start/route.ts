import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getNextTeamABBA } from "@/lib/veto";

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
  });

  if (!scrim) {
    return NextResponse.json({ error: "Scrim not found" }, { status: 404 });
  }

  if (scrim.creatorId !== user.id) {
    return NextResponse.json({ error: "Only scrim creator can start" }, { status: 403 });
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

    await prisma.scrim.update({
      where: { id: scrim.id },
      data: {
        status: "IN_PROGRESS",
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

    return NextResponse.json({ ok: true, status: "IN_PROGRESS", finalMap });
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
      status: "STARTING", // "veto in progress"
      vetoState: JSON.stringify(initialState),
    },
  });

  return NextResponse.json({ ok: true, status: "STARTING", state: initialState });
}
