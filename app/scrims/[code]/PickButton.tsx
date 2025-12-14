"use client";

import { Button } from "@/app/components/ui/Button";

export function PickButton({
  scrimCode,
  targetUserId
}: {
  scrimCode: string;
  targetUserId: string;
}) {
  async function pick() {
    await fetch(`/api/scrims/${scrimCode}/pick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId }),
    });
    window.location.reload();
  }

  return (
    <Button
      onClick={pick}
      className="bg-amber-400 text-slate-950 hover:bg-amber-300 active:scale-[0.98]"
    >
      Pick
    </Button>
  );
}
