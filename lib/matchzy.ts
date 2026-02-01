import "server-only";
import mysql, { Pool, RowDataPacket } from "mysql2/promise";
import {
  getMatchWinner,
  getRatingFromTotals,
  normalizeTeam,
} from "./matchStatsFormat";

export type MatchMapStats = {
  mapNumber: number;
  mapName: string;
  winner: string;
  startTime: Date | null;
  endTime: Date | null;
  team1Score: number;
  team2Score: number;
};

export type MatchPlayerStats = {
  steamId64: string;
  team: string;
  name: string;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  enemy5ks: number;
  enemy4ks: number;
  enemy3ks: number;
  enemy2ks: number;
  utilityCount: number;
  headshotKills: number;
  utilityDamage: number;
  utilitySuccesses: number;
  utilityEnemies: number;
  flashCount: number;
  flashSuccesses: number;
  healthPointsRemovedTotal: number;
  healthPointsDealtTotal: number;
  shotsFiredTotal: number;
  shotsOnTargetTotal: number;
  entryCount: number;
  entryWins: number;
  clutchCount: number;
  clutchWins: number;
  v1Count: number;
  v1Wins: number;
  v2Count: number;
  v2Wins: number;
  equipmentValue: number;
  moneySaved: number;
  killReward: number;
  liveTime: number;
  cashEarned: number;
  enemiesFlashed: number;
};

export type MatchStats = {
  matchId: number;
  startTime: Date | null;
  endTime: Date | null;
  winner: string;
  seriesType: string;
  team1Name: string;
  team2Name: string;
  team1Score: number;
  team2Score: number;
  serverIp: string;
  maps: MatchMapStats[];
  players: MatchPlayerStats[];
};

export type PlayerMatchSummary = {
  matchId: number;
  steamId64: string;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  clutchWins: number;
  rounds: number;
};

export type PlayerLeaderboardEntry = {
  steamId64: string;
  name: string;
  matches: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  headshotKills: number;
  clutchWins: number;
  rounds: number;
  rating: number | null;
};

export type PlayerTotals = {
  steamId64: string;
  matches: number;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  headshotKills: number;
  clutchWins: number;
  rounds: number;
  rating: number | null;
};

type MatchRow = RowDataPacket & {
  matchid: number;
  start_time: Date | string | null;
  end_time: Date | string | null;
  winner: string | null;
  series_type: string | null;
  team1_name: string | null;
  team2_name: string | null;
  team1_score: number;
  team2_score: number;
  server_ip: string | null;
};

type MapRow = RowDataPacket & {
  matchid: number;
  mapnumber: number;
  mapname: string | null;
  winner: string | null;
  start_time: Date | string | null;
  end_time: Date | string | null;
  team1_score: number;
  team2_score: number;
};

type PlayerRow = RowDataPacket & {
  matchid: number;
  steamid64: string;
  team: string | null;
  name: string | null;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  enemy5ks: number;
  enemy4ks: number;
  enemy3ks: number;
  enemy2ks: number;
  utility_count: number;
  head_shot_kills: number;
  utility_damage: number;
  utility_successes: number;
  utility_enemies: number;
  flash_count: number;
  flash_successes: number;
  health_points_removed_total: number;
  health_points_dealt_total: number;
  shots_fired_total: number;
  shots_on_target_total: number;
  entry_count: number;
  entry_wins: number;
  clutch_count: number;
  clutch_wins: number;
  v1_count: number;
  v1_wins: number;
  v2_count: number;
  v2_wins: number;
  equipment_value: number;
  money_saved: number;
  kill_reward: number;
  live_time: number;
  cash_earned: number;
  enemies_flashed: number;
};

type LeaderboardMatchRow = RowDataPacket & {
  matchid: number;
  start_time: Date | string | null;
  winner: string | null;
  series_type: string | null;
  team1_name: string | null;
  team2_name: string | null;
  team1_score: number;
  team2_score: number;
};

type LeaderboardPlayerRow = RowDataPacket & {
  matchid: number;
  steamid64: string;
  team: string | null;
  name: string | null;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  head_shot_kills: number;
  clutch_wins: number;
};

type PlayerSummaryRow = RowDataPacket & {
  matchid: number;
  steamid64: string;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  clutch_wins: number;
};

type MatchRoundsRow = RowDataPacket & {
  matchid: number;
  rounds: number;
};

