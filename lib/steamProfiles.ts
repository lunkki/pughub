import "server-only";
import { prisma } from "@/lib/db";
import { getSteamProfiles } from "@/lib/steam";

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24;

type SteamProfileCacheEntry = {
  steamId: string;
  displayName: string;
  avatarUrl: string | null;
  updatedAt: Date;
};

export async function getSteamProfileCache(
  steamIds: string[],
  maxAgeMs = DEFAULT_TTL_MS
) {
  const uniqueIds = Array.from(
    new Set(steamIds.map((id) => id.trim()).filter(Boolean))
  );
  if (uniqueIds.length === 0) return new Map<string, SteamProfileCacheEntry>();

  const cachedRows = await prisma.steamProfile.findMany({
    where: { steamId: { in: uniqueIds } },
  });

  const cache = new Map<string, SteamProfileCacheEntry>();
  for (const row of cachedRows) {
    cache.set(row.steamId, {
      steamId: row.steamId,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      updatedAt: row.updatedAt,
    });
  }

  const ttl = Math.max(0, maxAgeMs);
  const now = Date.now();
  const staleIds = uniqueIds.filter((id) => {
    const entry = cache.get(id);
    if (!entry) return true;
    return now - entry.updatedAt.getTime() > ttl;
  });

  if (!process.env.STEAM_API_KEY || staleIds.length === 0) return cache;

  const freshProfiles = await getSteamProfiles(staleIds);
  if (freshProfiles.length === 0) return cache;

  await prisma.$transaction(
    freshProfiles.map((profile) =>
      prisma.steamProfile.upsert({
        where: { steamId: profile.steamId },
        update: {
          displayName: profile.name || "",
          avatarUrl: profile.avatar || null,
        },
        create: {
          steamId: profile.steamId,
          displayName: profile.name || "",
          avatarUrl: profile.avatar || null,
        },
      })
    )
  );

  const refreshedAt = new Date();
  for (const profile of freshProfiles) {
    cache.set(profile.steamId, {
      steamId: profile.steamId,
      displayName: profile.name || "",
      avatarUrl: profile.avatar || null,
      updatedAt: refreshedAt,
    });
  }

  return cache;
}
