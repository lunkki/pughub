import type { MatchStats } from "./matchzy";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDate(value: Date | null) {
  if (!value) return "TBD";
  return dateFormatter.format(value);
}

export function formatDuration(start: Date | null, end: Date | null) {
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

export function formatSeriesType(seriesType: string) {
  if (!seriesType.trim()) return "Series";
  return seriesType.toUpperCase();
}

export type MatchWinnerSource = Pick<
  MatchStats,
  "winner" | "seriesType" | "team1Name" | "team2Name" | "team1Score" | "team2Score"
>;

function getSeriesTargetWins(seriesType: string) {
  const match = seriesType.match(/(\d+)/);
  if (!match) return null;
  const bestOf = Number(match[1]);
  if (!Number.isFinite(bestOf) || bestOf <= 0) return null;
  return Math.floor(bestOf / 2) + 1;
}

export function getMatchWinner(match: MatchWinnerSource) {
  const storedWinner = match.winner.trim();
  if (storedWinner) {
    const normalized = storedWinner.toLowerCase();
    const invalid = new Set(["open", "pending", "tbd", "unknown", "in_progress"]);
    if (!invalid.has(normalized)) return storedWinner;
  }

  const team1Score = match.team1Score;
  const team2Score = match.team2Score;
  if (team1Score === team2Score) return "";

  const targetWins = getSeriesTargetWins(match.seriesType);
  if (targetWins !== null) {
    if (team1Score >= targetWins && team1Score > team2Score) {
      return match.team1Name.trim() || "Team 1";
    }
    if (team2Score >= targetWins && team2Score > team1Score) {
      return match.team2Name.trim() || "Team 2";
    }
    return "";
  }

  if (team1Score > team2Score) return match.team1Name.trim() || "Team 1";
  if (team2Score > team1Score) return match.team2Name.trim() || "Team 2";
  return "";
}

export function normalizeTeam(value: string) {
  return value.trim().toLowerCase();
}

export function getTotals(players: MatchStats["players"]) {
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

export function splitPlayersByTeam(match: MatchStats) {
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

export function getTopPlayer(
  players: MatchStats["players"],
  metric: "kills" | "damage"
) {
  if (players.length === 0) return null;
  return players.slice(1).reduce((top, player) => {
    if (player[metric] > top[metric]) return player;
    return top;
  }, players[0]);
}

export function getMatchRounds(match: MatchStats) {
  return match.maps.reduce(
    (total, map) => total + map.team1Score + map.team2Score,
    0
  );
}

export function getMapImage(mapName: string) {
  if (!mapName.trim()) return null;
  const slug = mapName.trim().toLowerCase().replace(/\s+/g, "_");
  return `/maps/${slug}.jpg`;
}

export function getAdr(player: MatchStats["players"][number], rounds: number) {
  if (!rounds) return null;
  return player.damage / rounds;
}

export function getHsPercent(player: MatchStats["players"][number]) {
  if (!player.kills) return null;
  return (player.headshotKills / player.kills) * 100;
}

export function getKastEstimate(
  player: MatchStats["players"][number],
  rounds: number
) {
  if (!rounds) return null;
  const involvement = Math.min(
    rounds,
    player.kills + player.assists + player.clutchWins
  );
  return (involvement / rounds) * 100;
}

export function getRating(
  player: MatchStats["players"][number],
  rounds: number
) {
  if (!rounds) return null;
  const kpr = player.kills / rounds;
  const dpr = player.deaths / rounds;
  const apr = player.assists / rounds;
  const adr = player.damage / rounds;
  const kast = getKastEstimate(player, rounds) ?? 0;
  const impact = 2.13 * kpr + 0.42 * apr - 0.41;
  const rating =
    0.00738764 * kast +
    0.35912389 * kpr +
    -0.5329508 * dpr +
    0.2372603 * impact +
    0.0032397 * adr +
    0.1587 -
    0.01;
  return rating;
}

export function getRatingFromTotals(
  stats: {
    kills: number;
    deaths: number;
    assists: number;
    damage: number;
    clutchWins: number;
  },
  rounds: number
) {
  if (!rounds) return null;
  const kpr = stats.kills / rounds;
  const dpr = stats.deaths / rounds;
  const apr = stats.assists / rounds;
  const adr = stats.damage / rounds;
  const involvement = Math.min(
    rounds,
    stats.kills + stats.assists + stats.clutchWins
  );
  const kast = (involvement / rounds) * 100;
  const impact = 2.13 * kpr + 0.42 * apr - 0.41;
  const rating =
    0.00738764 * kast +
    0.35912389 * kpr +
    -0.5329508 * dpr +
    0.2372603 * impact +
    0.0032397 * adr +
    0.1587 -
    0.01;
  return rating;
}
