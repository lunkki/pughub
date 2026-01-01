import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canManageRoles } from "@/lib/permissions";

const allowedRoles = new Set(["PLAYER", "MANAGER", "ADMIN"] as const);

type AllowedRole = "PLAYER" | "MANAGER" | "ADMIN";

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageRoles(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : "";
  const role = typeof body.role === "string" ? body.role : "";

  if (!userId || !allowedRoles.has(role as AllowedRole)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (userId === user.id && role !== "ADMIN") {
    return NextResponse.json(
      { error: "You cannot change your own role." },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: role as AllowedRole },
      select: { id: true, role: true },
    });

    return NextResponse.json({ user: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to update role" },
      { status: 500 }
    );
  }
}
