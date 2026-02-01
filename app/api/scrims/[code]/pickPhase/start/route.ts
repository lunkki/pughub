import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  _req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scrim = await prisma.scrim.findUnique({
    where: { code },
    select: { id: true, creatorId: true, status: true, pickPhase: true },
  });

  if (!scrim) {
    return NextResponse.json({ error: "Scrim not found" }, { status: 404 });
  }

  if (scrim.creatorId !== user.id) {
    return NextResponse.json(
      { error: "Only scrim creator can start phased pick" },
      { status: 403 }
    );
  }

  if (scrim.status !== "LOBBY") {
    return NextResponse.json(
      { error: "Pick phase is locked once scrim starts" },
      { status: 400 }
    );
  }

  if (scrim.pickPhase !== "PHASED_PICK") {
    return NextResponse.json(
      { error: "Pick phase is not set to phased pick" },
      { status: 400 }
    );
  }

  await prisma.scrim.update({
    where: { id: scrim.id },
    data: { pickPhaseStarted: true, updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
