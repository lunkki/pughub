"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/Button";

type Role = "PLAYER" | "MANAGER" | "ADMIN";

type UserRow = {
  id: string;
  displayName: string;
  steamId: string;
  role: Role;
  avatarUrl: string | null;
};

const roleOptions: Role[] = ["PLAYER", "MANAGER", "ADMIN"];

export function RoleManagerClient({
  initialUsers,
  currentUserId,
}: {
  initialUsers: UserRow[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateRoleDraft = (userId: string, role: Role) => {
    setUsers((prev) =>
      prev.map((user) => (user.id === userId ? { ...user, role } : user))
    );
  };

  const saveRole = async (userId: string) => {
    const user = users.find((entry) => entry.id === userId);
    if (!user) return;

    setSaving((prev) => ({ ...prev, [userId]: true }));
    setErrors((prev) => ({ ...prev, [userId]: "" }));

    try {
      const res = await fetch("/api/admin/roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: user.role }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors((prev) => ({
          ...prev,
          [userId]: data.error ?? "Failed to update role",
        }));
      }
    } catch (err: any) {
      setErrors((prev) => ({
        ...prev,
        [userId]: err?.message ?? "Network error",
      }));
    } finally {
      setSaving((prev) => ({ ...prev, [userId]: false }));
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-950/60 text-xs uppercase tracking-[0.2em] text-slate-400">
          <tr>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Steam ID</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {users.map((user) => {
            const isSelf = user.id === currentUserId;
            const error = errors[user.id];
            return (
              <tr key={user.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={`${user.displayName} avatar`}
                        className="h-8 w-8 rounded-full border border-slate-700 object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-300">
                        {user.displayName.trim().charAt(0).toUpperCase() || "?"}
                      </div>
                    )}
                    <div className="font-medium text-slate-100">
                      {user.displayName}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-300">{user.steamId}</td>
                <td className="px-4 py-3">
                  <select
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/60 p-2 text-sm text-slate-50 focus:border-sky-400 focus:outline-none disabled:opacity-50"
                    value={user.role}
                    onChange={(e) => updateRoleDraft(user.id, e.target.value as Role)}
                    disabled={isSelf}
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  {isSelf && (
                    <p className="mt-1 text-xs text-slate-500">
                      You cannot change your own role.
                    </p>
                  )}
                  {error && (
                    <p className="mt-1 text-xs text-red-300">{error}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Button
                    variant="outline"
                    onClick={() => saveRole(user.id)}
                    disabled={saving[user.id] || isSelf}
                    className="border-slate-700 text-slate-200 hover:bg-slate-800"
                  >
                    {saving[user.id] ? "Saving..." : "Save"}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
