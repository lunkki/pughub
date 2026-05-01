import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import type { ReadyCheckStatus } from "@/lib/veto";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    status?: ReadyCheckStatus;
  };

  if (body.status !== "READY" && body.status !== "NOT_READY") {
    return NextResponse.json({ error: "Invalid ready status" }, { status: 400 });
  }

  const scrim = await prisma.scrim.findUnique({
    where: { code },
    include: { players: true },
  });

  if (!scrim) {
    return NextResponse.json({ error: "Scrim not found" }, { status: 404 });
  }

  if (scrim.status !== "LOBBY" || !scrim.readyCheckStartedAt || !scrim.readyCheckEndsAt) {
    return NextResponse.json(
      { error: "No ready check is currently active" },
      { status: 400 }
    );
  }

  if (new Date(scrim.readyCheckEndsAt).getTime() < Date.now()) {
    return NextResponse.json(
      { error: "Ready check has expired" },
      { status: 400 }
    );
  }

  const player = scrim.players.find((p) => p.userId === user.id);
  if (!player) {
    return NextResponse.json(
      { error: "You are not part of this scrim" },
      { status: 400 }
    );
  }

  await prisma.scrimPlayer.update({
    where: { id: player.id },
    data: { readyCheckStatus: body.status },
  });

  await prisma.scrim.update({
    where: { id: scrim.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true, status: body.status });
}
