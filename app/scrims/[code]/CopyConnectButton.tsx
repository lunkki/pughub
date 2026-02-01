"use client";

import { useState } from "react";

export function CopyConnectButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="border-l border-cyan-600/70 bg-cyan-950/40 px-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-cyan-100 transition hover:bg-cyan-900/50 hover:text-cyan-50 active:scale-[0.98]"
      aria-label="Copy server connect string"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
