"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/app/components/ui/Button";

export function PlaceholderPlayerForm({
  scrimCode,
}: {
  scrimCode: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setError(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  async function addPlaceholder() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/scrims/${scrimCode}/placeholder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to add placeholder");
        return;
      }

      setName("");
      window.location.reload();
    } catch (err: any) {
      setError(err?.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
        variant="outline"
        className="mt-4 border-slate-700 text-slate-200 hover:bg-slate-800 active:scale-[0.98]"
      >
        Add placeholder player
      </Button>

      {mounted && open
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 p-3 md:items-center md:p-6"
              onMouseDown={() => {
                setOpen(false);
                setError(null);
              }}
              role="dialog"
              aria-modal="true"
            >
              <div
                className="ph-animate-in w-full max-w-lg overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/90 shadow-2xl shadow-sky-900/40"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="border-b border-slate-800 bg-slate-900/60 p-4">
                  <div className="text-sm font-semibold text-slate-100">
                    Add placeholder player
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Placeholder players can be drafted into teams by captains.
                  </div>
                </div>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    addPlaceholder();
                  }}
                  className="space-y-3 p-4"
                >
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Player name"
                    autoFocus
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none"
                  />
                  {error && <p className="text-xs text-red-300">{error}</p>}
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setOpen(false);
                        setError(null);
                      }}
                      className="border-slate-700 text-slate-200 hover:bg-slate-800"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={loading}
                      variant="outline"
                      className="border-emerald-500/60 text-emerald-100 hover:bg-emerald-500/10 active:scale-[0.98]"
                    >
                      {loading ? "Adding..." : "Add"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
