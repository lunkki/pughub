"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/app/components/ui/Button";

export default function ScrimNewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createScrim() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/scrims/create", {
        method: "POST",
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.code) {
        router.push(`/scrims/${data.code}`);
        return;
      }

      setError(data.error ?? "Failed to create scrim");
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full space-y-6 py-10 text-slate-50">
      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-[#0e1627] p-8 shadow-2xl shadow-sky-900/30 md:p-10">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.25em] text-sky-200">
            New scrim
          </p>
          <h1 className="text-3xl font-semibold">Create a lobby</h1>
          <p className="text-sm text-slate-300">
            We’ll generate a code you can share with players.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            onClick={createScrim}
            disabled={loading}
            className="bg-gradient-to-r from-sky-400 to-cyan-500 text-slate-950 hover:from-sky-300 hover:to-cyan-400 active:scale-[0.98]"
          >
            {loading ? "Creating..." : "Create scrim"}
          </Button>

          <Button
            asChild
            variant="outline"
            className="border-slate-700 text-slate-200 hover:bg-slate-800 active:scale-[0.98]"
          >
            <Link href="/">Back</Link>
          </Button>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-300">
            {error}
          </p>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          { title: "Create", body: "One click to make the lobby." },
          { title: "Share", body: "Send the code to players." },
          { title: "Start", body: "Pick teams, veto maps, connect." },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-md shadow-sky-900/10"
          >
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              {item.title}
            </div>
            <div className="mt-2 text-sm text-slate-200">{item.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
