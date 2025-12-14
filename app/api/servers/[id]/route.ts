import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isScrimStarter } from "@/lib/permissions";

const serverSelect = {
  id: true,
  name: true,
  address: true,
  rconAddress: true,
  isActive: true,
} as const;

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isScrimStarter(user.steamId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const data: Record<string, any> = {};

  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.address === "string") data.address = body.address.trim();
  if (typeof body.rconPassword === "string")
    data.rconPassword = body.rconPassword.trim();
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.rconAddress === "string")
    data.rconAddress = body.rconAddress.trim();

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  await prisma.server.update({
    where: { id },
    data,
  });

  const server = await prisma.server.findUnique({
    where: { id },
    select: serverSelect,
  });

  return NextResponse.json({ server });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isScrimStarter(user.steamId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.server.delete({
    where: { id },
  });

  return NextResponse.json({ ok: true });
}
