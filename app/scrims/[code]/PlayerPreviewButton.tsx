"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type PlayerPreview = {
  steamId: string;
  profileName: string;
  avatarUrl: string | null;
  steamProfileUrl: string;
  faceit: {
    nickname: string | null;
    elo: number | null;
    level: number | null;
    faceitUrl: string | null;
  };
  stats: {
    matches: number;
    kills: number;
    deaths: number;
    assists: number;
    damage: number;
    rounds: number;
    kd: number;
    adr: number;
    hs: number;
    rating: number | null;
  } | null;
  last3Rating: number | null;
  recentMatches: Array<{
    matchId: number;
    mapName: string;
    result: "W" | "L" | "-";
    score: string;
    kills: number;
    deaths: number;
    assists: number;
    rating: number | null;
  }>;
  favoriteMap: { mapName: string; matches: number; wins: number } | null;
  playstyleTags: string[];
  form: {
    wins: number;
    losses: number;
    winRatio: number | null;
  };
  matchError: string | null;
  faceitError: string | null;
};

function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}

function CrownIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 20 20"
      className="h-4 w-4"
    >
      <path
        fill="currentColor"
        d="M3 15.5h14l-1.2-7.5-3.4 2.7-2.4-5.2-2.4 5.2-3.4-2.7L3 15.5Zm0 1.5a.5.5 0 0 0 0 1h14a.5.5 0 0 0 0-1H3Z"
      />
    </svg>
  );
}

type Props = {
  steamId?: string | null;
  name: string;
  isCaptain?: boolean;
};

