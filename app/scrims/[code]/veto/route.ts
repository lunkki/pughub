import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: { code: string } }) {
  const body = await req.json();

  await prisma.scrim.update({
    where: { code: params.code },
    data: { vetoOption: body.vetoOption },
  });

  return NextResponse.json({ ok: true });
}
