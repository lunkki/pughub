import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canStartScrim } from "@/lib/permissions";

const READY_CHECK_DURATION_MS = 30_000;

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
    include: { players: true },
  });

  if (!scrim) {
    return NextResponse.json({ error: "Scrim not found" }, { status: 404 });
  }

  if (scrim.creatorId !== user.id || !canStartScrim(user)) {
    return NextResponse.json(
      { error: "Only the scrim creator can start a ready check" },
      { status: 403 }
    );
  }

  if (scrim.status !== "LOBBY") {
    return NextResponse.json(
      { error: "Ready check is only available in the lobby" },
      { status: 400 }
    );
  }

  const mapPool: string[] = scrim.mapPool ? JSON.parse(scrim.mapPool) : [];
  if (mapPool.length < 1) {
    return NextResponse.json(
      { error: "Add at least one map before starting a ready check" },
      { status: 400 }
    );
  }

  const existingReadyCheckExpired =
    scrim.readyCheckStartedAt &&
    scrim.readyCheckEndsAt &&
    new Date(scrim.readyCheckEndsAt).getTime() <= Date.now();

  if (
    scrim.readyCheckStartedAt &&
    scrim.readyCheckEndsAt &&
    !existingReadyCheckExpired
  ) {
    return NextResponse.json(
      { error: "Ready check is already active" },
      { status: 400 }
    );
  }

  if (existingReadyCheckExpired) {
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
  }

  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + READY_CHECK_DURATION_MS);

  await prisma.$transaction([
    prisma.scrim.update({
      where: { id: scrim.id },
      data: {
        readyCheckStartedAt: startedAt,
        readyCheckEndsAt: endsAt,
      },
    }),
    prisma.scrimPlayer.updateMany({
      where: {
        scrimId: scrim.id,
        readyCheckStatus: "NOT_READY",
      },
      data: { readyCheckStatus: null },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    readyCheckStartedAt: startedAt.toISOString(),
    readyCheckEndsAt: endsAt.toISOString(),
  });
}
