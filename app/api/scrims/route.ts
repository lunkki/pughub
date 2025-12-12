import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
// import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  // TODO: auth
  // const user = await getCurrentUser();
  // if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  const teamMode = body.teamMode === "CAPTAINS" ? "CAPTAINS" : "SHUFFLE";
  const maxPlayers = typeof body.maxPlayers === "number" ? body.maxPlayers : 10;
  const mapPool = typeof body.mapPool === "string" ? body.mapPool : null;

  // TEMP: hardcode serverId until we have admin UI
  const server = await prisma.server.findFirst();
  if (!server) {
    return NextResponse.json(
      { error: "No server configured yet" },
      { status: 400 }
    );
  }

  const code = Math.random().toString(36).substring(2, 8).toUpperCase();

  // TEMP: creatorId is null until auth exists
  const scrim = await prisma.scrim.create({
    data: {
      code,
      creatorId: "TEMP_CREATOR", // TODO: replace with user.id
      serverId: server.id,
      teamMode,
      maxPlayers,
      mapPool
    }
  });

  return NextResponse.json({
    id: scrim.id,
    code: scrim.code,
    url: `/scrims/${scrim.code}`
  });
}
