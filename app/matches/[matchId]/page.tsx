import Link from "next/link";
import {
  fetchMatchStatsById,
  hasMatchzyConfig,
  type MatchStats,
} from "@/lib/matchzy";
import { getCurrentUser } from "@/lib/auth";
import { getSteamProfileCache } from "@/lib/steamProfiles";
import {
  formatDate,
  formatSeriesType,
  getAdr,
  getHsPercent,
  getKastEstimate,
  getMatchWinner,
  getMapImage,
  getMatchRounds,
  getRating,
  getTopPlayer,
  getTotals,
  normalizeTeam,
  splitPlayersByTeam,
} from "@/lib/matchStatsFormat";
import { Button } from "@/app/components/ui/Button";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function formatPercent(
  numerator: number,
  denominator: number,
  decimals = 0
) {
  if (!denominator) return "-";
  return `${((numerator / denominator) * 100).toFixed(decimals)}%`;
}

function formatRatio(numerator: number, denominator: number) {
  if (!denominator) return "-";
  return `${numerator}/${denominator}`;
}

function formatPercentValue(value: number | null, decimals = 1) {
  if (value === null) return "-";
  return `${value.toFixed(decimals)}%`;
}

function formatDecimal(value: number | null, decimals = 2) {
  if (value === null) return "-";
  return value.toFixed(decimals);
}

function ratingBadgeClass(value: number | null) {
  if (value === null) return "bg-slate-700/60 text-slate-200";
  if (value >= 1.2) return "bg-emerald-500/20 text-emerald-200";
  if (value >= 1.1) return "bg-sky-500/20 text-sky-200";
  if (value >= 1.0) return "bg-amber-500/20 text-amber-200";
  return "bg-rose-500/20 text-rose-200";
}

