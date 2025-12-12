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
    <div className="border border-slate-700 bg-slate-900/40 p-4 rounded-md">
      <h3 className="text-lg font-semibold mb-3">Scrim Management</h3>

      {/* VETO MODE SELECT */}
      <div className="mb-2">
        <label className="block text-sm mb-1">Veto Mode:</label>
        <select
          className="bg-slate-800 p-2 rounded border border-slate-600"
          value={mode}
          onChange={(e) => changeMode(e.target.value)}
          disabled={locked}
        >
          <option value="CAPTAIN">Captain Veto</option>
          <option value="PLAYERS">Players Vote</option>
        </select>
      </div>

      <p className="text-xs text-slate-500">
        Start the match from the Scrim management panel above.
      </p>
    </div>
  );
}
