type SteamProfile = {
  steamId: string;
  name: string;
  avatar: string;
};

const STEAM_FETCH_TIMEOUT_MS = 3000;

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getSteamProfiles(steamIds: string[]) {
  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) return [];

  const uniqueIds = Array.from(
    new Set(
      steamIds
        .map((id) => id.trim())
        .filter((id) => /^\d{17}$/.test(id))
    )
  );
  if (uniqueIds.length === 0) return [];

  const profiles: SteamProfile[] = [];
  const chunks = chunkArray(uniqueIds, 100);

  for (const chunk of chunks) {
    const url =
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?` +
      `key=${apiKey}&steamids=${chunk.join(",")}`;

    try {
      const res = await fetchWithTimeout(url, STEAM_FETCH_TIMEOUT_MS);
      if (!res.ok) continue;
      const data = await res.json();
      const players = data.response?.players ?? [];

      for (const player of players) {
        if (!player?.steamid) continue;
        profiles.push({
          steamId: player.steamid,
          name: player.personaname ?? "",
          avatar: player.avatarfull ?? "",
        });
      }
    } catch {
      // Ignore Steam API failures and fall back to cached values.
    }
  }

  return profiles;
}

export async function getSteamProfile(steamId: string) {
  const profiles = await getSteamProfiles([steamId]);
  return profiles[0] ?? null;
}
