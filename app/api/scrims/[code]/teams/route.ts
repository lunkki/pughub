import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getFaceitProfileCache } from "@/lib/faceitProfiles";
import { fetchRecentPlayerMatchSummaries } from "@/lib/matchzy";
import { getRatingFromTotals } from "@/lib/matchStatsFormat";

type TeamAssignment = "SCRAMBLE" | "RANDOM";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scrim = await prisma.scrim.findUnique({
    where: { code },
    include: {
      players: { include: { user: true } },
    },
  });

  if (!scrim) {
    return NextResponse.json({ error: "Scrim not found" }, { status: 404 });
  }

  if (scrim.creatorId !== user.id) {
    return NextResponse.json(
      { error: "Only scrim creator can assign teams" },
      { status: 403 }
    );
  }

  if (scrim.status !== "LOBBY") {
    return NextResponse.json(
      { error: "Teams are locked for this scrim" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const { mode } = body as { mode: TeamAssignment };

  if (mode !== "SCRAMBLE" && mode !== "RANDOM") {
    return NextResponse.json({ error: "Unsupported mode" }, { status: 400 });
  }

  const candidates = scrim.players.filter(
    (p) => !p.isPlaceholder && p.userId && p.steamId
  );

  if (candidates.length === 0) {
    return NextResponse.json(
      { error: "No eligible players to assign" },
      { status: 400 }
    );
  }

  const uniqueSteamIds = Array.from(
    new Set(candidates.map((p) => p.steamId as string))
  );

  const faceitCache = new Map<string, { level: number | null }>();
  try {
    const cache = await getFaceitProfileCache(uniqueSteamIds);
    for (const [steamId, entry] of cache) {
      faceitCache.set(steamId, { level: entry.level ?? null });
    }
  } catch {
    // ignore faceit failures
  }

  const ratingCache = new Map<string, number>();
  try {
    const summaries = await Promise.all(
      uniqueSteamIds.map(async (steamId) => {
        const matches = await fetchRecentPlayerMatchSummaries(steamId, 5);
        const ratings = matches
          .map((match) =>
            getRatingFromTotals(
              {
                kills: match.kills,
                deaths: match.deaths,
                assists: match.assists,
                damage: match.damage,
                clutchWins: match.clutchWins,
              },
              match.rounds
            )
          )
          .filter((rating): rating is number => rating !== null);
        if (ratings.length === 0) return { steamId, rating: null };
        const average =
          ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
        return { steamId, rating: average };
      })
    );
    for (const entry of summaries) {
      if (entry.rating !== null) {
        ratingCache.set(entry.steamId, entry.rating);
      }
    }
  } catch {
    // ignore rating failures
  }

  const weightedPlayers = candidates.map((player) => {
    const steamId = player.steamId as string;
    const faceitLevel = faceitCache.get(steamId)?.level ?? null;
    const rating = ratingCache.get(steamId) ?? 1.0;
    const faceitWeight = faceitLevel ? faceitLevel * 200 : 0;
    const ratingWeight = rating * 100;
    const baseWeight =
      faceitLevel !== null ? faceitWeight + ratingWeight : ratingWeight;
    const weight = mode === "RANDOM" ? 0 : baseWeight;
    return { player, weight, faceitLevel, rating };
  });

  const shuffled = [...weightedPlayers];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  if (mode === "SCRAMBLE") {
    shuffled.sort((a, b) => b.weight - a.weight);
  }

  const team1: typeof shuffled = [];
  const team2: typeof shuffled = [];
  let team1Weight = 0;
  let team2Weight = 0;

  for (const entry of shuffled) {
    if (team1.length === team2.length) {
      if (team1Weight <= team2Weight) {
        team1.push(entry);
        team1Weight += entry.weight;
      } else {
        team2.push(entry);
        team2Weight += entry.weight;
      }
      continue;
    }
    if (team1.length < team2.length) {
      team1.push(entry);
      team1Weight += entry.weight;
    } else {
      team2.push(entry);
      team2Weight += entry.weight;
    }
  }

  const updates = [
    ...team1.map((entry) =>
      prisma.scrimPlayer.update({
        where: { id: entry.player.id },
        data: { team: "TEAM1", isCaptain: false },
      })
    ),
    ...team2.map((entry) =>
      prisma.scrimPlayer.update({
        where: { id: entry.player.id },
        data: { team: "TEAM2", isCaptain: false },
      })
    ),
  ];

  await prisma.$transaction(updates);

  // Ensure captains exist in each team
  const assignCaptain = async (team: "TEAM1" | "TEAM2") => {
    const teamPlayers = await prisma.scrimPlayer.findMany({
      where: { scrimId: scrim.id, team, isPlaceholder: false },
      orderBy: { joinedAt: "asc" },
    });
    if (!teamPlayers.some((p) => p.isCaptain) && teamPlayers[0]) {
      await prisma.scrimPlayer.update({
        where: { id: teamPlayers[0].id },
        data: { isCaptain: true },
      });
    }
  };

  await assignCaptain("TEAM1");
  await assignCaptain("TEAM2");

  await prisma.scrim.update({
    where: { id: scrim.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
