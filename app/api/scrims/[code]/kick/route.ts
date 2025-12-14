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

  const { targetUserId } = (await req.json()) as { targetUserId?: string };
  if (!targetUserId) {
    return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
  }

  const scrim = await prisma.scrim.findUnique({
    where: { code },
    include: { players: true },
  });

  if (!scrim) return NextResponse.json({ error: "Scrim not found" }, { status: 404 });

  if (scrim.creatorId !== user.id) {
    return NextResponse.json({ error: "Only scrim creator can kick" }, { status: 403 });
  }

  if (scrim.status !== "LOBBY") {
    return NextResponse.json({ error: "Players are locked" }, { status: 403 });
  }

  if (targetUserId === user.id) {
    return NextResponse.json({ error: "Cannot kick yourself" }, { status: 400 });
  }

  const target = scrim.players.find((p) => p.userId === targetUserId);
  if (!target) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const oldTeam = target.team;

  await prisma.scrimPlayer.delete({
    where: { id: target.id },
  });

  if (oldTeam === "TEAM1" || oldTeam === "TEAM2") {
    await prisma.scrimPlayer.updateMany({
      where: { scrimId: scrim.id, team: oldTeam },
      data: { isCaptain: false },
    });

    const remaining = await prisma.scrimPlayer.findMany({
      where: { scrimId: scrim.id, team: oldTeam },
      orderBy: { joinedAt: "asc" },
    });

    if (remaining.length > 0) {
      await prisma.scrimPlayer.update({
        where: { id: remaining[0].id },
        data: { isCaptain: true },
      });
    }
  }

  await prisma.scrim.update({
    where: { id: scrim.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

