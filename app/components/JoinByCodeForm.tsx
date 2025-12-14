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
    const trimmed = code.trim().toUpperCase();
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
      <label
        htmlFor="scrim-code"
        className="text-xs uppercase tracking-[0.2em] text-sky-300"
      >
        Join by code
      </label>

      <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
        <input
          id="scrim-code"
          value={code}
          onChange={(e) =>
            setCode(
              e.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "")
            )
          }
          placeholder="e.g. 7QICHR"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
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
