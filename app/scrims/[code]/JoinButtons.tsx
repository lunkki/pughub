"use client";

import { Button } from "@/app/components/ui/Button";

export function JoinButtons({
  code,
  canChangeTeams,
}: {
  code: string;
  canChangeTeams: boolean;
}) {
  async function join(team: string | null) {
    await fetch(`/api/scrims/${code}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team }),
    });

    window.location.reload();
  }

  if (!canChangeTeams) return null; // totally hide when locked

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        onClick={() => join("TEAM1")}
        className="bg-sky-600 hover:bg-sky-500 active:scale-[0.98]"
      >
        Join Team 1
      </Button>

      <Button
        onClick={() => join("TEAM2")}
        className="bg-sky-600 hover:bg-sky-500 active:scale-[0.98]"
      >
        Join Team 2
      </Button>

      <Button
        onClick={() => join("WAITING_ROOM")}
        variant="outline"
        className="border-slate-700 text-slate-200 hover:bg-slate-800 active:scale-[0.98]"
      >
        Move to Waiting Room
      </Button>
    </div>
  );
}
