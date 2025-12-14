"use client";

import { useState } from "react";

type ScrimCreatorControlsProps = {
  scrim: {
    code: string;
    vetoMode: string;
    status: string;
  };
};

export function ScrimCreatorControls({ scrim }: ScrimCreatorControlsProps) {
  const [mode, setMode] = useState(scrim.vetoMode);
  const locked = scrim.status !== "LOBBY";

  async function changeMode(newMode: string) {
    setMode(newMode);
    await fetch(`/api/scrims/${scrim.code}/vetoMode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vetoMode: newMode }),
    });
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-md shadow-sky-900/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Veto settings</h3>
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
          <option value="PLAYERS" disabled>
            Players Vote (work in progress)
          </option>
        </select>
      </div>
    </div>
  );
}