type PlayerTotalsRow = RowDataPacket & {
  matches: number | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  damage: number | null;
  headshot_kills: number | null;
  clutch_wins: number | null;
};

type RoundsTotalRow = RowDataPacket & {
  rounds: number | null;
};

type MatchzyConfig =
  | { url: string }
  | {
      host: string;
      user: string;
      password?: string;
      database: string;
      port: number;
    };

function getMatchzyConfig(): MatchzyConfig | null {
  if (process.env.MATCHZY_DB_URL) {
    return { url: process.env.MATCHZY_DB_URL };
  }

  const host = process.env.MATCHZY_DB_HOST;
  const user = process.env.MATCHZY_DB_USER;
  const database = process.env.MATCHZY_DB_NAME;

  if (!host || !user || !database) {
    return null;
  }

  return {
    host,
    user,
    password: process.env.MATCHZY_DB_PASSWORD,
    database,
    port: Number(process.env.MATCHZY_DB_PORT ?? 3306),
  };
}

let pool: Pool | null = null;

export function hasMatchzyConfig() {
  return getMatchzyConfig() !== null;
}

export function getMatchzyPool(): Pool {
  if (pool) return pool;

  const config = getMatchzyConfig();
  if (!config) {
    throw new Error(
      "MatchZy database config missing. Set MATCHZY_DB_URL or MATCHZY_DB_HOST/MATCHZY_DB_USER/MATCHZY_DB_NAME."
    );
  }

  const poolOptions = {
    waitForConnections: true,
    connectionLimit: 6,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 5000,
  };

  pool =
    "url" in config
      ? mysql.createPool({ uri: config.url, ...poolOptions })
      : mysql.createPool({
          host: config.host,
          user: config.user,
          password: config.password,
          database: config.database,
          port: config.port,
          ...poolOptions,
        });

  return pool;
}

function toDate(value: Date | string | null) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toString(value: string | number | null) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function resolveTeamSide(
  teamValue: string | null,
  team1Name: string,
  team2Name: string
) {
  const key = normalizeTeam(teamValue ?? "");
  if (!key) return null;
  const team1Key = normalizeTeam(team1Name);
  const team2Key = normalizeTeam(team2Name);
  const team1Aliases = new Set<string>(["team1", "t1"]);
  const team2Aliases = new Set<string>(["team2", "t2"]);
  if (team1Key) team1Aliases.add(team1Key);
  if (team2Key) team2Aliases.add(team2Key);
  if (team1Aliases.has(key)) return "team1";
  if (team2Aliases.has(key)) return "team2";
  return null;
}

function buildMatchStats(
  matches: MatchRow[],
  maps: MapRow[],
  players: PlayerRow[]
): MatchStats[] {
  if (!matches.length) return [];

  const mapsByMatch = new Map<number, MatchMapStats[]>();
  for (const row of maps) {
    const matchId = toNumber(row.matchid);
    const entry: MatchMapStats = {
      mapNumber: toNumber(row.mapnumber),
      mapName: row.mapname ?? "",
      winner: row.winner ?? "",
      startTime: toDate(row.start_time),
      endTime: toDate(row.end_time),
      team1Score: toNumber(row.team1_score),
      team2Score: toNumber(row.team2_score),
    };

    if (!mapsByMatch.has(matchId)) {
      mapsByMatch.set(matchId, []);
    }
    mapsByMatch.get(matchId)?.push(entry);
  }

  const playersByMatch = new Map<number, MatchPlayerStats[]>();
  for (const row of players) {
    const matchId = toNumber(row.matchid);
    const entry: MatchPlayerStats = {
      steamId64: toString(row.steamid64),
      team: row.team ?? "",
      name: row.name ?? "",
      kills: toNumber(row.kills),
      deaths: toNumber(row.deaths),
      assists: toNumber(row.assists),
      damage: toNumber(row.damage),
      enemy5ks: toNumber(row.enemy5ks),
      enemy4ks: toNumber(row.enemy4ks),
      enemy3ks: toNumber(row.enemy3ks),
      enemy2ks: toNumber(row.enemy2ks),
      utilityCount: toNumber(row.utility_count),
      headshotKills: toNumber(row.head_shot_kills),
      utilityDamage: toNumber(row.utility_damage),
      utilitySuccesses: toNumber(row.utility_successes),
      utilityEnemies: toNumber(row.utility_enemies),
      flashCount: toNumber(row.flash_count),
      flashSuccesses: toNumber(row.flash_successes),
      healthPointsRemovedTotal: toNumber(row.health_points_removed_total),
      healthPointsDealtTotal: toNumber(row.health_points_dealt_total),
      shotsFiredTotal: toNumber(row.shots_fired_total),
      shotsOnTargetTotal: toNumber(row.shots_on_target_total),
      entryCount: toNumber(row.entry_count),
      entryWins: toNumber(row.entry_wins),
      clutchCount: toNumber(row.clutch_count),
      clutchWins: toNumber(row.clutch_wins),
      v1Count: toNumber(row.v1_count),
      v1Wins: toNumber(row.v1_wins),
      v2Count: toNumber(row.v2_count),
      v2Wins: toNumber(row.v2_wins),
      equipmentValue: toNumber(row.equipment_value),
      moneySaved: toNumber(row.money_saved),
      killReward: toNumber(row.kill_reward),
      liveTime: toNumber(row.live_time),
      cashEarned: toNumber(row.cash_earned),
      enemiesFlashed: toNumber(row.enemies_flashed),
    };

    if (!playersByMatch.has(matchId)) {
      playersByMatch.set(matchId, []);
    }
    playersByMatch.get(matchId)?.push(entry);
  }

  return matches.map((row) => ({
    matchId: toNumber(row.matchid),
    startTime: toDate(row.start_time),
    endTime: toDate(row.end_time),
    winner: row.winner ?? "",
    seriesType: row.series_type ?? "",
    team1Name: row.team1_name ?? "",
    team2Name: row.team2_name ?? "",
    team1Score: toNumber(row.team1_score),
    team2Score: toNumber(row.team2_score),
    serverIp: row.server_ip ?? "",
    maps: mapsByMatch.get(toNumber(row.matchid)) ?? [],
    players: playersByMatch.get(toNumber(row.matchid)) ?? [],
  }));
}

