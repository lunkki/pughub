"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 8000;
const STALE_AFTER_MS = 30_000;
const FALLBACK_REFRESH_MS = 15_000;

export function SseListener({ code }: { code: string }) {
  const router = useRouter();
  const retries = useRef(0);
  const lastEventAt = useRef(Date.now());

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let staleInterval: ReturnType<typeof setInterval> | null = null;

    const connect = () => {
      es?.close();
      es = new EventSource(`/api/scrims/${code}/events`);

      const resetBackoff = () => {
        retries.current = 0;
      };

      const touch = () => {
        lastEventAt.current = Date.now();
      };

      es.onopen = () => {
        resetBackoff();
        touch();
      };

      es.addEventListener("update", () => {
        resetBackoff();
        touch();
        router.refresh();
      });

      es.addEventListener("ping", () => {
        resetBackoff();
        touch();
      });

      // Initial "message" event (data: connected) lands here; treat as healthy.
      es.addEventListener("message", () => {
        resetBackoff();
        touch();
      });

      es.onerror = () => {
        es?.close();
        const delay = Math.min(
          RECONNECT_BASE_MS * 2 ** retries.current,
          RECONNECT_MAX_MS
        );
        retries.current += 1;
        retryTimeout = setTimeout(connect, delay);
      };
    };

    connect();

    // Some networks/proxies buffer or break long-lived streams.
    // If we haven't received any SSE events recently, force a refresh (and reconnect).
    staleInterval = setInterval(() => {
      const staleFor = Date.now() - lastEventAt.current;
      if (staleFor < STALE_AFTER_MS) return;
      es?.close();
      connect();
      router.refresh();
      lastEventAt.current = Date.now();
    }, FALLBACK_REFRESH_MS);

    return () => {
      es?.close();
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (staleInterval) {
        clearInterval(staleInterval);
      }
    };
  }, [code, router]);

  return null;
}
