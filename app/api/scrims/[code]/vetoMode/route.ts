import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const { vetoMode } = await req.json();

  await prisma.scrim.update({
    where: { code },
    data: {
      vetoMode,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
