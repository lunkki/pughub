"use client";

import { useState } from "react";

export function StartVetoButton({
  code,
  disabled,
}: {
  code: string;
  disabled: boolean;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (disabled || loading) return;
    setLoading(true);
    const res = await fetch(`/api/scrims/${code}/start`, { method: "POST" });
    setLoading(false);
    if (res.ok) {
      location.reload(); // simple for now, we can websocket later
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className={`px-4 py-2 rounded-md text-sm font-semibold ${
        disabled
          ? "bg-emerald-700/40 text-emerald-200/40 cursor-not-allowed"
          : "bg-emerald-600 hover:bg-emerald-500 text-emerald-50"
      }`}
    >
      {loading ? "Starting..." : "Start match (begin veto)"}
    </button>
  );
}
