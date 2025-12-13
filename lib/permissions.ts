export function getScrimStartSteamIds(): string[] {
  return (
    process.env.SCRIM_START_STEAM_IDS?.split(",")
      .map((id) => id.trim())
      .filter(Boolean) ?? []
  );
}

export function isScrimStarter(steamId: string): boolean {
  const allowed = getScrimStartSteamIds();
  if (allowed.length === 0) return true;
  return allowed.includes(steamId);
}
