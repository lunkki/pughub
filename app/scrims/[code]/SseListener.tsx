"use client";

import { useEffect } from "react";

export function SseListener({ code }: { code: string }) {
  useEffect(() => {
    const es = new EventSource(`/api/scrims/${code}/events`);

    es.addEventListener("update", () => {
      // Refresh UI without full page reload
      window.location.reload();
    });

    return () => es.close();
  }, [code]);

  return null;
}
