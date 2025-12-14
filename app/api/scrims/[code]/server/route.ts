import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isScrimStarter } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isScrimStarter(user.steamId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { serverId } = (await req.json()) as { serverId?: string };
  if (!serverId) {
    return NextResponse.json({ error: "serverId is required" }, { status: 400 });
  }

  const scrim = await prisma.scrim.findUnique({
    where: { code },
    select: { id: true, creatorId: true, status: true },
  });

  if (!scrim) return NextResponse.json({ error: "Scrim not found" }, { status: 404 });

  if (scrim.creatorId !== user.id) {
    return NextResponse.json({ error: "Only scrim creator can change server" }, { status: 403 });
  }

  if (scrim.status !== "LOBBY") {
    return NextResponse.json({ error: "Server is locked" }, { status: 403 });
  }

  const server = await prisma.server.findUnique({
    where: { id: serverId },
    select: { id: true, isActive: true },
  });

  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });
  if (!server.isActive) {
    return NextResponse.json({ error: "Server is not active" }, { status: 400 });
  }

  await prisma.scrim.update({
    where: { id: scrim.id },
    data: { serverId, updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

