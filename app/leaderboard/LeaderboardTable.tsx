"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type LeaderboardRow = {
  steamId64: string;
  displayName: string;
  avatarUrl: string | null;
  matches: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  headshotKills: number;
  rating: number | null;
};

type SortKey =
  | "player"
  | "matches"
  | "wins"
  | "losses"
  | "winRate"
  | "kills"
  | "deaths"
  | "assists"
  | "kd"
  | "hs"
  | "rating";

type SortDir = "asc" | "desc";

type DerivedRow = LeaderboardRow & {
  winRate: number | null;
  kd: number;
  hs: number | null;
};

const sortDefaults: Record<SortKey, SortDir> = {
  player: "asc",
  matches: "desc",
  wins: "desc",
  losses: "desc",
  winRate: "desc",
  kills: "desc",
  deaths: "desc",
  assists: "desc",
  kd: "desc",
  hs: "desc",
  rating: "desc",
};

const columns: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "player", label: "Player" },
  { key: "matches", label: "Matches", align: "right" },
  { key: "wins", label: "W", align: "right" },
  { key: "losses", label: "L", align: "right" },
  { key: "winRate", label: "Win%", align: "right" },
  { key: "kills", label: "K", align: "right" },
  { key: "deaths", label: "D", align: "right" },
  { key: "assists", label: "A", align: "right" },
  { key: "kd", label: "K/D", align: "right" },
  { key: "hs", label: "HS%", align: "right" },
  { key: "rating", label: "Rating", align: "right" },
];

function normalizeNumber(value: number | null, direction: SortDir) {
  if (value === null || Number.isNaN(value)) {
    return direction === "desc" ? -Infinity : Infinity;
  }
  return value;
}

function getSortValue(row: DerivedRow, key: SortKey) {
  switch (key) {
    case "player":
      return row.displayName.toLowerCase();
    case "matches":
      return row.matches;
    case "wins":
      return row.wins;
    case "losses":
      return row.losses;
    case "winRate":
      return row.winRate;
    case "kills":
      return row.kills;
    case "deaths":
      return row.deaths;
    case "assists":
      return row.assists;
    case "kd":
      return row.kd;
    case "hs":
      return row.hs;
    case "rating":
      return row.rating;
    default:
      return null;
  }
}

export function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("rating");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sortedRows = useMemo(() => {
    const derived = rows.map<DerivedRow>((row) => {
      const decided = row.wins + row.losses;
      const winRate = decided ? row.wins / decided : null;
      const kd = row.deaths === 0 ? row.kills : row.kills / row.deaths;
      const hs = row.kills ? row.headshotKills / row.kills : null;
      return { ...row, winRate, kd, hs };
    });

    const direction = sortDir === "asc" ? 1 : -1;
    return derived
      .slice()
      .sort((a, b) => {
        const aValue = getSortValue(a, sortKey);
        const bValue = getSortValue(b, sortKey);

        if (typeof aValue === "string" && typeof bValue === "string") {
          return direction * aValue.localeCompare(bValue);
        }

        const aNumber = normalizeNumber(
          typeof aValue === "number" ? aValue : null,
          sortDir
        );
        const bNumber = normalizeNumber(
          typeof bValue === "number" ? bValue : null,
          sortDir
        );
        if (bNumber === aNumber) return 0;
        return direction * (aNumber - bNumber);
      });
  }, [rows, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(sortDefaults[key]);
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-slate-950/60 text-[11px] uppercase tracking-[0.2em] text-slate-400">
          <tr>
            <th className="px-4 py-3 text-slate-500">#</th>
            {columns.map((column) => {
              const isActive = sortKey === column.key;
              const dirLabel = isActive ? (sortDir === "asc" ? "asc" : "desc") : "";
              return (
                <th
                  key={column.key}
                  className={`px-4 py-3 ${column.align === "right" ? "text-right" : "text-left"}`}
                  aria-sort={
                    isActive
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    onClick={() => handleSort(column.key)}
                    className={`inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] ${
                      isActive ? "text-sky-200" : "text-slate-400"
                    } hover:text-slate-200 ${
                      column.align === "right" ? "justify-end w-full" : "justify-start"
                    }`}
                  >
                    <span>{column.label}</span>
                    {dirLabel ? (
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                          sortDir === "asc"
                            ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-200"
                            : "border-amber-500/40 bg-amber-500/20 text-amber-200"
                        }`}
                        aria-hidden="true"
                      >
                        <svg
                          viewBox="0 0 20 20"
                          className="h-3 w-3"
                          fill="currentColor"
                        >
                          {sortDir === "asc" ? (
                            <path d="M10 6l4 6H6l4-6z" />
                          ) : (
                            <path d="M10 14l-4-6h8l-4 6z" />
                          )}
                        </svg>
                      </span>
                    ) : null}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {sortedRows.map((player, index) => {
            const winRateLabel =
              player.winRate === null
                ? "-"
                : `${(player.winRate * 100).toFixed(0)}%`;
            const kdLabel = player.kd.toFixed(2);
            const hsLabel = player.hs !== null ? `${(player.hs * 100).toFixed(0)}%` : "-";
            const ratingLabel =
              player.rating !== null ? player.rating.toFixed(2) : "-";
            const initial =
              player.displayName.trim().charAt(0).toUpperCase() || "?";

            return (
              <tr key={player.steamId64}>
                <td className="px-4 py-3 text-slate-400">{index + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/profile/${player.steamId64}`}
                      className="flex items-center gap-3 hover:text-sky-200"
                    >
                      {player.avatarUrl ? (
                        <img
                          src={player.avatarUrl}
                          alt={`${player.displayName} avatar`}
                          className="h-8 w-8 rounded-full border border-slate-700 object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-300">
                          {initial}
                        </div>
                      )}
                      <div className="font-medium text-slate-100">
                        {player.displayName}
                      </div>
                    </Link>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-slate-200">
                  {player.matches}
                </td>
                <td className="px-4 py-3 text-right text-slate-200">
                  {player.wins}
                </td>
                <td className="px-4 py-3 text-right text-slate-200">
                  {player.losses}
                </td>
                <td className="px-4 py-3 text-right text-slate-200">
                  {winRateLabel}
                </td>
                <td className="px-4 py-3 text-right text-slate-200">
                  {player.kills}
                </td>
                <td className="px-4 py-3 text-right text-slate-200">
                  {player.deaths}
                </td>
                <td className="px-4 py-3 text-right text-slate-200">
                  {player.assists}
                </td>
                <td className="px-4 py-3 text-right text-slate-200">
                  {kdLabel}
                </td>
                <td className="px-4 py-3 text-right text-slate-200">
                  {hsLabel}
                </td>
                <td className="px-4 py-3 text-right text-slate-200">
                  {ratingLabel}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
