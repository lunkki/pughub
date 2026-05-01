import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;

  const scrim = await prisma.scrim.findUnique({
    where: { code },
    select: {
      id: true,
      status: true,
      readyCheckStartedAt: true,
      readyCheckEndsAt: true,
    },
  });

  if (!scrim) {
    return NextResponse.json({ error: "Scrim not found" }, { status: 404 });
  }

  if (
    scrim.status !== "LOBBY" ||
    !scrim.readyCheckStartedAt ||
    !scrim.readyCheckEndsAt
  ) {
    return NextResponse.json({ ok: true, expired: false });
  }

  if (new Date(scrim.readyCheckEndsAt).getTime() > Date.now()) {
    return NextResponse.json({ ok: true, expired: false });
  }

  await prisma.$transaction([
    prisma.scrimPlayer.updateMany({
      where: {
        scrimId: scrim.id,
        readyCheckStatus: null,
      },
      data: {
        readyCheckStatus: "NOT_READY",
      },
    }),
    prisma.scrim.update({
      where: { id: scrim.id },
      data: {
        readyCheckStartedAt: null,
        readyCheckEndsAt: null,
        updatedAt: new Date(),
      },
    }),
  ]);

  return NextResponse.json({ ok: true, expired: true });
}
