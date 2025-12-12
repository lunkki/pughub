import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const body = await req.json();

  await prisma.scrim.update({
    where: { code },
    data: { vetoOption: body.vetoOption },
  });

  return NextResponse.json({ ok: true });
}
