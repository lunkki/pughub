"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 8000;

export function SseListener({ code }: { code: string }) {
  const router = useRouter();
  const retries = useRef(0);

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      es?.close();
      es = new EventSource(`/api/scrims/${code}/events`);

      const resetBackoff = () => {
        retries.current = 0;
      };

      es.addEventListener("update", () => {
        resetBackoff();
        router.refresh();
      });

      es.addEventListener("ping", resetBackoff);

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

    return () => {
      es?.close();
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [code, router]);

  return null;
}
