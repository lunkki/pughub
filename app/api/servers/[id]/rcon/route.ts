import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canManageServers } from "@/lib/permissions";
import { runRconCommand } from "@/lib/serverControl";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageServers(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const command = typeof body.command === "string" ? body.command.trim() : "";
  const overrideAddress =
    typeof body.address === "string" && body.address.trim().length > 0
      ? body.address.trim()
      : null;

  if (!command) {
    return NextResponse.json({ error: "Command is required" }, { status: 400 });
  }

  const server = await prisma.server.findUnique({
    where: { id },
  });
  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  const address = overrideAddress ?? server.rconAddress ?? server.address;

  try {
    await runRconCommand({
      address,
      rconPassword: server.rconPassword,
      command,
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("RCON exec failed", err);
    return NextResponse.json(
      { error: "RCON command failed", detail: err?.message },
      { status: 500 }
    );
  }
}
