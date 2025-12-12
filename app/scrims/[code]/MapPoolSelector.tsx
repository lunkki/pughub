"use client";

import { useState, useRef, useEffect } from "react";
import { MAPS, ACTIVE_DUTY } from "@/lib/maps";

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

  // Close & save
  function closeDropdown() {
    if (!canEdit) return;
    setOpen(false);
    savePool(pool);
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

  return (
    <div className="relative w-full max-w-xl" ref={dropdownRef}>

      {/* COLLAPSED VIEW */}
      {!open && (
        <div className="bg-slate-800 p-3 rounded border border-slate-600 flex justify-between items-center">
          <div className="text-sm">
            Map Pool:{" "}
            <span className="text-sky-300 font-semibold">{selectedCount}</span>{" "}
            maps selected
          </div>
          <button
            onClick={() => canEdit && setOpen(true)}
            disabled={!canEdit}
            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded disabled:opacity-40"
          >
            {canEdit ? "Edit" : "View only"}
          </button>
        </div>
      )}

      {/* DROPDOWN PANEL */}
      {open && canEdit && (
        <div className="absolute z-50 w-full mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-4 max-h-[500px] overflow-y-auto">

          {/* Summary inside expanded dropdown */}
          <div className="text-sm text-slate-300 mb-3">
            Selected maps:{" "}
            <span className="text-sky-300 font-semibold">{selectedCount}</span>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={selectActiveDuty}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded"
            >
              Active Duty
            </button>

            <button
              onClick={selectAll}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded"
            >
              Select All
            </button>

            <button
              onClick={clearAll}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded"
            >
              Clear
            </button>

            <button
              onClick={closeDropdown}
              className="ml-auto px-3 py-1 bg-green-600 hover:bg-green-500 rounded"
            >
              Done
            </button>
          </div>

          {/* MAP GRID */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {MAPS.map((m) => {
              const isSelected = pool.includes(m.id);

              return (
                <div
                  key={m.id}
                  onClick={() => toggleMap(m.id)}
                  className={`cursor-pointer border rounded overflow-hidden transition
                    ${isSelected ? "border-green-400" : "border-slate-700 opacity-40 hover:opacity-80"}`}
                >
                  <img
                    src={m.image}
                    alt={m.name}
                    className="w-full h-24 object-cover"
                  />
                  <div className="p-2 text-center text-sm">{m.name}</div>
                </div>
              );
            })}
          </div>

        </div>
      )}
    </div>
  );
}
