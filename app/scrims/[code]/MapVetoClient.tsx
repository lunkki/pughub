// app/scrims/[code]/MapVetoClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MAPS } from "@/lib/maps";
import { getVetoVoteLimit, type TeamSide, type VetoState } from "@/lib/veto";

type Props = {
  scrimCode: string;
  mapPool: string[];
  state: VetoState | null;
  myTeam?: TeamSide | null;
  vetoMode?: "CAPTAINS" | "PLAYERS";
  currentUserId?: string;
  players?: {
    id: string;
    team: TeamSide | "WAITING_ROOM";
    user: { id: string; avatarUrl?: string | null; displayName: string };
  }[];
};

export function MapVetoClient({
  scrimCode,
  mapPool,
  state,
  myTeam = null,
  vetoMode = "CAPTAINS",
  currentUserId,
  players = [],
}: Props) {
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!state?.deadline) {
      setTimeLeft(null);
      return;
    }

    const update = () => {
      const diff = new Date(state.deadline!).getTime() - Date.now();
      setTimeLeft(diff > 0 ? Math.ceil(diff / 1000) : 0);
    };

    update();
    const id = setInterval(update, 500);
    return () => clearInterval(id);
  }, [state?.deadline]);

  const isMyTurn =
    !!myTeam && state?.turn === myTeam && state?.phase === "IN_PROGRESS";

  const orderedMaps = useMemo(() => {
    if (mapPool.length > 0) return mapPool;
    if (!state) return [];
    const bannedMaps = state.banned.map((b) => b.map);
    return Array.from(new Set([...state.pool, ...bannedMaps]));
  }, [mapPool, state]);

  const teamPlayers = useMemo(
    () => players.filter((p) => p.team === myTeam),
    [players, myTeam]
  );
  const voteLimit = state ? getVetoVoteLimit(state) : 1;
  const currentTurn = state?.banned.length ?? 0;
  const voteSelections: Record<string, string[]> =
    state?.pendingVotes &&
    state.pendingVotes.team === myTeam &&
    state.pendingVotes.turn === currentTurn
      ? state.pendingVotes.selections
      : {};
  const mySelections = currentUserId ? voteSelections[currentUserId] ?? [] : [];

  async function banMap(map: string) {
    if (!state || !isMyTurn || busy || state.phase !== "IN_PROGRESS") return;

    try {
      setBusy(true);
      const res = await fetch(`/api/scrims/${scrimCode}/veto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "BAN", map }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to ban map");
      } else {
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Map veto</h2>
          <p className="mt-1 text-xs text-slate-400">
            {state?.phase === "IN_PROGRESS" && state.turn
              ? `Turn: ${state.turn}`
              : state?.phase === "DONE"
                ? "Veto complete"
                : "Waiting to start"}
          </p>
        </div>
        {state?.phase === "IN_PROGRESS" && (
          <div className="text-xs text-slate-300">
            {isMyTurn ? (
              <>
                Your team is banning{vetoMode === "CAPTAINS" && " (captain)"}
                {timeLeft !== null && (
                  <> · <span className="font-mono">{timeLeft}s</span> left</>
                )}
              </>
            ) : (
              <>
                Waiting for <span className="font-semibold">{state.turn ?? "other team"}</span>
              </>
            )}
          </div>
        )}
        {!state || state.phase === "NOT_STARTED" ? (
          <div className="text-xs text-slate-500">
            Scrim creator can start the ABBA veto. Teams ban until 2 remain, then pick.
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {orderedMaps.map((mapId) => {
          const mapMeta = MAPS.find((m) => m.id === mapId);
          const vetoStarted = !!state && state.phase !== "NOT_STARTED";
          const banInfo = state?.banned.find((b) => b.map === mapId);
          const isFinal = state?.finalMap === mapId;
          const inPool = !vetoStarted
            ? true
            : isFinal
              ? true
              : state?.pool.includes(mapId) ?? false;
          const isSelected =
            vetoMode === "PLAYERS" && mySelections.includes(mapId);
          const canBan =
            !banInfo &&
            inPool &&
            state?.phase === "IN_PROGRESS" &&
            isMyTurn &&
            !busy &&
            (vetoMode !== "PLAYERS" || isSelected || mySelections.length < voteLimit);
          const mapVotes =
            vetoMode === "PLAYERS"
              ? teamPlayers.filter(
                  (p) => voteSelections && voteSelections[p.user.id]?.includes(mapId)
                )
              : [];

          return (
            <div
              key={mapId}
              className={`relative overflow-hidden rounded-lg border bg-slate-900/60 transition-transform duration-150 ease-out ${
                isFinal
                  ? "border-emerald-500"
                  : banInfo
                    ? "border-slate-800"
                    : "border-slate-700"
              } ${isSelected ? "ring-2 ring-amber-400/80" : ""} ${
                canBan ? "hover:scale-[1.01]" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => canBan && banMap(mapId)}
                disabled={!canBan}
                className={`block h-full w-full text-left transition-opacity ${
                  canBan ? "hover:opacity-90 active:scale-[0.995]" : "opacity-90"
                }`}
              >
                <div className="h-24 bg-slate-800">
                  {mapMeta ? (
                    <img
                      src={mapMeta.image}
                      alt={mapMeta.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                      {mapId}
                    </div>
                  )}
                </div>
                <div className="bg-slate-950/70 p-2 text-center text-sm">
                  {mapMeta?.name ?? mapId}
                </div>
              </button>

              {banInfo && (
                <div className="ph-animate-in absolute inset-0 flex items-center justify-center bg-slate-950/80 text-xs font-semibold text-slate-200">
                  {banInfo.by} BAN
                </div>
              )}
              {isFinal && !banInfo && (
                <div className="ph-animate-in absolute top-2 left-2 rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-emerald-50 shadow">
                  Final map
                </div>
              )}
              {!banInfo && !isFinal && !inPool && vetoStarted && (
                <div className="ph-animate-in absolute inset-0 flex items-center justify-center bg-slate-950/70 text-xs font-semibold text-slate-200">
                  REMOVED
                </div>
              )}
              {mapVotes.length > 0 && (
                <div className="ph-animate-in absolute top-2 left-2 flex -space-x-2">
                  {mapVotes.slice(0, 4).map((p) => (
                    <img
                      key={p.id}
                      src={p.user.avatarUrl ?? ""}
                      alt={p.user.displayName}
                      title={`${p.user.displayName} voted`}
                      className="h-7 w-7 rounded-full border border-slate-800 bg-slate-800 object-cover"
                    />
                  ))}
                  {mapVotes.length > 4 && (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-[10px] text-slate-200">
                      +{mapVotes.length - 4}
                    </div>
                  )}
                </div>
              )}
              {canBan && (
                <div className="ph-animate-in absolute top-2 right-2 rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-emerald-50 shadow">
                  Ban
                </div>
              )}
            </div>
          );
        })}
        {orderedMaps.length === 0 && (
          <div className="text-sm text-slate-400">No maps selected.</div>
        )}
      </div>
    </div>
  );
}