export async function fetchMatchStats(limit = 25): Promise<MatchStats[]> {
  const db = getMatchzyPool();
  const [matches] = await db.query<MatchRow[]>(
    `SELECT matchid, start_time, end_time, winner, series_type, team1_name, team2_name,
            team1_score, team2_score, server_ip
     FROM matchzy_stats_matches
     ORDER BY matchid DESC
     LIMIT ?`,
    [limit]
  );

  if (!matches.length) return [];

  const matchIds = matches.map((row) => row.matchid);
  const placeholders = matchIds.map(() => "?").join(",");

  const [maps] = await db.query<MapRow[]>(
    `SELECT matchid, mapnumber, mapname, winner, start_time, end_time, team1_score, team2_score
     FROM matchzy_stats_maps
     WHERE matchid IN (${placeholders})
     ORDER BY matchid DESC, mapnumber ASC`,
    matchIds
  );

  const [players] = await db.query<PlayerRow[]>(
    `SELECT matchid, CAST(steamid64 AS CHAR) AS steamid64, team, name,
            SUM(kills) AS kills,
            SUM(deaths) AS deaths,
            SUM(assists) AS assists,
            SUM(damage) AS damage,
            SUM(enemy5ks) AS enemy5ks,
            SUM(enemy4ks) AS enemy4ks,
            SUM(enemy3ks) AS enemy3ks,
            SUM(enemy2ks) AS enemy2ks,
            SUM(utility_count) AS utility_count,
            SUM(head_shot_kills) AS head_shot_kills,
            SUM(utility_damage) AS utility_damage,
            SUM(utility_successes) AS utility_successes,
            SUM(utility_enemies) AS utility_enemies,
            SUM(flash_count) AS flash_count,
            SUM(flash_successes) AS flash_successes,
            SUM(health_points_removed_total) AS health_points_removed_total,
            SUM(health_points_dealt_total) AS health_points_dealt_total,
            SUM(shots_fired_total) AS shots_fired_total,
            SUM(shots_on_target_total) AS shots_on_target_total,
            SUM(entry_count) AS entry_count,
            SUM(entry_wins) AS entry_wins,
            SUM(v1_count) AS v1_count,
            SUM(v1_wins) AS v1_wins,
            SUM(v2_count) AS v2_count,
            SUM(v2_wins) AS v2_wins,
            SUM(v1_count + v2_count) AS clutch_count,
            SUM(v1_wins + v2_wins) AS clutch_wins,
            SUM(equipment_value) AS equipment_value,
            SUM(money_saved) AS money_saved,
            SUM(kill_reward) AS kill_reward,
            SUM(live_time) AS live_time,
            SUM(cash_earned) AS cash_earned,
            SUM(enemies_flashed) AS enemies_flashed
     FROM matchzy_stats_players
     WHERE matchid IN (${placeholders})
     GROUP BY matchid, steamid64, team, name
     ORDER BY matchid DESC, kills DESC`,
    matchIds
  );

  return buildMatchStats(matches, maps, players);
}

