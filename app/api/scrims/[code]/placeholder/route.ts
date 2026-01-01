import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canManageLobbyPlayers } from "@/lib/permissions";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageLobbyPlayers(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 32) {
    return NextResponse.json(
      { error: "Name must be between 2 and 32 characters." },
      { status: 400 }
    );
  }

  const scrim = await prisma.scrim.findUnique({
    where: { code },
    select: { id: true, status: true },
  });

  if (!scrim) return NextResponse.json({ error: "Scrim not found" }, { status: 404 });
  if (scrim.status !== "LOBBY") {
    return NextResponse.json(
      { error: "Teams are locked for this scrim" },
      { status: 400 }
    );
  }

  await prisma.scrimPlayer.create({
    data: {
      scrimId: scrim.id,
      displayName: name,
      isPlaceholder: true,
      team: "WAITING_ROOM",
      isCaptain: false,
    },
  });

  await prisma.scrim.update({
    where: { id: scrim.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
