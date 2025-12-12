import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const { mapPool } = await req.json(); // array of ids

  await prisma.scrim.update({
    where: { code },
    data: { mapPool: JSON.stringify(mapPool), updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
