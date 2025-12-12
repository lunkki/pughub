"use client";

import { useEffect } from "react";

export default function AutoRefresh() {
  useEffect(() => {
    const interval = setInterval(() => {
      window.location.reload();
    }, 2000); // refresh every 2 seconds

    return () => clearInterval(interval);
  }, []);

  return null;
}
