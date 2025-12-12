// app/scrims/[code]/MapVetoClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MAPS } from "@/lib/maps";
import type { TeamSide, VetoState } from "@/lib/veto";

type Props = {
  scrimCode: string;
  mapPool: string[];
  state: VetoState | null;
  myTeam?: TeamSide | null;
  vetoMode?: "CAPTAINS" | "PLAYERS";
};

export function MapVetoClient({
  scrimCode,
  mapPool,
  state,
  myTeam = null,
  vetoMode = "CAPTAINS",
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
    <div className="border border-slate-700 rounded-lg p-4 bg-[color:var(--panel-bg)] mt-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold">Map veto</h2>
          <p className="text-xs text-slate-400 mt-1">
            Phase: <span className="font-mono">{state?.phase ?? "NOT_STARTED"}</span>
            {state?.turn && state.phase === "IN_PROGRESS" && (
              <>
                {" - Turn: "}
                <span className="font-mono">{state.turn}</span>
              </>
            )}
            {state?.finalMap && (
              <>
                {" - Final: "}
                <span className="font-mono text-emerald-400">{state.finalMap}</span>
              </>
            )}
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

      {/* Map grid with veto overlays */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
          const canBan =
            !banInfo &&
            inPool &&
            state?.phase === "IN_PROGRESS" &&
            isMyTurn &&
            !busy;

          return (
            <div
              key={mapId}
              className={`relative rounded-lg overflow-hidden border ${
                isFinal
                  ? "border-emerald-500"
                  : banInfo
                    ? "border-slate-800"
                    : "border-slate-700"
              }`}
            >
              <button
                type="button"
                onClick={() => canBan && banMap(mapId)}
                disabled={!canBan}
                className={`block text-left w-full h-full ${
                  canBan ? "hover:opacity-90" : ""
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
                    <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">
                      {mapId}
                    </div>
                  )}
                </div>
                <div className="p-2 text-center text-sm bg-slate-900">
                  {mapMeta?.name ?? mapId}
                </div>
              </button>

              {/* Overlay */}
              {banInfo && (
                <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center text-xs font-semibold text-slate-200">
                  {banInfo.by} BAN
                </div>
              )}
              {isFinal && !banInfo && (
                <div className="absolute top-2 left-2 px-2 py-1 rounded bg-emerald-600 text-[11px] font-semibold text-emerald-50 shadow">
                  Final map
                </div>
              )}
              {!banInfo && !isFinal && !inPool && vetoStarted && (
                <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center text-xs font-semibold text-slate-200">
                  REMOVED
                </div>
              )}
              {canBan && (
                <div className="absolute top-2 right-2 px-2 py-1 rounded bg-emerald-600 text-[11px] font-semibold text-emerald-50 shadow">
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
