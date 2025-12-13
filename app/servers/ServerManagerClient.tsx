// app/servers/ServerManagerClient.tsx
"use client";

import { useState } from "react";

type Server = {
  id: string;
  name: string;
  address: string;
  rconPassword: string;
  isActive: boolean;
};

type Props = {
  initialServers: Server[];
};

export function ServerManagerClient({ initialServers }: Props) {
  const [servers, setServers] = useState<Server[]>(initialServers);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    address: "",
    rconPassword: "",
    isActive: true,
  });

  async function createServer() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to create server");
        return;
      }
      setServers((prev) => [...prev, data.server]);
      setForm({ name: "", address: "", rconPassword: "", isActive: true });
    } catch (err: any) {
      setError(err?.message ?? "Failed to create server");
    } finally {
      setCreating(false);
    }
  }

  async function updateServer(id: string, patch: Partial<Server>) {
    setError(null);
    try {
      const res = await fetch(`/api/servers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to update server");
        return;
      }
      setServers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...data.server } : s))
      );
    } catch (err: any) {
      setError(err?.message ?? "Failed to update server");
    }
  }

  async function deleteServer(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/servers/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to delete server");
        return;
      }
      setServers((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      setError(err?.message ?? "Failed to delete server");
    }
  }

  return (
    <div className="space-y-6">
      <div className="border border-slate-700 rounded-lg p-4 bg-[color:var(--panel-bg)]">
        <h2 className="text-lg font-semibold mb-3">Add server</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="px-3 py-2 rounded bg-slate-900 border border-slate-700"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="px-3 py-2 rounded bg-slate-900 border border-slate-700"
            placeholder="Address (host:port)"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <input
            className="px-3 py-2 rounded bg-slate-900 border border-slate-700"
            placeholder="RCON password"
            value={form.rconPassword}
            onChange={(e) => setForm({ ...form, rconPassword: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active
          </label>
        </div>
        <button
          onClick={createServer}
          disabled={creating}
          className="mt-3 px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-sm"
        >
          {creating ? "Creating..." : "Create server"}
        </button>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>

      <div className="border border-slate-700 rounded-lg p-4 bg-[color:var(--panel-bg)]">
        <h2 className="text-lg font-semibold mb-3">Existing servers</h2>
        {servers.length === 0 && (
          <p className="text-sm text-slate-400">No servers yet.</p>
        )}
        <div className="space-y-4">
          {servers.map((server) => (
            <div
              key={server.id}
              className="rounded-lg border border-slate-700 p-3 bg-slate-900/60"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  className="px-3 py-2 rounded bg-slate-900 border border-slate-700"
                  value={server.name}
                  onChange={(e) =>
                    setServers((prev) =>
                      prev.map((s) =>
                        s.id === server.id ? { ...s, name: e.target.value } : s
                      )
                    )
                  }
                  onBlur={(e) =>
                    updateServer(server.id, { name: e.target.value })
                  }
                />
                <input
                  className="px-3 py-2 rounded bg-slate-900 border border-slate-700"
                  value={server.address}
                  onChange={(e) =>
                    setServers((prev) =>
                      prev.map((s) =>
                        s.id === server.id
                          ? { ...s, address: e.target.value }
                          : s
                      )
                    )
                  }
                  onBlur={(e) =>
                    updateServer(server.id, { address: e.target.value })
                  }
                />
                <input
                  className="px-3 py-2 rounded bg-slate-900 border border-slate-700"
                  value={server.rconPassword}
                  onChange={(e) =>
                    setServers((prev) =>
                      prev.map((s) =>
                        s.id === server.id
                          ? { ...s, rconPassword: e.target.value }
                          : s
                      )
                    )
                  }
                  onBlur={(e) =>
                    updateServer(server.id, { rconPassword: e.target.value })
                  }
                />
                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={server.isActive}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setServers((prev) =>
                        prev.map((s) =>
                          s.id === server.id ? { ...s, isActive: checked } : s
                        )
                      );
                      updateServer(server.id, { isActive: checked });
                    }}
                  />
                  Active
                </label>
              </div>
              <div className="mt-2 flex gap-3 text-xs text-slate-400">
                <span>id: {server.id}</span>
                <button
                  className="text-red-400 hover:text-red-300"
                  onClick={() => deleteServer(server.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
