import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scrim = await prisma.scrim.findUnique({
    where: { code },
    select: { id: true, creatorId: true, status: true },
  });

  if (!scrim) {
    return NextResponse.json({ error: "Scrim not found" }, { status: 404 });
  }

  if (scrim.creatorId !== user.id) {
    return NextResponse.json(
      { error: "Only scrim creator can change pick phase" },
      { status: 403 }
    );
  }

  if (scrim.status !== "LOBBY") {
    return NextResponse.json(
      { error: "Pick phase is locked once scrim starts" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const { pickPhase } = body as {
    pickPhase: "CAPTAIN_FREEPICK" | "PHASED_PICK" | "SCRAMBLE" | "RANDOM";
  };

  await prisma.scrim.update({
    where: { id: scrim.id },
    data: { pickPhase, pickPhaseStarted: false, updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
