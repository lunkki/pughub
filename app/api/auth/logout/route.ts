import { NextResponse } from "next/server";

export async function GET() {
  const base = process.env.STEAM_REALM || "http://localhost:3000";

  const res = NextResponse.redirect(`${base}/`);

  res.cookies.set({
    name: "session",
    value: "",
    httpOnly: true,
    secure: false,   // true in production HTTPS
    path: "/",
    maxAge: 0,
  });

  return res;
}