export async function fetchMatchStatsById(
  matchId: number
): Promise<MatchStats | null> {
  const db = getMatchzyPool();
  const [matches] = await db.query<MatchRow[]>(
    `SELECT matchid, start_time, end_time, winner, series_type, team1_name, team2_name,
            team1_score, team2_score, server_ip
     FROM matchzy_stats_matches
     WHERE matchid = ?
     LIMIT 1`,
    [matchId]
  );

  if (!matches.length) return null;

  const [maps] = await db.query<MapRow[]>(
    `SELECT matchid, mapnumber, mapname, winner, start_time, end_time, team1_score, team2_score
     FROM matchzy_stats_maps
     WHERE matchid = ?
     ORDER BY mapnumber ASC`,
    [matchId]
  );

  const [players] = await db.query<PlayerRow[]>(
    `SELECT matchid, CAST(steamid64 AS CHAR) AS steamid64, team, name,
            SUM(kills) AS kills,
            SUM(deaths) AS deaths,
            SUM(assists) AS assists,
            SUM(damage) AS damage,
            SUM(enemy5ks) AS enemy5ks,
            SUM(enemy4ks) AS enemy4ks,
            SUM(enemy3ks) AS enemy3ks,
            SUM(enemy2ks) AS enemy2ks,
            SUM(utility_count) AS utility_count,
            SUM(head_shot_kills) AS head_shot_kills,
            SUM(utility_damage) AS utility_damage,
            SUM(utility_successes) AS utility_successes,
            SUM(utility_enemies) AS utility_enemies,
            SUM(flash_count) AS flash_count,
            SUM(flash_successes) AS flash_successes,
            SUM(health_points_removed_total) AS health_points_removed_total,
            SUM(health_points_dealt_total) AS health_points_dealt_total,
            SUM(shots_fired_total) AS shots_fired_total,
            SUM(shots_on_target_total) AS shots_on_target_total,
            SUM(entry_count) AS entry_count,
            SUM(entry_wins) AS entry_wins,
            SUM(v1_count) AS v1_count,
            SUM(v1_wins) AS v1_wins,
            SUM(v2_count) AS v2_count,
            SUM(v2_wins) AS v2_wins,
            SUM(v1_count + v2_count) AS clutch_count,
            SUM(v1_wins + v2_wins) AS clutch_wins,
            SUM(equipment_value) AS equipment_value,
            SUM(money_saved) AS money_saved,
            SUM(kill_reward) AS kill_reward,
            SUM(live_time) AS live_time,
            SUM(cash_earned) AS cash_earned,
            SUM(enemies_flashed) AS enemies_flashed
     FROM matchzy_stats_players
     WHERE matchid = ?
     GROUP BY matchid, steamid64, team, name
     ORDER BY kills DESC`,
    [matchId]
  );

  const stats = buildMatchStats(matches, maps, players);
  return stats[0] ?? null;
}

