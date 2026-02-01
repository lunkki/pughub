import Link from "next/link";
import { fetchPlayerLeaderboard, hasMatchzyConfig } from "@/lib/matchzy";
import type { PlayerLeaderboardEntry } from "@/lib/matchzy";
import { getCurrentUser } from "@/lib/auth";
import { getSteamProfileCache } from "@/lib/steamProfiles";
import { getFaceitProfileCache } from "@/lib/faceitProfiles";
import { LeaderboardTable, type LeaderboardRow } from "./LeaderboardTable";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export default async function LeaderboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    const redirectParam = encodeURIComponent("/leaderboard");
    return (
      <div className="p-10 text-slate-50">
        <h1 className="mb-4 text-xl font-bold">
          You must be logged in to view the leaderboard.
        </h1>
        <Link
          href={`/api/auth/steam?redirect=${redirectParam}`}
          className="text-sky-400 underline"
        >
          Sign in with Steam
        </Link>
      </div>
    );
  }

  const hasConfig = hasMatchzyConfig();
  let error: string | null = null;
  let leaderboard: PlayerLeaderboardEntry[] = [];
  let rows: LeaderboardRow[] = [];
  let profileCache = new Map<
    string,
    { displayName: string; avatarUrl: string | null }
  >();
  let faceitCache = new Map<string, { level: number | null }>();

  if (!hasConfig) {
    error =
      "MatchZy database configuration missing. Set MATCHZY_DB_URL or MATCHZY_DB_HOST/MATCHZY_DB_USER/MATCHZY_DB_NAME in your environment.";
  } else {
    try {
      leaderboard = await fetchPlayerLeaderboard(50);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load leaderboard.";
    }
  }

  if (!error && leaderboard.length > 0) {
    try {
      const cache = await getSteamProfileCache(
        leaderboard.map((player) => player.steamId64)
      );
      profileCache = new Map(
        Array.from(cache.entries(), ([steamId, entry]) => [
          steamId,
          { displayName: entry.displayName, avatarUrl: entry.avatarUrl },
        ])
      );
    } catch {
      // Ignore profile cache failures and fall back to MatchZy names.
    }

    try {
      const cache = await getFaceitProfileCache(
        leaderboard.map((player) => player.steamId64)
      );
      faceitCache = new Map(
        Array.from(cache.entries(), ([steamId, entry]) => [
          steamId,
          { level: entry.level ?? null },
        ])
      );
    } catch {
      // Ignore faceit cache failures and fall back to no badge.
    }

    rows = leaderboard.map((player) => {
      const profile = profileCache.get(player.steamId64);
      const displayName =
        profile?.displayName?.trim() ||
        player.name?.trim() ||
        "Unknown player";
      const faceit = faceitCache.get(player.steamId64);
      return {
        steamId64: player.steamId64,
        displayName,
        avatarUrl: profile?.avatarUrl ?? null,
        faceitLevel: faceit?.level ?? null,
        matches: player.matches,
        wins: player.wins,
        losses: player.losses,
        kills: player.kills,
        deaths: player.deaths,
        assists: player.assists,
        headshotKills: player.headshotKills,
        rating: player.rating,
      };
    });
  }

  return (
    <div className="w-full space-y-6 p-6 text-slate-50 md:p-8">
      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-[#0e1627] p-6 shadow-2xl shadow-sky-900/30 md:p-8">
        <p className="text-xs uppercase tracking-[0.25em] text-sky-200">
          Leaderboard
        </p>
        <h1 className="mt-1 text-3xl font-semibold">Top players</h1>
        <p className="mt-2 text-sm text-slate-300">
          Steam names and avatars are cached for 24 hours.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-900/60 bg-rose-950/40 p-5 text-sm text-rose-100">
          {error}
        </div>
      )}

      {!error && leaderboard.length === 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-slate-300">
          No player stats recorded yet.
        </div>
      )}

      {!error && leaderboard.length > 0 && (
        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60 shadow-md shadow-sky-900/10">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-6 py-5">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                All time
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Win% uses decided matches only.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Click column headers to sort.
              </p>
            </div>
          </div>
          <LeaderboardTable rows={rows} />
        </section>
      )}
    </div>
  );
}
