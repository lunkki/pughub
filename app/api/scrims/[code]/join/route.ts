import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { team } = body as { team: "TEAM1" | "TEAM2" | "WAITING_ROOM" };

  const scrim = await prisma.scrim.findUnique({
    where: { code: code },
    include: { players: true },
  });

  if (!scrim) {
    return NextResponse.json({ error: "Scrim not found" }, { status: 404 });
  }

  const scrimId = scrim.id;

  // 🔒 lock teams once we leave lobby
  if (scrim.status !== "LOBBY") {
    return NextResponse.json(
      { error: "Teams are locked for this scrim" },
      { status: 400 }
    );
  }

  const existing = scrim.players.find((p) => p.userId === user.id);
  if (!existing) {
    return NextResponse.json(
      { error: "User not part of this scrim" },
      { status: 400 }
    );
  }

  const oldTeam = existing.team;

  async function ensureTeamCaptain(team: "TEAM1" | "TEAM2") {
    const playersInTeam = await prisma.scrimPlayer.findMany({
      where: { scrimId, team, isPlaceholder: false },
      orderBy: { joinedAt: "asc" },
    });

    const hasCaptain = playersInTeam.some((p) => p.isCaptain);
    if (!hasCaptain && playersInTeam[0]) {
      await prisma.scrimPlayer.update({
        where: { id: playersInTeam[0].id },
        data: { isCaptain: true },
      });
    }
  }

  // Move player
  await prisma.scrimPlayer.update({
    where: { id: existing.id },
    data: { team, isCaptain: false },
  });

  // Ensure both the old team (if applicable) and the new team still have a captain
  if (oldTeam === "TEAM1" || oldTeam === "TEAM2") {
    await ensureTeamCaptain(oldTeam);
  }
  if (team === "TEAM1" || team === "TEAM2") {
    await ensureTeamCaptain(team);
  }

  // Touch scrim updatedAt so lobby reflects recent changes
  await prisma.scrim.update({
    where: { id: scrim.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
