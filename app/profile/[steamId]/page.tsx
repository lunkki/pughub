import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getSteamProfileCache } from "@/lib/steamProfiles";
import {
  type PlayerMatchSummary,
  type PlayerTotals,
  fetchPlayerTotals,
  fetchRecentPlayerMatchSummaries,
  hasMatchzyConfig,
} from "@/lib/matchzy";
import { getRatingFromTotals } from "@/lib/matchStatsFormat";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ steamId: string }>;
}) {
  const { steamId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    const redirectParam = encodeURIComponent(`/profile/${steamId}`);
    return (
      <div className="p-10 text-slate-50">
        <h1 className="mb-4 text-xl font-bold">
          You must be logged in to view profiles.
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
  let matchError: string | null = null;
  let totals: PlayerTotals | null = null;
  let recent: PlayerMatchSummary[] = [];

  if (!hasConfig) {
    matchError =
      "MatchZy database configuration missing. Set MATCHZY_DB_URL or MATCHZY_DB_HOST/MATCHZY_DB_USER/MATCHZY_DB_NAME in your environment.";
  } else {
    try {
      totals = await fetchPlayerTotals(steamId);
      recent = await fetchRecentPlayerMatchSummaries(steamId, 20);
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
    // Ignore cache failures.
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

  return (
    <div className="w-full space-y-6 p-6 text-slate-50 md:p-8">
      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-[#0e1627] p-6 shadow-2xl shadow-sky-900/30 md:p-8">
        <div className="flex flex-wrap items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={`${profileName} avatar`}
              className="h-16 w-16 rounded-full border border-slate-700 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-lg font-semibold text-slate-300">
              {profileName.trim().charAt(0).toUpperCase() || "?"}
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-sky-200">
              Player profile
            </p>
            <h1 className="mt-1 text-3xl font-semibold">{profileName}</h1>
            <p className="mt-2 text-sm text-slate-300">SteamID: {steamId}</p>
          </div>
        </div>
      </div>

      {matchError && (
        <div className="rounded-2xl border border-rose-900/60 bg-rose-950/40 p-5 text-sm text-rose-100">
          {matchError}
        </div>
      )}

      {!matchError && stats && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Matches", value: formatNumber(stats.matches) },
            { label: "K / D / A", value: `${stats.kills} / ${stats.deaths} / ${stats.assists}` },
            { label: "K/D", value: stats.kd.toFixed(2) },
            { label: "ADR", value: stats.adr.toFixed(1) },
            { label: "HS%", value: `${stats.hs.toFixed(0)}%` },
            { label: "Rating", value: stats.rating ? stats.rating.toFixed(2) : "-" },
            { label: "Rounds", value: formatNumber(stats.rounds) },
            { label: "Damage", value: formatNumber(stats.damage) },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-md shadow-sky-900/10"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                {item.label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-100">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {!matchError && (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 shadow-md shadow-sky-900/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Match history
              </p>
              <h2 className="mt-1 text-xl font-semibold">Recent matches</h2>
              <p className="mt-1 text-xs text-slate-400">Last 20 matches</p>
            </div>
            <Link href="/matches" className="text-sm text-sky-300 underline">
              View all matches
            </Link>
          </div>

          {recent.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">
              No matches recorded yet.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/60 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Match</th>
                    <th className="px-3 py-2">K / D / A</th>
                    <th className="px-3 py-2">ADR</th>
                    <th className="px-3 py-2">Rounds</th>
                    <th className="px-3 py-2 text-right">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {recent.map((match) => {
                    const adr = match.rounds
                      ? match.damage / match.rounds
                      : 0;
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

                    return (
                      <tr key={`${match.matchId}-${match.steamId64}`}>
                        <td className="px-3 py-2">
                          <Link
                            href={`/matches/${match.matchId}`}
                            className="text-sky-200 hover:underline"
                          >
                            #{match.matchId}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-slate-200">
                          {match.kills} / {match.deaths} / {match.assists}
                        </td>
                        <td className="px-3 py-2 text-slate-200">
                          {adr.toFixed(1)}
                        </td>
                        <td className="px-3 py-2 text-slate-200">
                          {match.rounds}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-200">
                          {rating ? rating.toFixed(2) : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
