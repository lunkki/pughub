import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { targetPlayerId } = await req.json();
  if (!targetPlayerId || typeof targetPlayerId !== "string") {
    return NextResponse.json(
      { error: "targetPlayerId is required" },
      { status: 400 }
    );
  }

  const scrim = await prisma.scrim.findUnique({
    where: { code },
    include: { players: true },
  });

  if (!scrim) return NextResponse.json({ error: "Scrim not found" }, { status: 404 });

  const me = scrim.players.find((p) => p.userId === user.id);
  if (!me) return NextResponse.json({ error: "Not in scrim" }, { status: 400 });
  if (!me.isCaptain) return NextResponse.json({ error: "Not captain" }, { status: 403 });

  const target = scrim.players.find((p) => p.id === targetPlayerId);
  if (!target) return NextResponse.json({ error: "Player not found" }, { status: 404 });
  if (target.team !== "WAITING_ROOM")
    return NextResponse.json({ error: "Player not in waiting room" }, { status: 400 });

  await prisma.scrimPlayer.update({
    where: { id: target.id },
    data: {
      team: me.team,
      isCaptain: false,
    },
  });

  await prisma.scrim.update({
    where: { id: scrim.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