export async function fetchPlayerLeaderboard(
  limit = 50
): Promise<PlayerLeaderboardEntry[]> {
  if (limit <= 0) return [];
  const db = getMatchzyPool();
  const [matchRows] = await db.query<LeaderboardMatchRow[]>(
    `SELECT matchid, start_time, winner, series_type, team1_name, team2_name,
            team1_score, team2_score
     FROM matchzy_stats_matches`
  );

  if (!matchRows.length) return [];

  const matchIds = matchRows.map((row) => row.matchid);
  const placeholders = matchIds.map(() => "?").join(",");
  const [roundRows] = await db.query<MatchRoundsRow[]>(
    `SELECT matchid, SUM(team1_score + team2_score) AS rounds
     FROM matchzy_stats_maps
     WHERE matchid IN (${placeholders})
     GROUP BY matchid`,
    matchIds
  );

  const roundsByMatch = new Map<number, number>();
  for (const row of roundRows) {
    roundsByMatch.set(toNumber(row.matchid), toNumber(row.rounds));
  }

  const matchById = new Map<
    number,
    {
      startTime: Date | null;
      team1Name: string;
      team2Name: string;
      winnerSide: "team1" | "team2" | null;
    }
  >();

  for (const row of matchRows) {
    const matchId = toNumber(row.matchid);
    const team1Name = row.team1_name ?? "";
    const team2Name = row.team2_name ?? "";
    const winnerName = getMatchWinner({
      winner: row.winner ?? "",
      seriesType: row.series_type ?? "",
      team1Name,
      team2Name,
      team1Score: toNumber(row.team1_score),
      team2Score: toNumber(row.team2_score),
    });
    const winnerSide = winnerName
      ? resolveTeamSide(winnerName, team1Name, team2Name)
      : null;

    matchById.set(matchId, {
      startTime: toDate(row.start_time),
      team1Name,
      team2Name,
      winnerSide,
    });
  }

  const [playerRows] = await db.query<LeaderboardPlayerRow[]>(
    `SELECT matchid, CAST(steamid64 AS CHAR) AS steamid64, team, name,
            SUM(kills) AS kills,
            SUM(deaths) AS deaths,
            SUM(assists) AS assists,
            SUM(damage) AS damage,
            SUM(head_shot_kills) AS head_shot_kills,
            SUM(v1_wins + v2_wins) AS clutch_wins
     FROM matchzy_stats_players
     GROUP BY matchid, steamid64, team, name
     ORDER BY matchid DESC`
  );

  if (!playerRows.length) return [];

  const leaderboard = new Map<
    string,
    {
      steamId64: string;
      name: string;
      latestMatchTime: number;
      latestMatchId: number;
      kills: number;
      deaths: number;
      assists: number;
      damage: number;
      headshotKills: number;
      clutchWins: number;
      rounds: number;
      matchTeams: Map<number, "team1" | "team2" | null>;
    }
  >();

  for (const row of playerRows) {
    const matchId = toNumber(row.matchid);
    const match = matchById.get(matchId);
    if (!match) continue;

    const steamId64 = toString(row.steamid64);
    let entry = leaderboard.get(steamId64);
    if (!entry) {
      entry = {
        steamId64,
        name: "",
        latestMatchTime: -1,
        latestMatchId: -1,
        kills: 0,
        deaths: 0,
        assists: 0,
      damage: 0,
      headshotKills: 0,
      clutchWins: 0,
      rounds: 0,
      matchTeams: new Map(),
    };
    leaderboard.set(steamId64, entry);
  }

    entry.kills += toNumber(row.kills);
    entry.deaths += toNumber(row.deaths);
    entry.assists += toNumber(row.assists);
    entry.damage += toNumber(row.damage);
    entry.headshotKills += toNumber(row.head_shot_kills);
    entry.clutchWins += toNumber(row.clutch_wins);

    const matchTime = match.startTime?.getTime() ?? 0;
    const rowName = row.name?.trim() ?? "";
    if (
      rowName &&
      (matchTime > entry.latestMatchTime ||
        (matchTime === entry.latestMatchTime && matchId > entry.latestMatchId))
    ) {
      entry.name = rowName;
      entry.latestMatchTime = matchTime;
      entry.latestMatchId = matchId;
    }

    const teamSide = resolveTeamSide(row.team, match.team1Name, match.team2Name);
    if (!entry.matchTeams.has(matchId)) {
      entry.matchTeams.set(matchId, teamSide);
      entry.rounds += roundsByMatch.get(matchId) ?? 0;
    } else if (teamSide) {
      const existing = entry.matchTeams.get(matchId);
      if (existing && existing !== teamSide) {
        entry.matchTeams.set(matchId, null);
      } else if (!existing) {
        entry.matchTeams.set(matchId, teamSide);
      }
    }
  }

  const entries: PlayerLeaderboardEntry[] = [];
  for (const entry of leaderboard.values()) {
    let wins = 0;
    let losses = 0;
    for (const [matchId, teamSide] of entry.matchTeams) {
      if (!teamSide) continue;
      const match = matchById.get(matchId);
      if (!match?.winnerSide) continue;
      if (match.winnerSide === teamSide) {
        wins += 1;
      } else {
        losses += 1;
      }
    }

    const rating = getRatingFromTotals(
      {
        kills: entry.kills,
        deaths: entry.deaths,
        assists: entry.assists,
        damage: entry.damage,
        clutchWins: entry.clutchWins,
      },
      entry.rounds
    );

    entries.push({
      steamId64: entry.steamId64,
      name: entry.name || entry.steamId64,
      matches: entry.matchTeams.size,
      wins,
      losses,
      kills: entry.kills,
      deaths: entry.deaths,
      assists: entry.assists,
      damage: entry.damage,
      headshotKills: entry.headshotKills,
      clutchWins: entry.clutchWins,
      rounds: entry.rounds,
      rating,
    });
  }

  entries.sort((a, b) => {
    const aRating = a.rating ?? -Infinity;
    const bRating = b.rating ?? -Infinity;
    if (bRating !== aRating) return bRating - aRating;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.kills !== a.kills) return b.kills - a.kills;
    return b.matches - a.matches;
  });

  return entries.slice(0, limit);
}

