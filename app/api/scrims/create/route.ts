import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const code = generateCode();

  const server = await prisma.server.findFirst({
  where: { isActive: true }
});

if (!server) {
  return NextResponse.json({ error: "No active server found" }, { status: 500 });
}

await prisma.scrim.create({
  data: {
    code,
    creatorId: user.id,
    serverId: server.id, // <-- CORRECT (real id)
    teamMode: "CAPTAINS",
    players: {
      create: {
        userId: user.id,
        steamId: user.steamId,
        team: "TEAM1",
        isCaptain: true,
      },
    },
  },
});



  return NextResponse.json({ code });
}
