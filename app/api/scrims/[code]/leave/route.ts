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

  const scrim = await prisma.scrim.findUnique({
    where: { code },
    include: { players: true },
  });

  if (!scrim) return NextResponse.json({ error: "Scrim not found" }, { status: 404 });

    if (scrim.status !== "LOBBY") {
    return NextResponse.json({ error: "Teams are locked" }, { status: 403 });
  }

  const player = scrim.players.find((p) => p.userId === user.id);
  if (!player) return NextResponse.json({ error: "Not in scrim" }, { status: 400 });

  const oldTeam = player.team;

  await prisma.scrimPlayer.update({
    where: { id: player.id },
    data: {
      team: "WAITING_ROOM",
      isCaptain: false,
    },
  });

  // Captain reassignment
  if (oldTeam === "TEAM1" || oldTeam === "TEAM2") {
    const remaining = await prisma.scrimPlayer.findMany({
      where: { scrimId: scrim.id, team: oldTeam, isPlaceholder: false },
      orderBy: { joinedAt: "asc" },
    });

    if (remaining.length > 0) {
      await prisma.scrimPlayer.update({
        where: { id: remaining[0].id },
        data: { isCaptain: true },
      });
    }
  }

  // SSE trigger
  await prisma.scrim.update({
    where: { id: scrim.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
