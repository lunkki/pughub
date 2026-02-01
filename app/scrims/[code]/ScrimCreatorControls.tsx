"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ScrimCreatorControlsProps = {
  scrim: {
    code: string;
    vetoMode: string;
    pickPhase: string;
    pickPhaseStarted: boolean;
    status: string;
    serverId: string;
  };
  servers: {
    id: string;
    name: string;
    address: string;
    isActive: boolean;
  }[];
  canManageServers: boolean;
  embedded?: boolean;
};

export function ScrimCreatorControls({
  scrim,
  servers,
  canManageServers,
  embedded = false,
}: ScrimCreatorControlsProps) {
  const router = useRouter();
  const [mode, setMode] = useState(scrim.vetoMode);
  const [pickPhase, setPickPhase] = useState(scrim.pickPhase);
  const [serverId, setServerId] = useState(scrim.serverId);
  const [pickPhaseStarted, setPickPhaseStarted] = useState(
    scrim.pickPhaseStarted
  );
  const [error, setError] = useState<string | null>(null);
  const [teamBusy, setTeamBusy] = useState<"SCRAMBLE" | "RANDOM" | null>(null);
  const locked = scrim.status !== "LOBBY";

  async function changeMode(newMode: string) {
    setError(null);
    setMode(newMode);
    await fetch(`/api/scrims/${scrim.code}/vetoMode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vetoMode: newMode }),
    });
    router.refresh();
  }

  async function changePickPhase(newPhase: string) {
    setError(null);
    setPickPhase(newPhase);
    setPickPhaseStarted(false);
    await fetch(`/api/scrims/${scrim.code}/pickPhase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pickPhase: newPhase }),
    });
    router.refresh();
  }

  async function changeServer(newServerId: string) {
    setError(null);
    setServerId(newServerId);

    const res = await fetch(`/api/scrims/${scrim.code}/server`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serverId: newServerId }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to change server");
      return;
    }

    router.refresh();
  }

  return (
    <div className={embedded ? "" : "rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-md shadow-sky-900/10"}>
      {!embedded ? (
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Scrim settings</h3>
            <p className="mt-1 text-xs text-slate-400">
              Locked once the lobby moves past setup.
            </p>
          </div>
          {locked && (
            <span className="rounded-full border border-slate-700 px-3 py-1 text-[11px] uppercase tracking-[0.15em] text-slate-300">
              Locked
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-100">Settings</div>
          {locked && (
            <span className="rounded-full border border-slate-700 px-3 py-0.5 text-[11px] uppercase tracking-[0.15em] text-slate-300">
              Locked
            </span>
          )}
        </div>
      )}

      {/* SERVER SELECT */}
      <div className="mt-4">
        <label className="block text-sm text-slate-200 mb-2">Server</label>
        <select
          className="w-full rounded-lg border border-slate-700 bg-slate-950/60 p-2 text-sm text-slate-50 focus:border-sky-400 focus:outline-none disabled:opacity-50"
          value={serverId}
          onChange={(e) => changeServer(e.target.value)}
          disabled={locked || !canManageServers}
        >
          {servers.map((s) => (
            <option key={s.id} value={s.id} disabled={!s.isActive}>
              {s.name} ({s.address}){s.isActive ? "" : " [inactive]"}
            </option>
          ))}
        </select>
        {!canManageServers && (
          <p className="mt-2 text-xs text-slate-500">
            Only admins can change servers.
          </p>
        )}
      </div>

      {/* VETO MODE SELECT */}
      <div className="mt-4">
        <label className="block text-sm text-slate-200 mb-2">Veto mode</label>
        <select
          className="w-full rounded-lg border border-slate-700 bg-slate-950/60 p-2 text-sm text-slate-50 focus:border-sky-400 focus:outline-none disabled:opacity-50"
          value={mode}
          onChange={(e) => changeMode(e.target.value)}
          disabled={locked}
        >
          <option value="CAPTAINS">Captain Veto</option>
          <option value="PLAYERS">Players Vote</option>
        </select>
      </div>

      {/* PICK PHASE SELECT */}
      <div className="mt-4">
        <label className="block text-sm text-slate-200 mb-2">
          Pick phase config
        </label>
        <select
          className="w-full rounded-lg border border-slate-700 bg-slate-950/60 p-2 text-sm text-slate-50 focus:border-sky-400 focus:outline-none disabled:opacity-50"
          value={pickPhase}
          onChange={(e) => changePickPhase(e.target.value)}
          disabled={locked}
        >
          <option value="CAPTAIN_FREEPICK">Captain freepick</option>
          <option value="PHASED_PICK">Phased pick (1-2-1)</option>
          <option value="SCRAMBLE">Scramble (balanced)</option>
          <option value="RANDOM">Random</option>
        </select>
        {pickPhase === "PHASED_PICK" && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                setError(null);
                await fetch(`/api/scrims/${scrim.code}/pickPhase/start`, {
                  method: "POST",
                });
                setPickPhaseStarted(true);
                router.refresh();
              }}
              disabled={locked || pickPhaseStarted}
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-emerald-400/60 hover:text-emerald-200 disabled:opacity-50"
            >
              {pickPhaseStarted ? "Phased pick started" : "Start phased pick"}
            </button>
            {!pickPhaseStarted && (
              <span className="text-xs text-slate-400">
                Captains can only pick after you start.
              </span>
            )}
          </div>
        )}
        {(pickPhase === "SCRAMBLE" || pickPhase === "RANDOM") && (
          <div className="mt-3 flex flex-wrap gap-2">
            {pickPhase === "SCRAMBLE" && (
              <button
                type="button"
                onClick={async () => {
                  setError(null);
                  setTeamBusy("SCRAMBLE");
                  await fetch(`/api/scrims/${scrim.code}/teams`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ mode: "SCRAMBLE" }),
                  });
                  setTeamBusy(null);
                  router.refresh();
                }}
                disabled={locked || teamBusy !== null}
                className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-sky-400/60 hover:text-sky-200 disabled:opacity-50"
              >
                {teamBusy === "SCRAMBLE" ? "Scrambling..." : "Scramble teams"}
              </button>
            )}
            {pickPhase === "RANDOM" && (
              <button
                type="button"
                onClick={async () => {
                  setError(null);
                  setTeamBusy("RANDOM");
                  await fetch(`/api/scrims/${scrim.code}/teams`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ mode: "RANDOM" }),
                  });
                  setTeamBusy(null);
                  router.refresh();
                }}
                disabled={locked || teamBusy !== null}
                className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-sky-400/60 hover:text-sky-200 disabled:opacity-50"
              >
                {teamBusy === "RANDOM" ? "Randomizing..." : "Random teams"}
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
    </div>
  );
}