export async function fetchRecentPlayerMatchSummaries(
  steamId64: string,
  limit = 5
): Promise<PlayerMatchSummary[]> {
  const db = getMatchzyPool();
  const [playerRows] = await db.query<PlayerSummaryRow[]>(
    `SELECT matchid, CAST(steamid64 AS CHAR) AS steamid64,
            SUM(kills) AS kills,
            SUM(deaths) AS deaths,
            SUM(assists) AS assists,
            SUM(damage) AS damage,
            SUM(v1_wins + v2_wins) AS clutch_wins
     FROM matchzy_stats_players
     WHERE steamid64 = ?
     GROUP BY matchid, steamid64
     ORDER BY matchid DESC
     LIMIT ?`,
    [steamId64, limit]
  );

  if (!playerRows.length) return [];

  const matchIds = playerRows.map((row) => row.matchid);
  const placeholders = matchIds.map(() => "?").join(",");
  const [roundRows] = await db.query<MatchRoundsRow[]>(
    `SELECT matchid, SUM(team1_score + team2_score) AS rounds
     FROM matchzy_stats_maps
     WHERE matchid IN (${placeholders})
     GROUP BY matchid`,
    matchIds
  );

  const roundsByMatch = new Map<number, number>();
  for (const row of roundRows) {
    roundsByMatch.set(toNumber(row.matchid), toNumber(row.rounds));
  }

  return playerRows.map((row) => {
    const matchId = toNumber(row.matchid);
    return {
      matchId,
      steamId64: toString(row.steamid64),
      kills: toNumber(row.kills),
      deaths: toNumber(row.deaths),
      assists: toNumber(row.assists),
      damage: toNumber(row.damage),
      clutchWins: toNumber(row.clutch_wins),
      rounds: roundsByMatch.get(matchId) ?? 0,
    };
  });
}

export async function fetchPlayerTotals(
  steamId64: string
): Promise<PlayerTotals | null> {
  const db = getMatchzyPool();
  const [totalRows] = await db.query<PlayerTotalsRow[]>(
    `SELECT COUNT(DISTINCT matchid) AS matches,
            SUM(kills) AS kills,
            SUM(deaths) AS deaths,
            SUM(assists) AS assists,
            SUM(damage) AS damage,
            SUM(head_shot_kills) AS headshot_kills,
            SUM(v1_wins + v2_wins) AS clutch_wins
     FROM matchzy_stats_players
     WHERE steamid64 = ?`,
    [steamId64]
  );

  if (!totalRows.length) return null;

  const totals = totalRows[0];
  const [roundRows] = await db.query<RoundsTotalRow[]>(
    `SELECT SUM(team1_score + team2_score) AS rounds
     FROM matchzy_stats_maps
     WHERE matchid IN (
       SELECT DISTINCT matchid FROM matchzy_stats_players WHERE steamid64 = ?
     )`,
    [steamId64]
  );

  const rounds = roundRows[0]?.rounds ?? 0;
  const stats = {
    kills: toNumber(totals.kills),
    deaths: toNumber(totals.deaths),
    assists: toNumber(totals.assists),
    damage: toNumber(totals.damage),
    clutchWins: toNumber(totals.clutch_wins),
  };
  const rating = getRatingFromTotals(stats, rounds);

  return {
    steamId64,
    matches: toNumber(totals.matches),
    kills: stats.kills,
    deaths: stats.deaths,
    assists: stats.assists,
    damage: stats.damage,
    headshotKills: toNumber(totals.headshot_kills),
    clutchWins: stats.clutchWins,
    rounds: toNumber(rounds),
    rating,
  };
}
