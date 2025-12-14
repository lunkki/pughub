import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSteamProfile } from "@/lib/steam";
import { createSession } from "@/lib/session";

const STEAM_OPENID_URL = "https://steamcommunity.com/openid/login";

function normalizeUrl(raw: string | undefined, fallback: string) {
  if (!raw || raw.trim() === "") return fallback;
  const trimmed = raw.trim();
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed.replace(/^\/+/, "")}`;
}

function buildQuery(params: Record<string, string>) {
  return new URLSearchParams(params).toString();
}

function normalizeRedirectPath(raw: string | null): string {
  if (!raw) return "/";
  // Only allow same-origin relative paths
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  return raw;
}

function getSteamIdFromClaimedId(claimedId: string): string | null {
  const prefix = "https://steamcommunity.com/openid/id/";
  if (!claimedId.startsWith(prefix)) return null;
  const steamId = claimedId.slice(prefix.length);
  // SteamID64 is a 17-digit number
  if (!/^\d{17}$/.test(steamId)) return null;
  return steamId;
}

async function verifySteamOpenIdCallback(url: URL): Promise<boolean> {
  // Steam OpenID requires verifying the callback parameters via check_authentication.
  const params = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    if (key.startsWith("openid.")) {
      params.set(key, value);
    }
  }
  params.set("openid.mode", "check_authentication");

  const res = await fetch(STEAM_OPENID_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) return false;
  const text = await res.text();
  // Response is newline-separated key:value pairs
  return /\bis_valid\s*:\s*true\b/.test(text);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const realm = normalizeUrl(
    process.env.STEAM_REALM,
    `${url.protocol}//${url.host}`
  );
  const returnUrlBase = normalizeUrl(
    process.env.STEAM_RETURN_URL,
    `${realm}/api/auth/steam`
  );

  const redirectBack = normalizeRedirectPath(url.searchParams.get("redirect"));

  // --- Step 2: Handle callback from Steam ---
  if (url.searchParams.has("openid.claimed_id")) {
    const verified = await verifySteamOpenIdCallback(url);
    if (!verified) {
      return NextResponse.json(
        { error: "Steam OpenID verification failed" },
        { status: 401 }
      );
    }

    const claimedId = url.searchParams.get("openid.claimed_id")!;
    const steamId = getSteamIdFromClaimedId(claimedId);
    if (!steamId) {
      return NextResponse.json(
        { error: "Invalid Steam claimed_id" },
        { status: 400 }
      );
    }

    const profile = await getSteamProfile(steamId);

    // Create or update user
    const user = await prisma.user.upsert({
      where: { steamId },
      update: {
        ...(profile?.name ? { displayName: profile.name } : {}),
        avatarUrl: profile?.avatar ?? null,
      },
      create: {
        steamId,
        displayName: profile?.name ?? steamId,
        avatarUrl: profile?.avatar ?? null,
      },
    });

    // Create session cookie
    const token = await createSession(user.id);

    const redirectUrl = `${realm}${redirectBack}`;

    const res = NextResponse.redirect(redirectUrl);

    res.cookies.set({
      name: "session",
      value: token,
      httpOnly: true,
      secure: realm.startsWith("https://"),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  }

  // --- Step 1: Start Steam login ---
  // Add redirect parameter to Steam return URL
  const returnTo = `${returnUrlBase}?redirect=${encodeURIComponent(redirectBack)}`;

  const steamRedirect =
    `${STEAM_OPENID_URL}?` +
    buildQuery({
      "openid.ns": "http://specs.openid.net/auth/2.0",
      "openid.mode": "checkid_setup",
      "openid.return_to": returnTo,
      "openid.realm": realm,
      "openid.identity":
        "http://specs.openid.net/auth/2.0/identifier_select",
      "openid.claimed_id":
        "http://specs.openid.net/auth/2.0/identifier_select",
    });

  return NextResponse.redirect(steamRedirect);
}
