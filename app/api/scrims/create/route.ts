import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canStartScrim } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canStartScrim(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const code = generateCode();

  // Use the first active server, or auto-create a default one so scrim creation works out of the box.
  let server = await prisma.server.findFirst({
    where: { isActive: true },
  });

  if (!server) {
    server = await prisma.server.create({
      data: {
        name: process.env.DEFAULT_SERVER_NAME || "Local Test Server",
        address: process.env.DEFAULT_SERVER_ADDRESS || "127.0.0.1:27015",
        rconAddress:
          process.env.DEFAULT_SERVER_RCON_ADDRESS ||
          process.env.DEFAULT_SERVER_ADDRESS ||
          "127.0.0.1:27015",
        rconPassword:
          process.env.DEFAULT_SERVER_RCON_PASSWORD || "change-me-rcon",
        isActive: true,
      },
    });
  }

  await prisma.scrim.create({
    data: {
      code,
      creatorId: user.id,
      serverId: server.id,
      teamMode: "CAPTAINS",
      players: {
        create: {
          userId: user.id,
          steamId: user.steamId,
          team: "WAITING_ROOM",
          isCaptain: false, // creator starts as a normal player; captain assigned when teams are set
        },
      },
    },
  });



  return NextResponse.json({ code });
}