export function PlayerPreviewButton({
  steamId,
  name,
  isCaptain = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PlayerPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedSteamId, setLoadedSteamId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !steamId || loadedSteamId === steamId) return;
    const requestSteamId = steamId;

    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/profile/${requestSteamId}/preview`, {
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => ({}))) as
          | PlayerPreview
          | { error?: string };

        if (cancelled) return;
        if (!res.ok) {
          setError(
            "error" in payload && payload.error
              ? payload.error
              : "Failed to load player preview."
          );
          setData(null);
          return;
        }

        setData(payload as PlayerPreview);
        setLoadedSteamId(requestSteamId);
      } catch {
        if (!cancelled) {
          setError("Failed to load player preview.");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open, steamId, loadedSteamId]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const label = (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition ${
        steamId
          ? "cursor-pointer hover:bg-slate-800/80 hover:text-sky-200"
          : "cursor-default"
      } ${isCaptain ? "text-amber-200 font-semibold" : ""}`}
    >
      {isCaptain && (
        <span className="inline-flex items-center justify-center rounded-full border border-amber-400/30 bg-amber-500/10 p-1 text-amber-300">
          <CrownIcon />
        </span>
      )}
      <span>{name}</span>
    </span>
  );

  if (!steamId) return label;

  const faceitLevelLabel =
    data?.faceit.level && data.faceit.level >= 1
      ? String(Math.min(10, data.faceit.level))
      : null;

  const summaryCards = [
    data?.stats && {
      label: "Rating",
      value: data.stats.rating ? data.stats.rating.toFixed(2) : "-",
    },
    data?.stats && {
      label: "Last 3 rating",
      value: data.last3Rating ? data.last3Rating.toFixed(2) : "-",
    },
    data?.stats && {
      label: "Matches",
      value: formatNumber(data.stats.matches),
    },
    data?.stats && {
      label: "K / D / A",
      value: `${data.stats.kills} / ${data.stats.deaths} / ${data.stats.assists}`,
    },
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="text-left"
      >
        {label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl shadow-sky-950/50">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-[#0e1627] p-5">
              <div className="flex items-center gap-4">
                {data?.avatarUrl ? (
                  <img
                    src={data.avatarUrl}
                    alt={`${data.profileName} avatar`}
                    className="h-14 w-14 rounded-full border border-slate-700 object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-lg font-semibold text-slate-300">
                    {(data?.profileName ?? name).trim().charAt(0).toUpperCase() ||
                      "?"}
                  </div>
                )}
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-sky-200">
                    Player preview
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-50">
                    {data?.profileName ?? name}
                  </h2>
                  {data?.faceit.nickname && (
                    <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                      Faceit:{" "}
                      {data.faceit.faceitUrl ? (
                        <a
                          href={data.faceit.faceitUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-200 hover:underline"
                        >
                          {data.faceit.nickname}
                        </a>
                      ) : (
                        data.faceit.nickname
                      )}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="max-h-[80vh] overflow-y-auto p-5 text-slate-50">
              {loading && !data && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-300">
                  Loading player preview...
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-rose-900/60 bg-rose-950/40 p-4 text-sm text-rose-100">
                  {error}
                </div>
              )}

              {data && (
                <div className="space-y-5">
                  {data.matchError && (
                    <div className="rounded-2xl border border-amber-900/60 bg-amber-950/30 p-4 text-sm text-amber-100">
                      {data.matchError}
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {summaryCards.map((item) => (
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
                    ))}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-md shadow-sky-900/10">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Performance
                      </p>
                      <div className="mt-4 grid gap-3 text-sm text-slate-200">
                        {data.stats && (
                          <>
                            <div className="flex items-center justify-between">
                              <span>ADR</span>
                              <span className="font-semibold">
                                {data.stats.adr.toFixed(1)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>K/D</span>
                              <span className="font-semibold">
                                {data.stats.kd.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>HS%</span>
                              <span className="font-semibold">
                                {data.stats.hs.toFixed(0)}%
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Rounds</span>
                              <span className="font-semibold">
                                {formatNumber(data.stats.rounds)}
                              </span>
                            </div>
                          </>
                        )}
                        <div className="flex items-center justify-between">
                          <span>Recent form</span>
                          <span className="font-semibold">
                            {data.form.winRatio !== null
                              ? `${data.form.winRatio}%`
                              : "-"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>W / L</span>
                          <span className="font-semibold">
                            {data.form.wins} / {data.form.losses}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-md shadow-sky-900/10">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Context
                      </p>
                      <div className="mt-4 space-y-4">
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                            Faceit
                          </div>
                          <div className="mt-2 flex items-center gap-3 text-lg font-semibold text-slate-100">
                            {faceitLevelLabel && (
                              <img
                                src={`/faceit/level-${faceitLevelLabel}.png`}
                                alt={`Faceit level ${faceitLevelLabel}`}
                                className="h-6 w-6"
                              />
                            )}
                            <span>
                              {data.faceit.elo !== null
                                ? formatNumber(data.faceit.elo)
                                : data.faceit.level !== null
                                  ? `Level ${data.faceit.level}`
                                  : "-"}
                            </span>
                          </div>
                        </div>

                        {data.favoriteMap && (
                          <div>
                            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                              Favorite map
                            </div>
                            <div className="mt-2 text-sm text-slate-200">
                              <div className="font-semibold text-slate-100">
                                {data.favoriteMap.mapName}
                              </div>
                              <div className="mt-1 text-slate-400">
                                {data.favoriteMap.matches} matches,{" "}
                                {Math.round(
                                  (data.favoriteMap.wins /
                                    Math.max(1, data.favoriteMap.matches)) *
                                    100
                                )}
                                % win rate
                              </div>
                            </div>
                          </div>
                        )}

                        {data.playstyleTags.length > 0 && (
                          <div>
                            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                              Playstyle
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {data.playstyleTags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full border border-slate-700 bg-slate-950/50 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-200"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {data.faceitError && (
                    <div className="rounded-2xl border border-amber-900/60 bg-amber-950/30 p-4 text-xs text-amber-100">
                      Faceit: {data.faceitError}
                    </div>
                  )}

                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-md shadow-sky-900/10">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                          Recent matches
                        </p>
                        <h3 className="mt-1 text-lg font-semibold">
                          Last 5 matches
                        </h3>
                      </div>
                      <Link
                        href={`/profile/${data.steamId}`}
                        className="text-sm text-sky-300 underline"
                        onClick={() => setOpen(false)}
                      >
                        Open full profile
                      </Link>
                    </div>

                    {data.recentMatches.length === 0 ? (
                      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-400">
                        No recent matches available.
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
                              <th className="px-3 py-2 text-right">Rating</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {data.recentMatches.map((match) => {
                              const resultTone =
                                match.result === "-"
                                  ? "border-slate-700 text-slate-300"
                                  : match.result === "W"
                                    ? "border-emerald-500/60 text-emerald-300"
                                    : "border-rose-500/60 text-rose-300";

                              return (
                                <tr key={match.matchId}>
                                  <td className="px-3 py-2">
                                    <Link
                                      href={`/matches/${match.matchId}`}
                                      className="text-sky-200 hover:underline"
                                    >
                                      #{match.matchId}
                                    </Link>
                                  </td>
                                  <td className="px-3 py-2 text-slate-200">
                                    {match.mapName}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span
                                      className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${resultTone}`}
                                    >
                                      {match.result}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-slate-200">
                                    {match.score}
                                  </td>
                                  <td className="px-3 py-2 text-slate-200">
                                    {match.kills} / {match.deaths} /{" "}
                                    {match.assists}
                                  </td>
                                  <td className="px-3 py-2 text-right text-slate-200">
                                    {match.rating
                                      ? match.rating.toFixed(2)
                                      : "-"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <a
                      href={data.steamProfileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
                    >
                      Steam profile
                    </a>
                    {data.faceit.faceitUrl && (
                      <a
                        href={data.faceit.faceitUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
                      >
                        Faceit profile
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
