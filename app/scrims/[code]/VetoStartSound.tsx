"use client";

import { useEffect } from "react";
import type { VetoState } from "@/lib/veto";

const STORAGE_PREFIX = "pughub:veto-start-sound:";

export function VetoStartSound({
  scrimCode,
  vetoState,
}: {
  scrimCode: string;
  vetoState: VetoState;
}) {
  useEffect(() => {
    if (vetoState.phase !== "IN_PROGRESS" || !vetoState.startedAt) return;

    const storageKey = `${STORAGE_PREFIX}${scrimCode}`;
    const lastPlayed = window.sessionStorage.getItem(storageKey);
    if (lastPlayed === vetoState.startedAt) return;

    window.sessionStorage.setItem(storageKey, vetoState.startedAt);

    const audio = new Audio("/audio/veto.mp3");
    audio.volume = 1;
    void audio.play().catch(() => {
      // Autoplay can be blocked until the user has interacted with the page.
    });
  }, [scrimCode, vetoState.phase, vetoState.startedAt]);

  return null;
}
