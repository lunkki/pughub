import type { SessionUser } from "./auth";

export function getAdminSteamIds(): string[] {
  return (
    process.env.SCRIM_ADMIN_STEAM_IDS?.split(",")
      .map((id) => id.trim())
      .filter(Boolean) ?? []
  );
}

export function isAdminSteamId(steamId: string): boolean {
  return getAdminSteamIds().includes(steamId);
}

export function getScrimStartSteamIds(): string[] {
  return (
    process.env.SCRIM_START_STEAM_IDS?.split(",")
      .map((id) => id.trim())
      .filter(Boolean) ?? []
  );
}

export function isAdminUser(user: SessionUser | null): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return isAdminSteamId(user.steamId);
}

export function canStartScrim(user: SessionUser | null): boolean {
  if (!user) return false;
  if (user.role === "MANAGER" || isAdminUser(user)) return true;
  const allowed = getScrimStartSteamIds();
  if (allowed.length === 0) return true;
  return allowed.includes(user.steamId);
}

export function canManageServers(user: SessionUser | null): boolean {
  return isAdminUser(user);
}

export function canManageRoles(user: SessionUser | null): boolean {
  return isAdminUser(user);
}

export function canManageLobbyPlayers(user: SessionUser | null): boolean {
  if (!user) return false;
  return user.role === "MANAGER" || isAdminUser(user);
}
