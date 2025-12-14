"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { MAPS, ACTIVE_DUTY } from "@/lib/maps";
import { Button } from "@/app/components/ui/Button";

export function MapPoolSelector({
  scrimCode,
  initialMapPool,
  canEdit
}: {
  scrimCode: string;
  initialMapPool: string[] | null;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pool, setPool] = useState<string[]>(initialMapPool ?? []);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Keep local state in sync with server updates (router.refresh preserves client state)
    // Don't clobber edits while the editor dropdown is open.
    if (canEdit && open) return;
    setPool(initialMapPool ?? []);
  }, [initialMapPool, canEdit, open]);

  // Save to server
  async function savePool(updated: string[]) {
    await fetch(`/api/scrims/${scrimCode}/mapPool`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mapPool: updated }),
    });
  }

  // Toggle membership
  function toggleMap(id: string) {
    if (!canEdit) return;
    setPool((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  // Helper selects
  function selectAll() {
    if (!canEdit) return;
    setPool(MAPS.map((m) => m.id));
  }

  function selectActiveDuty() {
    if (!canEdit) return;
    setPool(ACTIVE_DUTY.map((m) => m.id));
  }

  function clearAll() {
    if (!canEdit) return;
    setPool([]);
  }

  // Close (and save if editable)
  function closeDropdown() {
    setOpen(false);
    if (canEdit) {
      savePool(pool);
    }
  }

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        if (open) closeDropdown();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, pool]);

  const selectedCount = pool.length;
  const displayedMaps = useMemo(() => {
    return [...MAPS].sort((a, b) => {
      const aSelected = pool.includes(a.id);
      const bSelected = pool.includes(b.id);
      if (aSelected !== bSelected) return aSelected ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [pool]);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Map pool</h2>
          <p className="mt-1 text-xs text-slate-400">
            Selected: <span className="font-semibold text-sky-200">{selectedCount}</span>
          </p>
        </div>
        <Button
          onClick={() => setOpen((v) => !v)}
          variant="outline"
          className="border-slate-700 text-slate-200 hover:bg-slate-800 active:scale-[0.98]"
        >
          {open ? "Close" : canEdit ? "Edit" : "View maps"}
        </Button>
      </div>

      {open && (
        <div className="ph-animate-in absolute z-50 mt-4 max-h-[520px] w-full overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/90 p-4 shadow-2xl shadow-sky-900/30 backdrop-blur">
          {canEdit ? (
            <div className="mb-4 flex flex-wrap gap-2">
              <Button
                onClick={selectActiveDuty}
                variant="outline"
                className="border-slate-700 text-slate-200 hover:bg-slate-800 active:scale-[0.98]"
              >
                Active duty
              </Button>

              <Button
                onClick={selectAll}
                variant="outline"
                className="border-slate-700 text-slate-200 hover:bg-slate-800 active:scale-[0.98]"
              >
                Select all
              </Button>

              <Button
                onClick={clearAll}
                variant="outline"
                className="border-slate-700 text-slate-200 hover:bg-slate-800 active:scale-[0.98]"
              >
                Clear
              </Button>

              <Button
                onClick={closeDropdown}
                className="ml-auto bg-emerald-600 text-emerald-50 hover:bg-emerald-500 active:scale-[0.98]"
              >
                Done
              </Button>
            </div>
          ) : (
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-400">
                View-only. Selected maps are highlighted in green.
              </p>
              <Button
                onClick={closeDropdown}
                variant="outline"
                className="border-slate-700 text-slate-200 hover:bg-slate-800 active:scale-[0.98]"
              >
                Close
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {displayedMaps.map((m) => {
              const isSelected = pool.includes(m.id);

              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMap(m.id)}
                  disabled={!canEdit}
                  className={`group relative overflow-hidden rounded-lg border text-left transition-transform duration-150 ease-out ${
                    canEdit ? "active:scale-[0.99]" : "cursor-default"
                  } ${
                    isSelected
                      ? "border-emerald-500 bg-slate-900/60 ring-1 ring-emerald-500/30"
                      : canEdit
                        ? "border-slate-800 bg-slate-900/30 hover:border-sky-500/50 hover:bg-slate-900/50"
                        : "border-slate-800 bg-slate-900/30 opacity-50"
                  }`}
                >
                  <img
                    src={m.image}
                    alt={m.name}
                    className={`h-24 w-full object-cover transition duration-200 ${
                      isSelected ? "opacity-100" : "opacity-70 group-hover:opacity-100"
                    }`}
                  />
                  <div className="bg-slate-950/70 p-2 text-center text-sm text-slate-200">
                    {m.name}
                  </div>
                  {isSelected && (
                    <div className="ph-animate-in absolute left-2 top-2 rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-emerald-50 shadow">
                      Selected
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
