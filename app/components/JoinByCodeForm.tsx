"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui/Button";
import { cn } from "@/lib/utils";

export function JoinByCodeForm({ className }: { className?: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    router.push(`/scrims/${trimmed}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-sky-500/5 backdrop-blur",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <label
            htmlFor="scrim-code"
            className="text-xs uppercase tracking-[0.2em] text-sky-300"
          >
            Join by code
          </label>
          <p className="mt-1 text-sm text-slate-300">
            Drop into a lobby instantly. No invites, no friction.
          </p>
        </div>
        <span className="rounded-full border border-slate-700 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-300">
          Live
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
        <input
          id="scrim-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. dusk-fox"
          className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 text-base text-slate-50 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
        />
        <Button
          type="submit"
          className="w-full whitespace-nowrap bg-gradient-to-r from-sky-400 to-cyan-500 text-slate-900 hover:from-sky-300 hover:to-cyan-400 md:w-auto"
        >
          Go to lobby
        </Button>
      </div>
    </form>
  );
}
