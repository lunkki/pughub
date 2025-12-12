import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSteamProfile } from "@/lib/steam";
import { createSession } from "@/lib/session";

const STEAM_OPENID_URL = "https://steamcommunity.com/openid/login";

function buildQuery(params: Record<string, string>) {
  return new URLSearchParams(params).toString();
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const redirectBack =
    url.searchParams.get("redirect") || "/"; // default home

  // --- Step 2: Handle callback from Steam ---
  if (url.searchParams.has("openid.claimed_id")) {
    const steamId = url.searchParams
      .get("openid.claimed_id")!
      .replace("https://steamcommunity.com/openid/id/", "");

    const profile = await getSteamProfile(steamId);

    // Create or update user
    const user = await prisma.user.upsert({
      where: { steamId },
      update: {
        displayName: profile?.name ?? "",
        avatarUrl: profile?.avatar ?? null,
      },
      create: {
        steamId,
        displayName: profile?.name ?? "",
        avatarUrl: profile?.avatar ?? null,
      },
    });

    // Create session cookie
    const token = await createSession(user.id);

    const redirectUrl = `${process.env.STEAM_REALM}${redirectBack}`;

    const res = NextResponse.redirect(redirectUrl);

    res.cookies.set({
      name: "session",
      value: token,
      httpOnly: true,
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  }

  // --- Step 1: Start Steam login ---
  // Add redirect parameter to Steam return URL
  const returnTo = `${process.env.STEAM_RETURN_URL}?redirect=${encodeURIComponent(
    redirectBack
  )}`;

  const steamRedirect =
    `${STEAM_OPENID_URL}?` +
    buildQuery({
      "openid.ns": "http://specs.openid.net/auth/2.0",
      "openid.mode": "checkid_setup",
      "openid.return_to": returnTo,
      "openid.realm": process.env.STEAM_REALM!,
      "openid.identity":
        "http://specs.openid.net/auth/2.0/identifier_select",
      "openid.claimed_id":
        "http://specs.openid.net/auth/2.0/identifier_select",
    });

  return NextResponse.redirect(steamRedirect);
}
