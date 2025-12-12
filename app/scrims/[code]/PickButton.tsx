"use client";

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
    <button
      onClick={pick}
      className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-black"
    >
      Pick
    </button>
  );
}
