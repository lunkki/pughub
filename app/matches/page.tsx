import Link from "next/link";
import { fetchMatchStats, hasMatchzyConfig } from "@/lib/matchzy";
import type { MatchStats } from "@/lib/matchzy";
import { getCurrentUser } from "@/lib/auth";
import { getSteamProfileCache } from "@/lib/steamProfiles";
import {
  formatDate,
  formatSeriesType,
  getMatchWinner,
  getHsPercent,
  getMapImage,
  getMatchRounds,
  getRating,
  normalizeTeam,
  splitPlayersByTeam,
} from "@/lib/matchStatsFormat";
import { Button } from "@/app/components/ui/Button";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";


export default async function MatchesPage() {
  const user = await getCurrentUser();
  if (!user) {
    const redirectParam = encodeURIComponent("/matches");
    return (
      <div className="p-10 text-slate-50">
        <h1 className="mb-4 text-xl font-bold">
          You must be logged in to view match stats.
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
  let matches: MatchStats[] = [];
  let profileCache = new Map<string, { avatarUrl: string | null }>();

  if (!hasConfig) {
    matchError =
      "MatchZy database configuration missing. Set MATCHZY_DB_URL or MATCHZY_DB_HOST/MATCHZY_DB_USER/MATCHZY_DB_NAME in your environment.";
  } else {
    try {
      matches = await fetchMatchStats(30);
    } catch (err) {
      matchError =
        err instanceof Error ? err.message : "Failed to load match stats.";
    }
  }

  if (!matchError && matches.length > 0) {
    try {
      const cache = await getSteamProfileCache(
        matches.flatMap((match) =>
          match.players.map((player) => player.steamId64)
        )
      );
      profileCache = new Map(
        Array.from(cache.entries(), ([steamId, entry]) => [
          steamId,
          { avatarUrl: entry.avatarUrl },
        ])
      );
    } catch {
      // Ignore profile cache failures and fall back to name-only UI.
    }
  }

  return (
    <div className="w-full space-y-6 p-6 text-slate-50 md:p-8">
      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-[#0e1627] p-6 shadow-2xl shadow-sky-900/30 md:p-8">
        <p className="text-xs uppercase tracking-[0.25em] text-sky-200">
          Matches
        </p>
        <h1 className="mt-1 text-3xl font-semibold">Previous matches</h1>
        <p className="mt-2 text-sm text-slate-300">
          Detailed results synced from MatchZy.
        </p>
      </div>

      {matchError && (
        <div className="rounded-2xl border border-rose-900/60 bg-rose-950/40 p-5 text-sm text-rose-100">
          {matchError}
        </div>
      )}

      {!matchError && matches.length === 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-slate-300">
          No completed matches found yet.
        </div>
      )}

      {!matchError && matches.length > 0 && (
        <div className="space-y-5">
          {matches.map((match) => {
            const team1Name = match.team1Name || "Team 1";
            const team2Name = match.team2Name || "Team 2";
            const resolvedWinner = getMatchWinner(match);
            const winnerLabel = resolvedWinner || "TBD";
            const winnerKey = normalizeTeam(resolvedWinner);
            const isTeam1Winner =
              winnerKey && winnerKey === normalizeTeam(team1Name);
            const isTeam2Winner =
              winnerKey && winnerKey === normalizeTeam(team2Name);
            const primaryMap = match.maps[0] ?? null;
            const mapName = primaryMap?.mapName || "Unknown map";
            const mapImage = primaryMap?.mapName ? getMapImage(mapName) : null;
            const rounds = getMatchRounds(match);
            const scoreDisplay = primaryMap
              ? `${primaryMap.team1Score} : ${primaryMap.team2Score}`
              : `${match.team1Score} : ${match.team2Score}`;
            const seriesDisplay = match.maps.length > 1
              ? `${match.team1Score} : ${match.team2Score}`
              : null;
            const { team1Players, team2Players } = splitPlayersByTeam(match);
            const team1Top = team1Players.slice(0, 5);
            const team2Top = team2Players.slice(0, 5);

            return (
              <article
                key={match.matchId}
                className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60 shadow-md shadow-sky-900/10"
              >
                <div className="grid gap-4 md:grid-cols-[240px,1fr]">
                  <div className="relative min-h-[220px] overflow-hidden border-b border-slate-800 md:min-h-full md:border-b-0 md:border-r">
                    <div
                      className="absolute inset-0 bg-slate-900 bg-cover bg-center"
                      style={mapImage ? { backgroundImage: `url(${mapImage})` } : undefined}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/70 to-slate-950/30" />
                    <div className="relative z-10 flex h-full flex-col justify-end p-5">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Map</p>
                      <h3 className="mt-2 text-2xl font-semibold text-slate-100">
                        {mapName}
                      </h3>
                      <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-400">
                        Match #{match.matchId}
                      </p>
                      <p className="mt-1 text-sm text-slate-200">
                        Started {formatDate(match.startTime)}
                      </p>
                      <p className="mt-2 text-xs text-slate-300">
                        {formatSeriesType(match.seriesType)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Scoreboard</p>
                        <h2 className="mt-1 text-2xl font-semibold">
                          {team1Name} vs {team2Name}
                        </h2>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                          Winner: {winnerLabel}
                        </p>
                      </div>
                      <div className="text-left md:text-right">
                        <div className="text-3xl font-semibold text-slate-100">{scoreDisplay}</div>
                        {seriesDisplay && (
                          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                            Series: {seriesDisplay}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-slate-400">
                          Rounds: {rounds || "-"}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      {[
                        { label: "Team 1", name: team1Name, score: primaryMap?.team1Score ?? match.team1Score, players: team1Top, total: team1Players.length, highlight: isTeam1Winner },
                        { label: "Team 2", name: team2Name, score: primaryMap?.team2Score ?? match.team2Score, players: team2Top, total: team2Players.length, highlight: isTeam2Winner },
                      ].map((team) => (
                        <div
                          key={`${match.matchId}-${team.label}`}
                          className={`rounded-2xl border ${
                            team.highlight
                              ? "border-emerald-500/60 bg-emerald-950/20"
                              : "border-slate-800 bg-slate-950/40"
                          }`}
                        >
                          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{team.label}</p>
                              <h3 className="mt-1 text-sm font-semibold text-slate-100">{team.name}</h3>
                            </div>
                            <div className="text-lg font-semibold text-slate-100">{team.score}</div>
                          </div>
                          {team.players.length === 0 ? (
                            <div className="p-4 text-xs text-slate-400">No players recorded.</div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-950/60 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                                  <tr>
                                    <th className="px-4 py-2">Player</th>
                                    <th className="px-2 py-2">K</th>
                                    <th className="px-2 py-2">A</th>
                                    <th className="px-2 py-2">D</th>
                                    <th className="px-2 py-2">HS%</th>
                                    <th className="px-2 py-2 text-right">Rating</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                  {team.players.map((player) => {
                                    const hs = getHsPercent(player);
                                    const rating = getRating(player, rounds);
                                    const ratingLabel = rating ? rating.toFixed(2) : "-";
                                    const avatarUrl =
                                      profileCache.get(player.steamId64)?.avatarUrl ?? null;
                                    const displayName = player.name || player.steamId64;
                                    const initial =
                                      displayName.trim().charAt(0).toUpperCase() || "?";

                                    return (
                                      <tr key={`${match.matchId}-${team.label}-${player.steamId64}`}>
                                        <td className="px-4 py-2 font-medium text-slate-100">
                                          <div className="flex items-center gap-2">
                                            {avatarUrl ? (
                                              <img
                                                src={avatarUrl}
                                                alt={`${displayName} avatar`}
                                                className="h-6 w-6 rounded-full border border-slate-700 object-cover"
                                              />
                                            ) : (
                                              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-[10px] font-semibold text-slate-300">
                                                {initial}
                                              </div>
                                            )}
                                            <span className="font-medium text-slate-100">
                                              {displayName}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="px-2 py-2 text-slate-200">{player.kills}</td>
                                        <td className="px-2 py-2 text-slate-200">{player.assists}</td>
                                        <td className="px-2 py-2 text-slate-200">{player.deaths}</td>
                                        <td className="px-2 py-2 text-slate-200">
                                          {hs === null ? "-" : `${hs.toFixed(0)}%`}
                                        </td>
                                        <td className="px-2 py-2 text-right text-slate-200">
                                          {ratingLabel}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                          {team.total > team.players.length && (
                            <div className="px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                              +{team.total - team.players.length} more players
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <Button asChild variant="outline">
                        <Link href={`/matches/${match.matchId}`}>View match details</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
