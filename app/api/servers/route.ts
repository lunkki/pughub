import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isScrimStarter } from "@/lib/permissions";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isScrimStarter(user.steamId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const servers = await prisma.server.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ servers });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isScrimStarter(user.steamId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const rconAddress =
    typeof body.rconAddress === "string" ? body.rconAddress.trim() : undefined;
  const rconPassword =
    typeof body.rconPassword === "string" ? body.rconPassword.trim() : "";
  const isActive = typeof body.isActive === "boolean" ? body.isActive : true;

  if (!name || !address || !rconPassword) {
    return NextResponse.json(
      { error: "name, address and rconPassword are required" },
      { status: 400 }
    );
  }

  const server = await prisma.server.create({
    data: {
      name,
      address,
      ...(rconAddress ? { rconAddress } : {}),
      rconPassword,
      isActive,
    },
  });

  return NextResponse.json({ server });
}
