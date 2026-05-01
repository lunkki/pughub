"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/app/components/ui/Button";
import type { ReadyCheckStatus } from "@/lib/veto";

const READY_CHECK_DURATION_SECONDS = 30;
const STORAGE_PREFIX = "pughub:ready-check-start:";

type Props = {
  scrimCode: string;
  isCreator: boolean;
  canStartScrim: boolean;
  readyCheckActive: boolean;
  readyCheckStartedAt: string | null;
  readyCheckEndsAt: string | null;
  hasNotReadyPlayers: boolean;
  canRespond: boolean;
  myReadyCheckStatus: ReadyCheckStatus | null;
};

export function ReadyCheckPanel({
  scrimCode,
  isCreator,
  canStartScrim,
  readyCheckActive,
  readyCheckStartedAt,
  readyCheckEndsAt,
  hasNotReadyPlayers,
  canRespond,
  myReadyCheckStatus,
}: Props) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expiryTriggeredRef = useRef(false);
  const isExpired = timeLeft === 0;

  useEffect(() => {
    if (!readyCheckActive || !readyCheckEndsAt) {
      setTimeLeft(null);
      return;
    }

    const update = () => {
      const diff = new Date(readyCheckEndsAt).getTime() - Date.now();
      setTimeLeft(diff > 0 ? Math.ceil(diff / 1000) : 0);
    };

    update();
    const timer = window.setInterval(update, 500);
    return () => window.clearInterval(timer);
  }, [readyCheckActive, readyCheckEndsAt]);

  useEffect(() => {
    if (!readyCheckActive || !readyCheckStartedAt) return;

    const storageKey = `${STORAGE_PREFIX}${scrimCode}`;
    const lastPlayed = window.sessionStorage.getItem(storageKey);
    if (lastPlayed === readyCheckStartedAt) return;

    window.sessionStorage.setItem(storageKey, readyCheckStartedAt);

    const audio = new Audio("/audio/alert.mp3");
    audio.volume = 1;
    void audio.play().catch(() => {
      // Autoplay may be blocked until the user has interacted with the page.
    });
  }, [readyCheckActive, readyCheckStartedAt, scrimCode]);

  useEffect(() => {
    if (!readyCheckActive || !isExpired || expiryTriggeredRef.current) return;

    expiryTriggeredRef.current = true;

    const expireReadyCheck = async () => {
      try {
        await fetch(`/api/scrims/${scrimCode}/ready-check/expire`, {
          method: "POST",
        });
      } finally {
        window.location.reload();
      }
    };

    void expireReadyCheck();
  }, [isExpired, readyCheckActive, scrimCode]);

  if (!readyCheckActive && !isCreator) return null;

  async function startReadyCheck() {
    if (!isCreator || !canStartScrim || busy) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/scrims/${scrimCode}/ready-check/start`, {
        method: "POST",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to start ready check");
        return;
      }

      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  async function setReadyCheckStatus(status: ReadyCheckStatus) {
    if (!canRespond || !readyCheckActive || busy || isExpired) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/scrims/${scrimCode}/ready-check/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to update ready status");
        return;
      }

      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-md shadow-sky-900/10">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Ready check</h2>
          <p className="mt-1 text-xs text-slate-400">
            Give players 30 seconds to mark themselves ready before you start the veto.
          </p>
        </div>

        {!readyCheckActive ? (
          isCreator ? (
            <Button
              type="button"
              onClick={startReadyCheck}
              disabled={!canStartScrim || busy}
              className="bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-[0.98]"
            >
              {busy
                ? "Starting..."
                : hasNotReadyPlayers
                  ? `Restart ready check (${READY_CHECK_DURATION_SECONDS}s)`
                  : `Start ready check (${READY_CHECK_DURATION_SECONDS}s)`}
            </Button>
          ) : null
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                isExpired
                  ? "border-slate-700 bg-slate-950/60 text-slate-300"
                  : "border-amber-400/40 bg-amber-500/15 text-amber-100"
              }`}
            >
              {isExpired ? "Ready check expired" : "Ready check active"}
            </span>
            {timeLeft !== null && (
              <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 font-mono text-xs text-slate-200">
                {timeLeft}s left
              </span>
            )}
          </div>
        )}
      </div>

      {readyCheckActive ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {canRespond && !isExpired ? (
            <>
              <Button
                type="button"
                onClick={() => setReadyCheckStatus("READY")}
                disabled={busy}
                className={`active:scale-[0.98] ${
                  myReadyCheckStatus === "READY"
                    ? "bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                    : "bg-emerald-600 text-emerald-50 hover:bg-emerald-500"
                }`}
              >
                Ready
              </Button>
              <Button
                type="button"
                onClick={() => setReadyCheckStatus("NOT_READY")}
                disabled={busy}
                variant="outline"
                className={`active:scale-[0.98] ${
                  myReadyCheckStatus === "NOT_READY"
                    ? "border-rose-400/70 bg-rose-500/10 text-rose-100"
                    : "border-rose-500/40 text-rose-200 hover:bg-rose-500/10"
                }`}
              >
                Not ready
              </Button>
            </>
          ) : isExpired ? (
            <p className="text-sm text-slate-400">
              The ready-check timer expired. The manager can start the scrim when everyone is done.
            </p>
          ) : (
            <p className="text-sm text-slate-400">
              Wait for the current player to respond.
            </p>
          )}

          {myReadyCheckStatus && (
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                myReadyCheckStatus === "READY"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-200"
              }`}
            >
              You are {myReadyCheckStatus === "READY" ? "ready" : "not ready"}
            </span>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-400">
          No ready check is active right now.
        </p>
      )}

      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
    </div>
  );
}
