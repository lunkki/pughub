"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { MAPS, ACTIVE_DUTY, type MapInfo } from "@/lib/maps";
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
  const poolRef = useRef<string[]>(initialMapPool ?? []);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const activeDutySet = useMemo(() => new Set(ACTIVE_DUTY.map((m) => m.id)), []);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Keep local state in sync with server updates (router.refresh preserves client state)
    // Don't clobber edits while the editor dropdown is open.
    if (canEdit && open) return;
    const next = initialMapPool ?? [];
    poolRef.current = next;
    setPool(next);
  }, [initialMapPool, canEdit, open]);

  // Save to server
  async function savePool(updated: string[]) {
    try {
      await fetch(`/api/scrims/${scrimCode}/mapPool`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapPool: updated }),
      });
    } catch (err) {
      console.error("Failed to save map pool", err);
    }
  }

  // Toggle membership
  function toggleMap(id: string) {
    if (!canEdit) return;
    setPool((prev) => {
      const next = prev.includes(id)
        ? prev.filter((m) => m !== id)
        : [...prev, id];
      poolRef.current = next;
      return next;
    });
  }

  // Helper selects
  function selectAll() {
    if (!canEdit) return;
    const next = MAPS.map((m) => m.id);
    poolRef.current = next;
    setPool(next);
  }

  function selectActiveDuty() {
    if (!canEdit) return;
    const next = ACTIVE_DUTY.map((m) => m.id);
    poolRef.current = next;
    setPool(next);
  }

  function clearAll() {
    if (!canEdit) return;
    poolRef.current = [];
    setPool([]);
  }

  // Close (and save if editable)
  function closeDropdown() {
    setOpen(false);
    if (canEdit) {
      savePool(poolRef.current);
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
  }, [open]);

  const selectedCount = pool.length;

  const sections = useMemo(() => {
    const isHostage = (m: MapInfo) => m.id.startsWith("cs_");
    const isDefuse = (m: MapInfo) => m.id.startsWith("de_");

    const activeDuty = MAPS.filter((m) => activeDutySet.has(m.id));
    const stockDefuse = MAPS.filter(
      (m) => m.type === "stock" && isDefuse(m) && !activeDutySet.has(m.id)
    );
    const stockHostage = MAPS.filter((m) => m.type === "stock" && isHostage(m));

    const workshopDefuse = MAPS.filter(
      (m) => m.type === "workshop" && isDefuse(m)
    );
    const workshopHostage = MAPS.filter(
      (m) => m.type === "workshop" && isHostage(m)
    );

    const included = new Set<string>([
      ...activeDuty.map((m) => m.id),
      ...stockDefuse.map((m) => m.id),
      ...stockHostage.map((m) => m.id),
      ...workshopDefuse.map((m) => m.id),
      ...workshopHostage.map((m) => m.id),
    ]);

    const other = MAPS.filter((m) => !included.has(m.id));

    return [
      { title: "Active Duty", maps: activeDuty },
      { title: "Stock (Defuse)", maps: stockDefuse },
      { title: "Stock (Hostage)", maps: stockHostage },
      { title: "Workshop (Defuse)", maps: workshopDefuse },
      { title: "Workshop (Hostage)", maps: workshopHostage },
      ...(other.length ? [{ title: "Other", maps: other }] : []),
    ].filter((s) => s.maps.length > 0);
  }, [activeDutySet]);

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
          onClick={() => {
            if (open) {
              closeDropdown();
            } else {
              setOpen(true);
            }
          }}
          variant="outline"
          className="border-slate-700 text-slate-200 hover:bg-slate-800 active:scale-[0.98]"
        >
          {open ? "Close" : canEdit ? "Edit" : "View maps"}
        </Button>
      </div>

      {mounted && open
        ? createPortal(
            <MapPoolModal
              canEdit={canEdit}
              onClose={closeDropdown}
              onSelectActiveDuty={selectActiveDuty}
              onSelectAll={selectAll}
              onClearAll={clearAll}
              onDone={closeDropdown}
              sections={sections}
              pool={pool}
              onToggleMap={toggleMap}
            />,
            document.body
          )
        : null}
    </div>
  );
}

function MapPoolModal({
  canEdit,
  onClose,
  onSelectActiveDuty,
  onSelectAll,
  onClearAll,
  onDone,
  sections,
  pool,
  onToggleMap,
}: {
  canEdit: boolean;
  onClose: () => void;
  onSelectActiveDuty: () => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onDone: () => void;
  sections: { title: string; maps: MapInfo[] }[];
  pool: string[];
  onToggleMap: (id: string) => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 p-2 backdrop-blur-sm md:items-center md:p-6"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="ph-animate-in w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/90 shadow-2xl shadow-sky-900/40"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-3 border-b border-slate-800 bg-slate-900/60 p-4 md:flex-row md:items-center md:justify-between md:p-5">
          <div>
            <div className="text-sm font-semibold text-slate-100">Map pool</div>
            <div className="mt-1 text-xs text-slate-400">
              {canEdit
                ? "Select maps for this scrim."
                : "View-only. Selected maps are highlighted in green."}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            {canEdit ? (
              <>
                <Button
                  onClick={onSelectActiveDuty}
                  variant="outline"
                  className="border-slate-700 text-slate-200 hover:bg-slate-800 active:scale-[0.98]"
                >
                  Active duty
                </Button>
                <Button
                  onClick={onSelectAll}
                  variant="outline"
                  className="border-slate-700 text-slate-200 hover:bg-slate-800 active:scale-[0.98]"
                >
                  Select all
                </Button>
                <Button
                  onClick={onClearAll}
                  variant="outline"
                  className="border-slate-700 text-slate-200 hover:bg-slate-800 active:scale-[0.98]"
                >
                  Clear
                </Button>
                <Button
                  onClick={onDone}
                  className="bg-emerald-600 text-emerald-50 hover:bg-emerald-500 active:scale-[0.98]"
                >
                  Done
                </Button>
              </>
            ) : (
              <Button
                onClick={onClose}
                variant="outline"
                className="border-slate-700 text-slate-200 hover:bg-slate-800 active:scale-[0.98]"
              >
                Close
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-[80vh] overflow-y-auto p-4 md:p-5">
          <div className="space-y-6">
            {sections.map((section) => (
              <div key={section.title}>
                <div className="mb-3 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-2">
                  <div className="text-sm font-semibold text-slate-100">
                    {section.title}
                  </div>
                  <div className="rounded-full border border-slate-700 px-3 py-0.5 text-[11px] text-slate-300">
                    {section.maps.length}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {section.maps.map((m) => {
                    const isSelected = pool.includes(m.id);

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onToggleMap(m.id)}
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
                          className={`h-32 w-full object-cover transition duration-200 md:h-36 ${
                            isSelected
                              ? "opacity-100"
                              : "opacity-70 group-hover:opacity-100"
                          }`}
                        />
                        <div className="bg-slate-950/70 p-2 text-center">
                          <div className="text-sm font-semibold text-slate-100">
                            {m.name}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-400">
                            {m.id}
                          </div>
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
