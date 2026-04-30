import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSteamProfileCache } from "@/lib/steamProfiles";
import { getFaceitProfileCache, normalizeFaceitUrl } from "@/lib/faceitProfiles";
import {
  type PlayerTotals,
  fetchPlayerTotals,
  fetchRecentPlayerMatchSummaries,
  hasMatchzyConfig,
} from "@/lib/matchzy";
import { getRatingFromTotals } from "@/lib/matchStatsFormat";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type PreviewMatch = {
  matchId: number;
  mapName: string;
  result: "W" | "L" | "-";
  score: string;
  kills: number;
  deaths: number;
  assists: number;
  rating: number | null;
};

export async function GET(
  _req: Request,
  context: { params: Promise<{ steamId: string }> }
) {
  const { steamId } = await context.params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hasConfig = hasMatchzyConfig();
  let matchError: string | null = null;
  let totals: PlayerTotals | null = null;
  let recent: Awaited<ReturnType<typeof fetchRecentPlayerMatchSummaries>> = [];
  let faceitError: string | null = null;

  if (!hasConfig) {
    matchError =
      "MatchZy database configuration missing. Set MATCHZY_DB_URL or MATCHZY_DB_HOST/MATCHZY_DB_USER/MATCHZY_DB_NAME in your environment.";
  } else {
    try {
      totals = await fetchPlayerTotals(steamId);
      recent = await fetchRecentPlayerMatchSummaries(steamId, 10);
    } catch (err) {
      matchError =
        err instanceof Error ? err.message : "Failed to load match stats.";
    }
  }

  let profileName = steamId;
  let avatarUrl: string | null = null;
  try {
    const cache = await getSteamProfileCache([steamId]);
    const entry = cache.get(steamId);
    if (entry) {
      profileName = entry.displayName || steamId;
      avatarUrl = entry.avatarUrl ?? null;
    }
  } catch {
    // Ignore Steam cache failures.
  }

  let faceitNickname: string | null = null;
  let faceitElo: number | null = null;
  let faceitLevel: number | null = null;
  let faceitUrl: string | null = null;
  try {
    const faceitCache = await getFaceitProfileCache([steamId]);
    const faceitProfile = faceitCache.get(steamId);
    if (faceitProfile) {
      faceitNickname = faceitProfile.nickname ?? null;
      faceitElo = faceitProfile.elo ?? null;
      faceitLevel = faceitProfile.level ?? null;
      faceitUrl = normalizeFaceitUrl(faceitProfile.faceitUrl ?? null);
    }
  } catch (err) {
    faceitError =
      err instanceof Error ? err.message : "Failed to load Faceit data.";
  }

  const stats = totals
    ? {
        matches: totals.matches,
        kills: totals.kills,
        deaths: totals.deaths,
        assists: totals.assists,
        damage: totals.damage,
        rounds: totals.rounds,
        kd: totals.deaths ? totals.kills / totals.deaths : totals.kills,
        adr: totals.rounds ? totals.damage / totals.rounds : 0,
        hs: totals.kills ? (totals.headshotKills / totals.kills) * 100 : 0,
        rating: totals.rating,
      }
    : null;

  const last3Matches = recent.slice(0, 3);
  const last3RatingValues = last3Matches
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
    .filter((value): value is number => value !== null);
  const last3Rating =
    last3RatingValues.length > 0
      ? last3RatingValues.reduce((sum, value) => sum + value, 0) /
        last3RatingValues.length
      : null;

  const recentMatches: PreviewMatch[] = recent.slice(0, 5).map((match) => {
    const rating = getRatingFromTotals(
      {
        kills: match.kills,
        deaths: match.deaths,
        assists: match.assists,
        damage: match.damage,
        clutchWins: match.clutchWins,
      },
      match.rounds
    );
    const baseTeam1Score = match.mapTeam1Score ?? match.team1Score ?? 0;
    const baseTeam2Score = match.mapTeam2Score ?? match.team2Score ?? 0;
    const side = match.teamSide;
    const score =
      side === "team1"
        ? `${baseTeam1Score} : ${baseTeam2Score}`
        : side === "team2"
          ? `${baseTeam2Score} : ${baseTeam1Score}`
          : "-";
    const result = match.win === null ? "-" : match.win ? "W" : "L";
    return {
      matchId: match.matchId,
      mapName: match.mapName || "Unknown",
      result,
      score,
      kills: match.kills,
      deaths: match.deaths,
      assists: match.assists,
      rating,
    };
  });

  const favoriteMap = (() => {
    const mapStats = new Map<string, { matches: number; wins: number }>();
    for (const match of recent) {
      const mapName = match.mapName?.trim();
      if (!mapName) continue;
      const entry = mapStats.get(mapName) ?? { matches: 0, wins: 0 };
      entry.matches += 1;
      if (match.win) entry.wins += 1;
      mapStats.set(mapName, entry);
    }

    let best: { mapName: string; matches: number; wins: number } | null = null;
    for (const [mapName, statsEntry] of mapStats) {
      if (!best || statsEntry.matches > best.matches) {
        best = { mapName, ...statsEntry };
        continue;
      }
      if (
        statsEntry.matches === best.matches &&
        statsEntry.wins / Math.max(1, statsEntry.matches) >
          best.wins / Math.max(1, best.matches)
      ) {
        best = { mapName, ...statsEntry };
      }
    }

    return best;
  })();

  const playstyleTags = (() => {
    if (!stats || !stats.rounds) return [];
    const kpr = stats.kills / stats.rounds;
    const dpr = stats.deaths / stats.rounds;
    const apr = stats.assists / stats.rounds;
    const adr = stats.damage / stats.rounds;
    const tags: string[] = [];
    if (kpr >= 0.8) tags.push("Fragger");
    if (adr >= 90) tags.push("Damage Dealer");
    if (apr >= 0.22) tags.push("Support");
    if (dpr <= 0.65) tags.push("Survivor");
    return tags.slice(0, 3);
  })();

  const winCount = recent.filter((match) => match.win === true).length;
  const lossCount = recent.filter((match) => match.win === false).length;
  const winRatio =
    winCount + lossCount > 0
      ? Math.round((winCount / (winCount + lossCount)) * 100)
      : null;

  return NextResponse.json({
    steamId,
    profileName,
    avatarUrl,
    steamProfileUrl: `https://steamcommunity.com/profiles/${steamId}`,
    faceit: {
      nickname: faceitNickname,
      elo: faceitElo,
      level: faceitLevel,
      faceitUrl,
    },
    stats,
    last3Rating,
    recentMatches,
    favoriteMap,
    playstyleTags,
    form: {
      wins: winCount,
      losses: lossCount,
      winRatio,
    },
    matchError,
    faceitError,
  });
}
