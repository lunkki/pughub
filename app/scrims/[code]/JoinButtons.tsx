"use client";

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
    <div className="flex gap-3">
      <button
        onClick={() => join("TEAM1")}
        className="px-3 py-1 rounded bg-sky-600 hover:bg-sky-700"
      >
        Join Team 1
      </button>

      <button
        onClick={() => join("TEAM2")}
        className="px-3 py-1 rounded bg-sky-600 hover:bg-sky-700"
      >
        Join Team 2
      </button>

      <button
        onClick={() => join("WAITING_ROOM")}
        className="px-3 py-1 rounded bg-slate-600 hover:bg-slate-500"
      >
        Move to Waiting Room
      </button>
    </div>
  );
}
