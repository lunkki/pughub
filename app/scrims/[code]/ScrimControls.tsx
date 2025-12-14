"use client";

import { useState } from "react";
import type { VetoState } from "@/lib/veto";

type ScrimControlsProps = {
  scrimCode: string;
  isCreator: boolean;
  vetoState: VetoState;
  mapPoolLength: number;
  selectedMap: string | null;
  serverAddress?: string;
  connectPassword?: string;
  embedded?: boolean;
};

export function ScrimControls({
  scrimCode,
  isCreator,
  vetoState,
  mapPoolLength,
  selectedMap,
  serverAddress,
  connectPassword,
  embedded = false,
}: ScrimControlsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canStartVeto =
    isCreator &&
    vetoState.phase === "NOT_STARTED" &&
    mapPoolLength >= 1;

  async function handleStart() {
    if (!canStartVeto) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/scrims/${scrimCode}/start`, {
        method: "POST",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to start veto");
        return;
      }

      // Simple: refresh once when veto starts so everything is in sync
      window.location.reload();
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  }

  let primaryLabel = "Start match";
  let primaryDisabled = true;
  const finalConnectString =
    serverAddress && connectPassword
      ? `connect ${serverAddress}; password ${connectPassword}`
      : null;

  if (vetoState.phase === "NOT_STARTED") {
    if (mapPoolLength < 1) {
      primaryLabel = "Need at least 1 map selected";
      primaryDisabled = true;
    } else {
      primaryLabel = loading ? "Starting..." : "Start match (begin veto)";
      primaryDisabled = !canStartVeto || loading;
    }
  } else if (vetoState.phase === "IN_PROGRESS") {
    primaryLabel = "Veto in progress";
    primaryDisabled = true;
  } else if (vetoState.phase === "DONE") {
    if (selectedMap) {
      primaryLabel = `Start match on ${selectedMap}`;
      // For now disabled until RCON is wired
      primaryDisabled = true;
    } else {
      primaryLabel = "Veto completed";
      primaryDisabled = true;
    }
  }

  return (
    <div
      className={
        embedded
          ? ""
          : "rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-md shadow-sky-900/10"
      }
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Scrim management</h2>
          <p className="text-xs text-slate-400">
            Start the veto when your map pool is set. Only the creator can launch.
          </p>
          {mapPoolLength < 1 && (
            <p className="text-[11px] text-amber-300">
              Add at least one map to start.
            </p>
          )}
        </div>

        <div className="flex flex-col items-start gap-2">
          <button
            onClick={handleStart}
            disabled={primaryDisabled}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-50 hover:bg-emerald-700 disabled:opacity-40"
          >
            {primaryLabel}
          </button>

          {!isCreator && (
            <p className="text-[11px] text-slate-500">
              Only the scrim creator can start the match / veto.
            </p>
          )}

          {error && (
            <p className="text-[11px] text-red-400">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
