"use client";

import { Button } from "@/app/components/ui/Button";

export function KickButton({
  scrimCode,
  targetUserId,
}: {
  scrimCode: string;
  targetUserId: string;
}) {
  async function kick() {
    const ok = window.confirm("Kick this player from the scrim?");
    if (!ok) return;

    await fetch(`/api/scrims/${scrimCode}/kick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId }),
    });
    window.location.reload();
  }

  return (
    <Button
      onClick={kick}
      variant="outline"
      className="border-red-500/40 text-red-200 hover:bg-red-500/10 active:scale-[0.98]"
    >
      Kick
    </Button>
  );
}

