import Link from "next/link";
import type { ReactNode } from "react";
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
import { getFaceitProfileCache, type FaceitProfileCacheEntry } from "@/lib/faceitProfiles";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}

function RatingTrend({
  values,
  results,
}: {
  values: number[];
  results: Array<boolean | null>;
}) {
  if (values.length < 2) return null;
  const width = 520;
  const height = 160;
  const chartHeight = 126;
  const stripY = 138;
  const stripHeight = 10;
  const labelWidth = 52;
  const chartWidth = width - labelWidth;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(0.01, max - min);
  const points = values.map((value, index) => {
    const x = labelWidth + (index / (values.length - 1)) * chartWidth;
    const y = chartHeight - ((value - min) / range) * (chartHeight - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const areaPoints = [
    `${labelWidth},${chartHeight}`,
    ...points,
    `${labelWidth + chartWidth},${chartHeight}`,
  ].join(" ");
  const ticks = 5;
  const tickValues = Array.from({ length: ticks }, (_, i) => {
    const t = i / (ticks - 1);
    return max - t * (max - min);
  });
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-36 w-full max-w-[620px]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </linearGradient>
      </defs>
      {tickValues.map((value) => {
        const y = chartHeight - ((value - min) / range) * (chartHeight - 8);
        return (
          <g key={`tick-${value}`}>
            <line
              x1={labelWidth}
              x2={labelWidth + chartWidth}
              y1={y}
              y2={y}
              stroke="#1f2937"
              strokeWidth="1"
            />
            <text
              x={labelWidth - 6}
              y={y + 4}
              textAnchor="end"
              fontSize="10"
              fill="#94a3b8"
            >
              {value.toFixed(2)}
            </text>
          </g>
        );
      })}
      <polygon fill="url(#trendFill)" points={areaPoints} />
      <polyline
        fill="none"
        stroke="#f97316"
        strokeWidth="2"
        points={points.join(" ")}
      />
      {values.map((value, index) => {
        const total = values.length;
        const segWidth = chartWidth / total;
        const x = labelWidth + index * segWidth;
        return (
          <rect
            key={`hit-${index}`}
            x={x}
            y={0}
            width={segWidth}
            height={chartHeight}
            fill="transparent"
          >
            <title>{value.toFixed(2)}</title>
          </rect>
        );
      })}
      {points.map((point, index) => {
        const [x, y] = point.split(",").map(Number);
        const value = values[index]?.toFixed(2);
        return (
          <circle
            key={`p-${index}`}
            cx={x}
            cy={y}
            r={2.2}
            fill="#f97316"
          >
            {value && <title>{value}</title>}
          </circle>
        );
      })}
      {results.map((result, index) => {
        const total = results.length;
        const gap = 4;
        const segWidth = (chartWidth - gap * (total - 1)) / total;
        const x = index * (segWidth + gap);
        const color =
          result === null
            ? "#475569"
            : result
              ? "#22c55e"
              : "#ef4444";
        return (
          <rect
            key={`r-${index}`}
            x={labelWidth + x}
            y={stripY}
            width={segWidth}
            height={stripHeight}
            rx={4}
            fill={color}
          />
        );
      })}
    </svg>
  );
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
  let faceitProfile: FaceitProfileCacheEntry | null = null;
  let faceitError: string | null = null;

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

  try {
    const faceitCache = await getFaceitProfileCache([steamId]);
    faceitProfile = faceitCache.get(steamId) ?? null;
  } catch (err) {
    faceitError =
      err instanceof Error ? err.message : "Failed to load Faceit data.";
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
  const last3Matches = recent.slice(0, 3);
  const recentTotals =
    recent.length > 0
      ? recent.reduce(
          (acc, match) => ({
            kills: acc.kills + match.kills,
            deaths: acc.deaths + match.deaths,
            assists: acc.assists + match.assists,
            damage: acc.damage + match.damage,
            clutchWins: acc.clutchWins + match.clutchWins,
            rounds: acc.rounds + match.rounds,
          }),
          {
            kills: 0,
            deaths: 0,
            assists: 0,
            damage: 0,
            clutchWins: 0,
            rounds: 0,
          }
        )
      : null;
  const last3Totals =
    last3Matches.length > 0
      ? last3Matches.reduce(
          (acc, match) => ({
            matches: acc.matches + 1,
            kills: acc.kills + match.kills,
            deaths: acc.deaths + match.deaths,
            assists: acc.assists + match.assists,
            damage: acc.damage + match.damage,
            clutchWins: acc.clutchWins + match.clutchWins,
            rounds: acc.rounds + match.rounds,
          }),
          {
            matches: 0,
            kills: 0,
            deaths: 0,
            assists: 0,
            damage: 0,
            clutchWins: 0,
            rounds: 0,
          }
        )
      : null;
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
  const last3Stats = last3Totals
    ? {
        matches: last3Totals.matches,
        kills: last3Totals.kills,
        deaths: last3Totals.deaths,
        assists: last3Totals.assists,
        damage: last3Totals.damage,
        rounds: last3Totals.rounds,
        kd: last3Totals.deaths
          ? last3Totals.kills / last3Totals.deaths
          : last3Totals.kills,
        adr: last3Totals.rounds
          ? last3Totals.damage / last3Totals.rounds
          : 0,
      }
    : null;
  const ratingSeries = recent
    .map((match) => ({
      matchId: match.matchId,
      rating: getRatingFromTotals(
        {
          kills: match.kills,
          deaths: match.deaths,
          assists: match.assists,
          damage: match.damage,
          clutchWins: match.clutchWins,
        },
        match.rounds
      ),
    }))
    .filter(
      (entry): entry is { matchId: number; rating: number } =>
        entry.rating !== null
    );
  const trendValues = ratingSeries
    .slice(0, 10)
    .reverse()
    .map((entry) => entry.rating);
  const trendResults = recent
    .slice(0, 10)
    .reverse()
    .map((match) => match.win ?? null);
  const trendHighest =
    trendValues.length > 0 ? Math.max(...trendValues) : null;
  const trendLowest =
    trendValues.length > 0 ? Math.min(...trendValues) : null;
  const winCount = trendResults.filter((result) => result === true).length;
  const lossCount = trendResults.filter((result) => result === false).length;
  const winRatio =
    winCount + lossCount > 0
      ? Math.round((winCount / (winCount + lossCount)) * 100)
      : null;
  const last5Ratings = ratingSeries.slice(0, 5).map((r) => r.rating);
  const prev5Ratings = ratingSeries.slice(5, 10).map((r) => r.rating);
  const avg = (values: number[]) =>
    values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  const last5Avg = avg(last5Ratings);
  const prev5Avg = avg(prev5Ratings);
  const formDelta =
    last5Avg !== null && prev5Avg !== null ? last5Avg - prev5Avg : null;
  const favoriteMap = (() => {
    const mapStats = new Map<
      string,
      { matches: number; wins: number }
    >();
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
      if (!best) {
        best = { mapName, ...statsEntry };
        continue;
      }
      if (statsEntry.matches > best.matches) {
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
    if (!recentTotals || !recentTotals.rounds) return [];
    const kpr = recentTotals.kills / recentTotals.rounds;
    const dpr = recentTotals.deaths / recentTotals.rounds;
    const apr = recentTotals.assists / recentTotals.rounds;
    const adr = recentTotals.damage / recentTotals.rounds;
    const clutchRate = recentTotals.clutchWins / recentTotals.rounds;
    const tags: string[] = [];
    if (kpr >= 0.8) tags.push("Fragger");
    if (adr >= 90) tags.push("Damage Dealer");
    if (apr >= 0.22) tags.push("Support");
    if (clutchRate >= 0.03) tags.push("Closer");
    if (dpr <= 0.65) tags.push("Survivor");
    return tags.slice(0, 3);
  })();
  const faceitGame = faceitProfile
    ? { faceit_elo: faceitProfile.elo, skill_level: faceitProfile.level }
    : null;
  const faceitUrl =
    faceitProfile?.faceitUrl?.replace(
      /\/(%7B|{)lang(%7D|})\//i,
      "/fi/"
    ) ?? null;
  const faceitLevelLabel =
    faceitProfile?.level && faceitProfile.level >= 1
      ? String(Math.min(10, faceitProfile.level))
      : null;
  const faceitBoxValue = faceitGame
    ? {
        label: "Faceit",
        value: (
          <span className="inline-flex items-center gap-2">
            {faceitLevelLabel && (
              <img
                src={`/faceit/level-${faceitLevelLabel}.png`}
                alt={`Faceit level ${faceitLevelLabel}`}
                className="h-6 w-6"
              />
            )}
            <span className="text-lg font-semibold text-slate-100">
              {formatNumber(faceitGame.faceit_elo ?? 0)}
            </span>
          </span>
        ),
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
            <h1 className="mt-1 text-3xl font-semibold">
              <a
                href={`https://steamcommunity.com/profiles/${steamId}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-sky-200 hover:underline"
              >
                {profileName}
              </a>
            </h1>
            {faceitProfile && faceitProfile.nickname && (
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                Faceit:{" "}
                {faceitUrl ? (
                  <a
                    href={faceitUrl}
                    className="text-sky-200 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {faceitProfile.nickname}
                  </a>
                ) : (
                  faceitProfile.nickname
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      {matchError && (
        <div className="rounded-2xl border border-rose-900/60 bg-rose-950/40 p-5 text-sm text-rose-100">
          {matchError}
        </div>
      )}

      {!matchError && (stats || faceitBoxValue) && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Ratings</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {([
              stats && {
                label: "Rating",
                value: stats.rating ? stats.rating.toFixed(2) : "-",
              },
              stats && {
                label: "Rating (last 3)",
                value: last3Rating ? last3Rating.toFixed(2) : "-",
              },
              faceitBoxValue,
              playstyleTags.length > 0 && {
                label: "Playstyle",
                value: (
                  <div className="flex flex-wrap gap-2">
                    {playstyleTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-slate-700 bg-slate-950/50 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-200"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ),
              },
            ].filter(Boolean) as { label: string; value: ReactNode }[]).map(
              (item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-md shadow-sky-900/10"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {item.label}
                  </p>
                  <div className="mt-2 text-2xl font-semibold text-slate-100">
                    {item.value}
                  </div>
                </div>
              )
            )}
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-md shadow-sky-900/10">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Recent performance
            </p>
            <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-3">
                <div className="text-sm text-slate-300">
                  Rating trend (last 10)
                </div>
                <div className="text-slate-300">
                  <RatingTrend values={trendValues} results={trendResults} />
                </div>
              </div>
              <div className="w-full max-w-[220px] rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-200">
                <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    W
                    <span className="text-emerald-300">{winCount}</span>
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-400" />
                    L
                    <span className="text-rose-300">{lossCount}</span>
                  </span>
                  {winRatio !== null && (
                    <span className="ml-auto text-slate-300">
                      {winRatio}%
                    </span>
                  )}
                </div>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Highest</span>
                    <span className="font-semibold text-emerald-200">
                      {trendHighest !== null
                        ? trendHighest.toFixed(2)
                        : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Lowest</span>
                    <span className="font-semibold text-rose-200">
                      {trendLowest !== null ? trendLowest.toFixed(2) : "-"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!matchError && stats && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Stats</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-md shadow-sky-900/10">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Lifetime
              </p>
              <div className="mt-4 grid gap-3 text-sm text-slate-200">
                <div className="flex items-center justify-between">
                  <span>Matches</span>
                  <span className="font-semibold">
                    {formatNumber(stats.matches)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>K / D / A</span>
                  <span className="font-semibold">
                    {stats.kills} / {stats.deaths} / {stats.assists}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>K/D</span>
                  <span className="font-semibold">{stats.kd.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>ADR</span>
                  <span className="font-semibold">{stats.adr.toFixed(1)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>HS%</span>
                  <span className="font-semibold">
                    {stats.hs.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-md shadow-sky-900/10">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Last 3 matches
              </p>
              {last3Stats ? (
                <div className="mt-4 grid gap-3 text-sm text-slate-200">
                  <div className="flex items-center justify-between">
                    <span>Matches</span>
                    <span className="font-semibold">
                      {formatNumber(last3Stats.matches)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>K / D / A</span>
                    <span className="font-semibold">
                      {last3Stats.kills} / {last3Stats.deaths} /{" "}
                      {last3Stats.assists}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>K/D</span>
                    <span className="font-semibold">
                      {last3Stats.kd.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>ADR</span>
                    <span className="font-semibold">
                      {last3Stats.adr.toFixed(1)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-400">
                  Not enough matches yet.
                </div>
              )}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-md shadow-sky-900/10">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Favorite map
              </p>
              {favoriteMap ? (
                <div className="mt-4 space-y-2 text-sm text-slate-200">
                  <div className="text-lg font-semibold text-slate-100">
                    {favoriteMap.mapName}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Matches</span>
                    <span className="font-semibold">
                      {favoriteMap.matches}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Win rate</span>
                    <span className="font-semibold">
                      {Math.round(
                        (favoriteMap.wins /
                          Math.max(1, favoriteMap.matches)) *
                          100
                      )}
                      %
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-400">
                  Not enough data yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {faceitError && (
        <div className="rounded-2xl border border-amber-900/60 bg-amber-950/30 p-4 text-xs text-amber-100">
          Faceit: {faceitError}
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
                    <th className="px-3 py-2">Map</th>
                    <th className="px-3 py-2">Result</th>
                    <th className="px-3 py-2">Score</th>
                    <th className="px-3 py-2">K / D / A</th>
                    <th className="px-3 py-2">ADR</th>
                    <th className="px-3 py-2 text-right">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {recent.map((match) => {
                    const adr = match.rounds
                      ? match.damage / match.rounds
                      : 0;
                    const baseTeam1Score =
                      match.mapTeam1Score ?? match.team1Score ?? 0;
                    const baseTeam2Score =
                      match.mapTeam2Score ?? match.team2Score ?? 0;
                    const side = match.teamSide;
                    const score =
                      side === "team1"
                        ? `${baseTeam1Score} : ${baseTeam2Score}`
                        : side === "team2"
                          ? `${baseTeam2Score} : ${baseTeam1Score}`
                          : "-";
                    const result =
                      match.win === null ? "-" : match.win ? "W" : "L";
                    const resultTone =
                      match.win === null
                        ? "border-slate-700 text-slate-300"
                        : match.win
                          ? "border-emerald-500/60 text-emerald-300"
                          : "border-rose-500/60 text-rose-300";
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
                          {match.mapName || "Unknown"}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${resultTone}`}
                          >
                            {result}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-200">{score}</td>
                        <td className="px-3 py-2 text-slate-200">
                          {match.kills} / {match.deaths} / {match.assists}
                        </td>
                        <td className="px-3 py-2 text-slate-200">
                          {adr.toFixed(1)}
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
