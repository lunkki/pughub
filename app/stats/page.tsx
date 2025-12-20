import Link from "next/link";
import { fetchMatchStats, hasMatchzyConfig, MatchStats } from "@/lib/matchzy";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value: Date | null) {
  if (!value) return "TBD";
  return dateFormatter.format(value);
}

function formatDuration(start: Date | null, end: Date | null) {
  if (!start || !end) return "In progress";
  const totalMinutes = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / 60000)
  );
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatSeriesType(seriesType: string) {
  if (!seriesType.trim()) return "Series";
  return seriesType.toUpperCase();
}

function normalizeTeam(value: string) {
  return value.trim().toLowerCase();
}

function getTotals(players: MatchStats["players"]) {
  return players.reduce(
    (acc, player) => ({
      kills: acc.kills + player.kills,
      deaths: acc.deaths + player.deaths,
      assists: acc.assists + player.assists,
      damage: acc.damage + player.damage,
      headshots: acc.headshots + player.headshotKills,
      utilityDamage: acc.utilityDamage + player.utilityDamage,
      entryWins: acc.entryWins + player.entryWins,
      entryCount: acc.entryCount + player.entryCount,
      clutchWins: acc.clutchWins + player.clutchWins,
      clutchCount: acc.clutchCount + player.clutchCount,
    }),
    {
      kills: 0,
      deaths: 0,
      assists: 0,
      damage: 0,
      headshots: 0,
      utilityDamage: 0,
      entryWins: 0,
      entryCount: 0,
      clutchWins: 0,
      clutchCount: 0,
    }
  );
}

function splitPlayersByTeam(match: MatchStats) {
  const uniqueTeams = Array.from(
    new Set(
      match.players
        .map((player) => normalizeTeam(player.team))
        .filter(Boolean)
    )
  );

  let team1Key = normalizeTeam(match.team1Name);
  let team2Key = normalizeTeam(match.team2Name);

  if (!team1Key && uniqueTeams.length > 0) {
    team1Key = uniqueTeams[0];
  }
  if (!team2Key && uniqueTeams.length > 1) {
    team2Key = uniqueTeams[1];
  }

  const team1Aliases = new Set<string>(["team1", "t1"]);
  const team2Aliases = new Set<string>(["team2", "t2"]);

  if (team1Key) team1Aliases.add(team1Key);
  if (team2Key) team2Aliases.add(team2Key);

  const team1Players: MatchStats["players"] = [];
  const team2Players: MatchStats["players"] = [];
  let otherPlayers: MatchStats["players"] = [];

  for (const player of match.players) {
    const key = normalizeTeam(player.team);
    if (key && team1Aliases.has(key)) {
      team1Players.push(player);
    } else if (key && team2Aliases.has(key)) {
      team2Players.push(player);
    } else {
      otherPlayers.push(player);
    }
  }

  if (
    team1Players.length === 0 &&
    team2Players.length === 0 &&
    otherPlayers.length > 0
  ) {
    const sorted = [...otherPlayers].sort((a, b) => b.kills - a.kills);
    const midpoint = Math.ceil(sorted.length / 2);
    team1Players.push(...sorted.slice(0, midpoint));
    team2Players.push(...sorted.slice(midpoint));
    otherPlayers = [];
  }

  team1Players.sort((a, b) => b.kills - a.kills);
  team2Players.sort((a, b) => b.kills - a.kills);

  return { team1Players, team2Players, otherPlayers };
}

