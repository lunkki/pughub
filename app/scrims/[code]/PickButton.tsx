"use client";

import { Button } from "@/app/components/ui/Button";

export function PickButton({
  scrimCode,
  targetPlayerId,
  disabled = false,
}: {
  scrimCode: string;
  targetPlayerId: string;
  disabled?: boolean;
}) {
  async function pick() {
    if (disabled) return;
    await fetch(`/api/scrims/${scrimCode}/pick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetPlayerId }),
    });
    window.location.reload();
  }

  return (
    <Button
      onClick={pick}
      disabled={disabled}
      className="bg-amber-400 text-slate-950 hover:bg-amber-300 active:scale-[0.98]"
    >
      Pick
    </Button>
  );
}
