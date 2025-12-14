"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/Button";

export function TeamMoveButton({
  scrimCode,
  team,
  disabled,
  children,
  variant = "outline",
  className,
}: {
  scrimCode: string;
  team: "TEAM1" | "TEAM2" | "WAITING_ROOM";
  disabled?: boolean;
  children: React.ReactNode;
  variant?: "default" | "outline";
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function move() {
    if (disabled || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/scrims/${scrimCode}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "Failed to change team");
        return;
      }

      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      onClick={move}
      disabled={disabled || busy}
      variant={variant}
      className={className}
    >
      {busy ? "..." : children}
    </Button>
  );
}