export default async function StatsPage() {
  const user = await getCurrentUser();
  if (!user) {
    const redirectParam = encodeURIComponent("/stats");
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

  let error: string | null = null;
  let matches: MatchStats[] = [];

  if (!hasMatchzyConfig()) {
    error =
      "MatchZy database configuration missing. Set MATCHZY_DB_URL or MATCHZY_DB_HOST/MATCHZY_DB_USER/MATCHZY_DB_NAME in your environment.";
  } else {
    try {
      matches = await fetchMatchStats(30);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load match stats.";
    }
  }

  return (
    <div className="w-full space-y-6 p-6 text-slate-50 md:p-8">
      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-[#0e1627] p-6 shadow-2xl shadow-sky-900/30 md:p-8">
        <p className="text-xs uppercase tracking-[0.25em] text-sky-200">
          Match stats
        </p>
        <h1 className="mt-1 text-3xl font-semibold">Previous matches</h1>
        <p className="mt-2 text-sm text-slate-300">
          Detailed results synced from MatchZy.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-900/60 bg-rose-950/40 p-5 text-sm text-rose-100">
          {error}
        </div>
      )}

      {!error && matches.length === 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-slate-300">
          No completed matches found yet.
        </div>
      )}

      {!error && matches.length > 0 && (
        <div className="space-y-5">
          {matches.map((match) => {
            const team1Name = match.team1Name || "Team 1";
            const team2Name = match.team2Name || "Team 2";
            const winnerLabel = match.winner || "TBD";
            const winnerKey = normalizeTeam(match.winner);
            const isTeam1Winner =
              winnerKey && winnerKey === normalizeTeam(team1Name);
            const isTeam2Winner =
              winnerKey && winnerKey === normalizeTeam(team2Name);
            const { team1Players, team2Players, otherPlayers } =
              splitPlayersByTeam(match);
            const team1Totals = getTotals(team1Players);
            const team2Totals = getTotals(team2Players);

            return (
              <article
                key={match.matchId}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-md shadow-sky-900/10"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Match #{match.matchId}
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold">
                      {team1Name} vs {team2Name}
                    </h2>
                    <p className="mt-2 text-sm text-slate-300">
                      {formatDate(match.startTime)} to {formatDate(match.endTime)} |{" "}
                      {formatSeriesType(match.seriesType)} |{" "}
                      {formatDuration(match.startTime, match.endTime)}
                    </p>
                  </div>

                  <div className="text-left md:text-right">
                    <div className="text-3xl font-semibold">
                      {match.team1Score} : {match.team2Score}
                    </div>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                      Winner: {winnerLabel}
                    </p>
                    {match.serverIp && (
                      <p className="mt-2 text-xs text-slate-400">
                        Server: {match.serverIp}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
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

                <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
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
                      {match.team1Score} : {match.team2Score}
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

                <div className="mt-5">
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
                          score: match.team1Score,
                          players: team1Players,
                          totals: team1Totals,
                          highlight: isTeam1Winner,
                        },
                        {
                          label: "Team 2",
                          name: team2Name,
                          score: match.team2Score,
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
                                    <th className="px-4 py-3">K / D / A</th>
                                    <th className="px-4 py-3">K/D</th>
                                    <th className="px-4 py-3">Damage</th>
                                    <th className="px-4 py-3">HS</th>
                                    <th className="px-4 py-3">Util</th>
                                    <th className="px-4 py-3">Entry</th>
                                    <th className="px-4 py-3">Clutch</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                  {team.players.map((player) => {
                                    const kd =
                                      player.deaths === 0
                                        ? player.kills
                                        : player.kills / player.deaths;
                                    const entryLabel = player.entryCount
                                      ? `${player.entryWins}/${player.entryCount}`
                                      : "-";
                                    const clutchLabel = player.clutchCount
                                      ? `${player.clutchWins}/${player.clutchCount}`
                                      : "-";

                                    return (
                                      <tr
                                        key={`${match.matchId}-${team.label}-${player.steamId64}`}
                                      >
                                        <td className="px-4 py-3 font-medium text-slate-100">
                                          {player.name || player.steamId64}
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
                                        <td className="px-4 py-3 text-slate-200">
                                          {player.headshotKills}
                                        </td>
                                        <td className="px-4 py-3 text-slate-200">
                                          {player.utilityDamage}
                                        </td>
                                        <td className="px-4 py-3 text-slate-200">
                                          {entryLabel}
                                        </td>
                                        <td className="px-4 py-3 text-slate-200">
                                          {clutchLabel}
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

                {otherPlayers.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
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
                                  {player.name || player.steamId64}
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
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