export default async function MatchStatsDetailPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    const redirectParam = encodeURIComponent(`/matches/${matchId}`);
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

  const matchIdNumber = Number(matchId);
  if (!Number.isFinite(matchIdNumber)) {
    return (
      <div className="p-10 text-slate-50">
        Invalid match id.{" "}
        <Link href="/matches" className="text-sky-400 underline">
          Back to matches
        </Link>
      </div>
    );
  }

  let error: string | null = null;
  let match: MatchStats | null = null;
  let profileCache = new Map<string, { avatarUrl: string | null }>();

  if (!hasMatchzyConfig()) {
    error =
      "MatchZy database configuration missing. Set MATCHZY_DB_URL or MATCHZY_DB_HOST/MATCHZY_DB_USER/MATCHZY_DB_NAME in your environment.";
  } else {
    try {
      match = await fetchMatchStatsById(matchIdNumber);
      if (!match) {
        error = "Match not found.";
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load match stats.";
    }
  }

  if (!error && match) {
    try {
      const cache = await getSteamProfileCache(
        match.players.map((player) => player.steamId64)
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm uppercase tracking-[0.25em] text-slate-400">
          Match details
        </div>
        <Button asChild variant="outline">
          <Link href="/matches">Back to all matches</Link>
        </Button>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-900/60 bg-rose-950/40 p-5 text-sm text-rose-100">
          {error}
        </div>
      )}

      {!error && match && (() => {
        const team1Name = match.team1Name || "Team 1";
        const team2Name = match.team2Name || "Team 2";
        const resolvedWinner = getMatchWinner(match);
        const winnerLabel = resolvedWinner || "TBD";
        const primaryMap = match.maps[0] ?? null;
        const mapName = primaryMap?.mapName || "Unknown map";
        const mapImage = primaryMap?.mapName ? getMapImage(mapName) : null;
        const rounds = getMatchRounds(match);
        const winnerKey = normalizeTeam(resolvedWinner);
        const isTeam1Winner =
          winnerKey && winnerKey === normalizeTeam(team1Name);
        const isTeam2Winner =
          winnerKey && winnerKey === normalizeTeam(team2Name);
        const { team1Players, team2Players, otherPlayers } =
          splitPlayersByTeam(match);
        const team1Totals = getTotals(team1Players);
        const team2Totals = getTotals(team2Players);
        const topFragger = getTopPlayer(match.players, "kills");
        const topDamage = getTopPlayer(match.players, "damage");
        const detailTeams = [
          { label: "Team 1", name: team1Name, players: team1Players },
          { label: "Team 2", name: team2Name, players: team2Players },
        ];
        const getPlayerAvatar = (player: MatchStats["players"][number]) => {
          const avatarUrl =
            profileCache.get(player.steamId64)?.avatarUrl ?? null;
          const displayName = player.name || player.steamId64;
          const initial = displayName.trim().charAt(0).toUpperCase() || "?";
          return { avatarUrl, displayName, initial };
        };

        return (
          <>
            <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-2xl shadow-sky-900/30 md:p-8">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={mapImage ? { backgroundImage: `url(${mapImage})` } : undefined}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-slate-900/20" />
              <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-sky-200">
                    Match #{match.matchId}
                  </p>
                  <h1 className="mt-1 text-3xl font-semibold">
                    {team1Name} vs {team2Name}
                  </h1>
                  <p className="mt-2 text-sm text-slate-200">
                    Started {formatDate(match.startTime)} |{" "}
                    {formatSeriesType(match.seriesType)}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-300">
                    Map: {mapName}
                  </p>
                </div>

                <div className="text-left md:text-right">
                  <div className="text-4xl font-semibold">
                    {primaryMap?.team1Score ?? match.team1Score} :{" "}
                    {primaryMap?.team2Score ?? match.team2Score}
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-200">
                    Winner: {winnerLabel}
                  </p>
                  {match.maps.length > 1 && (
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                      Series: {match.team1Score} : {match.team2Score}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Start time
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-100">
                  {formatDate(match.startTime)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Series
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-100">
                  {formatSeriesType(match.seriesType)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Maps: {match.maps.length || 0}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Rounds: {rounds || "-"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Top fragger
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-100">
                  {topFragger ? topFragger.name || topFragger.steamId64 : "No stats"}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {topFragger ? `${topFragger.kills} kills` : "-"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Top damage
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-100">
                  {topDamage ? topDamage.name || topDamage.steamId64 : "No stats"}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {topDamage ? `${topDamage.damage} dmg` : "-"}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-sm font-semibold text-slate-200">
                Map breakdown
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {match.maps.length === 0 && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-400">
                    No map stats recorded.
                  </div>
                )}

                {match.maps.map((map) => (
                  <div
                    key={`${match.matchId}-${map.mapNumber}`}
                    className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Map {map.mapNumber + 1}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold">
                      {map.mapName || "Unknown map"}
                    </h3>
                    <p className="mt-1 text-sm text-slate-300">
                      {map.team1Score} : {map.team2Score}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      Winner: {map.winner || "TBD"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="grid items-center gap-4 md:grid-cols-[1fr,auto,1fr]">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Team 1
                  </p>
                  <h3 className="mt-1 text-xl font-semibold">{team1Name}</h3>
                  {isTeam1Winner && (
                    <span className="mt-2 inline-flex rounded-full border border-emerald-500/60 bg-emerald-900/30 px-3 py-1 text-xs uppercase tracking-[0.2em] text-emerald-200">
                      Winner
                    </span>
                  )}
                </div>
                <div className="text-center text-4xl font-semibold text-slate-100">
                  {primaryMap?.team1Score ?? match.team1Score} :{" "}
                  {primaryMap?.team2Score ?? match.team2Score}
                </div>
                <div className="text-left md:text-right">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Team 2
                  </p>
                  <h3 className="mt-1 text-xl font-semibold">{team2Name}</h3>
                  {isTeam2Winner && (
                    <span className="mt-2 inline-flex rounded-full border border-emerald-500/60 bg-emerald-900/30 px-3 py-1 text-xs uppercase tracking-[0.2em] text-emerald-200">
                      Winner
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-3 text-sm font-semibold text-slate-200">
                Team stats
              </div>
              {match.players.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-400">
                  No player stats recorded.
                </div>
              ) : (
                <div className="grid gap-4">
                  {[
                    {
                      label: "Team 1",
                      name: team1Name,
                      score: primaryMap?.team1Score ?? match.team1Score,
                      players: team1Players,
                      totals: team1Totals,
                      highlight: isTeam1Winner,
                    },
                    {
                      label: "Team 2",
                      name: team2Name,
                      score: primaryMap?.team2Score ?? match.team2Score,
                      players: team2Players,
                      totals: team2Totals,
                      highlight: isTeam2Winner,
                    },
                  ].map((team) => (
                    <div
                      key={`${match.matchId}-${team.label}`}
                      className={`rounded-2xl border ${
                        team.highlight
                          ? "border-emerald-500/60 bg-emerald-950/20"
                          : "border-slate-800 bg-slate-950/40"
                      } p-4`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                            {team.label}
                          </p>
                          <h3 className="mt-1 text-lg font-semibold">
                            {team.name}
                          </h3>
                        </div>
                        <div className="text-right text-sm text-slate-300">
                          <div className="text-2xl font-semibold text-slate-100">
                            {team.score}
                          </div>
                          <div>
                            {team.totals.kills}/{team.totals.deaths}/
                            {team.totals.assists} K/D/A
                          </div>
                        </div>
                      </div>

                      {team.players.length === 0 ? (
                        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-400">
                          No players recorded.
                        </div>
                      ) : (
                          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
                            <table className="min-w-full text-left text-sm">
                              <thead className="bg-slate-950/60 text-xs uppercase tracking-[0.2em] text-slate-400">
                                <tr>
                                  <th className="px-4 py-3">Player</th>
                                  <th className="px-3 py-3">K</th>
                                  <th className="px-3 py-3">D</th>
                                  <th className="px-3 py-3">A</th>
                                  <th className="px-3 py-3">+/-</th>
                                  <th className="px-3 py-3">K/D</th>
                                  <th className="px-3 py-3">ADR</th>
                                  <th className="px-3 py-3">HS%</th>
                                  <th className="px-3 py-3">KAST*</th>
                                  <th className="px-3 py-3 text-right">Rating</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800">
                                {team.players.map((player) => {
                                  const kd =
                                    player.deaths === 0
                                      ? player.kills
                                      : player.kills / player.deaths;
                                  const diff = player.kills - player.deaths;
                                  const adr = getAdr(player, rounds);
                                  const hs = getHsPercent(player);
                                  const kast = getKastEstimate(player, rounds);
                                  const rating = getRating(player, rounds);

                                  return (
                                    <tr
                                      key={`${match.matchId}-${team.label}-${player.steamId64}`}
                                    >
                                      <td className="px-4 py-3 font-medium text-slate-100">
                                        {(() => {
                                          const { avatarUrl, displayName, initial } =
                                            getPlayerAvatar(player);
                                          return (
                                            <div className="flex items-center gap-2">
                                              {avatarUrl ? (
                                                <img
                                                  src={avatarUrl}
                                                  alt={`${displayName} avatar`}
                                                  className="h-7 w-7 rounded-full border border-slate-700 object-cover"
                                                />
                                              ) : (
                                                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-[11px] font-semibold text-slate-300">
                                                  {initial}
                                                </div>
                                              )}
                                              <span className="font-medium text-slate-100">
                                                {displayName}
                                              </span>
                                            </div>
                                          );
                                        })()}
                                      </td>
                                      <td className="px-3 py-3 text-slate-200">
                                        {player.kills}
                                      </td>
                                      <td className="px-3 py-3 text-slate-200">
                                        {player.deaths}
                                      </td>
                                      <td className="px-3 py-3 text-slate-200">
                                        {player.assists}
                                      </td>
                                      <td className="px-3 py-3 text-slate-200">
                                        {diff > 0 ? `+${diff}` : diff}
                                      </td>
                                      <td className="px-3 py-3 text-slate-200">
                                        {formatDecimal(kd, 2)}
                                      </td>
                                      <td className="px-3 py-3 text-slate-200">
                                        {formatDecimal(adr, 1)}
                                      </td>
                                      <td className="px-3 py-3 text-slate-200">
                                        {formatPercentValue(hs, 0)}
                                      </td>
                                      <td className="px-3 py-3 text-slate-200">
                                        {formatPercentValue(kast, 1)}
                                      </td>
                                      <td className="px-3 py-3 text-right">
                                        <span
                                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${ratingBadgeClass(
                                            rating
                                          )}`}
                                        >
                                          {formatDecimal(rating, 2)}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="mt-4 text-xs text-slate-400">
              KAST* is estimated from kills, assists, and clutch wins because trade/survival data is not tracked.
            </p>

            <div className="space-y-4">
              <details className="rounded-2xl border border-slate-800 bg-slate-950/40">
                <summary className="cursor-pointer px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-300">
                  Utility
                </summary>
                <div className="border-t border-slate-800 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {detailTeams.map((team) => (
                      <div
                        key={`utility-${team.label}`}
                        className="rounded-xl border border-slate-800 bg-slate-950/40"
                      >
                        <div className="border-b border-slate-800 px-4 py-2">
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{team.label}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-100">{team.name}</p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-left text-xs">
                            <thead className="bg-slate-950/60 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                              <tr>
                                <th className="px-4 py-2">Player</th>
                                <th className="px-2 py-2">Util</th>
                                <th className="px-2 py-2">Util dmg</th>
                                <th className="px-2 py-2">Util hits</th>
                                <th className="px-2 py-2">Util%</th>
                                <th className="px-2 py-2">Flash</th>
                                <th className="px-2 py-2">Flash%</th>
                                <th className="px-2 py-2">Flashed</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                              {team.players.map((player) => {
                                const utilRate = formatPercent(
                                  player.utilitySuccesses,
                                  player.utilityCount
                                );
                                const flashRate = formatPercent(
                                  player.flashSuccesses,
                                  player.flashCount
                                );

                                return (
                                  <tr key={`utility-${team.label}-${player.steamId64}`}>
                                    <td className="px-4 py-2 font-medium text-slate-100">
                                      {(() => {
                                        const { avatarUrl, displayName, initial } =
                                          getPlayerAvatar(player);
                                        return (
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
                                        );
                                      })()}
                                    </td>
                                    <td className="px-2 py-2 text-slate-200">{player.utilityCount}</td>
                                    <td className="px-2 py-2 text-slate-200">{player.utilityDamage}</td>
                                    <td className="px-2 py-2 text-slate-200">{player.utilityEnemies}</td>
                                    <td className="px-2 py-2 text-slate-200">{utilRate}</td>
                                    <td className="px-2 py-2 text-slate-200">{player.flashCount}</td>
                                    <td className="px-2 py-2 text-slate-200">{flashRate}</td>
                                    <td className="px-2 py-2 text-slate-200">{player.enemiesFlashed}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </details>

              <details className="rounded-2xl border border-slate-800 bg-slate-950/40">
                <summary className="cursor-pointer px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-300">
                  First kill (Entry)
                </summary>
                <div className="border-t border-slate-800 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {detailTeams.map((team) => (
                      <div
                        key={`entry-${team.label}`}
                        className="rounded-xl border border-slate-800 bg-slate-950/40"
                      >
                        <div className="border-b border-slate-800 px-4 py-2">
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{team.label}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-100">{team.name}</p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-left text-xs">
                            <thead className="bg-slate-950/60 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                              <tr>
                                <th className="px-4 py-2">Player</th>
                                <th className="px-2 py-2">Entry</th>
                                <th className="px-2 py-2">Entry%</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                              {team.players.map((player) => {
                                const entryLabel = player.entryCount
                                  ? `${player.entryWins}/${player.entryCount}`
                                  : "-";
                                const entryRate = formatPercent(
                                  player.entryWins,
                                  player.entryCount
                                );

                                return (
                                  <tr key={`entry-${team.label}-${player.steamId64}`}>
                                    <td className="px-4 py-2 font-medium text-slate-100">
                                      {(() => {
                                        const { avatarUrl, displayName, initial } =
                                          getPlayerAvatar(player);
                                        return (
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
                                        );
                                      })()}
                                    </td>
                                    <td className="px-2 py-2 text-slate-200">{entryLabel}</td>
                                    <td className="px-2 py-2 text-slate-200">{entryRate}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </details>

              <details className="rounded-2xl border border-slate-800 bg-slate-950/40">
                <summary className="cursor-pointer px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-300">
                  Trades
                </summary>
                <div className="border-t border-slate-800 p-4 text-sm text-slate-300">
                  Trade data is not available in MatchZy stats yet.
                </div>
              </details>

              <details className="rounded-2xl border border-slate-800 bg-slate-950/40">
                <summary className="cursor-pointer px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-300">
                  1vX
                </summary>
                <div className="border-t border-slate-800 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {detailTeams.map((team) => (
                      <div
                        key={`clutch-${team.label}`}
                        className="rounded-xl border border-slate-800 bg-slate-950/40"
                      >
                        <div className="border-b border-slate-800 px-4 py-2">
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{team.label}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-100">{team.name}</p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-left text-xs">
                            <thead className="bg-slate-950/60 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                              <tr>
                                <th className="px-4 py-2">Player</th>
                                <th className="px-2 py-2">1v1</th>
                                <th className="px-2 py-2">1v2</th>
                                <th className="px-2 py-2">Clutch</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                              {team.players.map((player) => {
                                const v1Label = formatRatio(player.v1Wins, player.v1Count);
                                const v2Label = formatRatio(player.v2Wins, player.v2Count);
                                const clutchLabel = formatRatio(
                                  player.clutchWins,
                                  player.clutchCount
                                );

                                return (
                                  <tr key={`clutch-${team.label}-${player.steamId64}`}>
                                    <td className="px-4 py-2 font-medium text-slate-100">
                                      {(() => {
                                        const { avatarUrl, displayName, initial } =
                                          getPlayerAvatar(player);
                                        return (
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
                                        );
                                      })()}
                                    </td>
                                    <td className="px-2 py-2 text-slate-200">{v1Label}</td>
                                    <td className="px-2 py-2 text-slate-200">{v2Label}</td>
                                    <td className="px-2 py-2 text-slate-200">{clutchLabel}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </details>

              <details className="rounded-2xl border border-slate-800 bg-slate-950/40">
                <summary className="cursor-pointer px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-300">
                  Multikills
                </summary>
                <div className="border-t border-slate-800 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {detailTeams.map((team) => (
                      <div
                        key={`multi-${team.label}`}
                        className="rounded-xl border border-slate-800 bg-slate-950/40"
                      >
                        <div className="border-b border-slate-800 px-4 py-2">
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{team.label}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-100">{team.name}</p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-left text-xs">
                            <thead className="bg-slate-950/60 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                              <tr>
                                <th className="px-4 py-2">Player</th>
                                <th className="px-2 py-2">2k</th>
                                <th className="px-2 py-2">3k</th>
                                <th className="px-2 py-2">4k</th>
                                <th className="px-2 py-2">5k</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                              {team.players.map((player) => (
                                <tr key={`multi-${team.label}-${player.steamId64}`}>
                                  <td className="px-4 py-2 font-medium text-slate-100">
                                    {(() => {
                                      const { avatarUrl, displayName, initial } =
                                        getPlayerAvatar(player);
                                      return (
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
                                      );
                                    })()}
                                  </td>
                                  <td className="px-2 py-2 text-slate-200">{player.enemy2ks}</td>
                                  <td className="px-2 py-2 text-slate-200">{player.enemy3ks}</td>
                                  <td className="px-2 py-2 text-slate-200">{player.enemy4ks}</td>
                                  <td className="px-2 py-2 text-slate-200">{player.enemy5ks}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            </div>
            {otherPlayers.length > 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Unassigned players
                </div>
                <div className="mt-3 overflow-x-auto rounded-xl border border-slate-800">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-950/60 text-xs uppercase tracking-[0.2em] text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Player</th>
                        <th className="px-4 py-3">Team</th>
                        <th className="px-4 py-3">K / D / A</th>
                        <th className="px-4 py-3">K/D</th>
                        <th className="px-4 py-3">Damage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {otherPlayers.map((player) => {
                        const kd =
                          player.deaths === 0
                            ? player.kills
                            : player.kills / player.deaths;
                        return (
                          <tr key={`${match.matchId}-other-${player.steamId64}`}>
                            <td className="px-4 py-3 font-medium text-slate-100">
                              {(() => {
                                const { avatarUrl, displayName, initial } =
                                  getPlayerAvatar(player);
                                return (
                                  <div className="flex items-center gap-2">
                                    {avatarUrl ? (
                                      <img
                                        src={avatarUrl}
                                        alt={`${displayName} avatar`}
                                        className="h-7 w-7 rounded-full border border-slate-700 object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-[11px] font-semibold text-slate-300">
                                        {initial}
                                      </div>
                                    )}
                                    <span className="font-medium text-slate-100">
                                      {displayName}
                                    </span>
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-4 py-3 text-slate-300">
                              {player.team || "N/A"}
                            </td>
                            <td className="px-4 py-3 text-slate-200">
                              {player.kills} / {player.deaths} / {player.assists}
                            </td>
                            <td className="px-4 py-3 text-slate-200">
                              {kd.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-slate-200">
                              {player.damage}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
