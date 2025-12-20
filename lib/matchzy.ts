import "server-only";
import mysql, { Pool, RowDataPacket } from "mysql2/promise";

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
  headshotKills: number;
  utilityDamage: number;
  entryCount: number;
  entryWins: number;
  clutchCount: number;
  clutchWins: number;
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
  steamid64: string | number;
  team: string | null;
  name: string | null;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  head_shot_kills: number;
  utility_damage: number;
  entry_count: number;
  entry_wins: number;
  clutch_count: number;
  clutch_wins: number;
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

  pool =
    "url" in config
      ? mysql.createPool(config.url)
      : mysql.createPool({
          host: config.host,
          user: config.user,
          password: config.password,
          database: config.database,
          port: config.port,
          waitForConnections: true,
          connectionLimit: 6,
          enableKeepAlive: true,
          keepAliveInitialDelay: 0,
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
    `SELECT matchid, steamid64, team, name,
            SUM(kills) AS kills,
            SUM(deaths) AS deaths,
            SUM(assists) AS assists,
            SUM(damage) AS damage,
            SUM(head_shot_kills) AS head_shot_kills,
            SUM(utility_damage) AS utility_damage,
            SUM(entry_count) AS entry_count,
            SUM(entry_wins) AS entry_wins,
            SUM(v1_count + v2_count) AS clutch_count,
            SUM(v1_wins + v2_wins) AS clutch_wins
     FROM matchzy_stats_players
     WHERE matchid IN (${placeholders})
     GROUP BY matchid, steamid64, team, name
     ORDER BY matchid DESC, kills DESC`,
    matchIds
  );

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
      headshotKills: toNumber(row.head_shot_kills),
      utilityDamage: toNumber(row.utility_damage),
      entryCount: toNumber(row.entry_count),
      entryWins: toNumber(row.entry_wins),
      clutchCount: toNumber(row.clutch_count),
      clutchWins: toNumber(row.clutch_wins),
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
