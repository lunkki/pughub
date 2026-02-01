import "server-only";
import { prisma } from "@/lib/db";
import { fetchFaceitPlayerBySteamId } from "@/lib/faceit";

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24;

export type FaceitProfileCacheEntry = {
  steamId: string;
  nickname: string | null;
  elo: number | null;
  level: number | null;
  faceitUrl: string | null;
  updatedAt: Date;
};

function getGameStats(player: NonNullable<Awaited<ReturnType<typeof fetchFaceitPlayerBySteamId>>>) {
  const game = player.games?.cs2 ?? player.games?.csgo ?? null;
  return {
    elo: game?.faceit_elo ?? null,
    level: game?.skill_level ?? null,
  };
}

export async function getFaceitProfileCache(
  steamIds: string[],
  maxAgeMs = DEFAULT_TTL_MS
) {
  const uniqueIds = Array.from(
    new Set(steamIds.map((id) => id.trim()).filter(Boolean))
  );
  if (uniqueIds.length === 0) return new Map<string, FaceitProfileCacheEntry>();

  const cachedRows = await prisma.faceitProfile.findMany({
    where: { steamId: { in: uniqueIds } },
  });

  const cache = new Map<string, FaceitProfileCacheEntry>();
  for (const row of cachedRows) {
    cache.set(row.steamId, {
      steamId: row.steamId,
      nickname: row.nickname ?? null,
      elo: row.elo ?? null,
      level: row.level ?? null,
      faceitUrl: row.faceitUrl ?? null,
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

  if (!process.env.FACEIT_APIKEY || staleIds.length === 0) return cache;

  const results = await Promise.all(
    staleIds.map(async (steamId) => {
      try {
        const player = await fetchFaceitPlayerBySteamId(steamId);
        return { steamId, player };
      } catch (err) {
        return { steamId, error: err };
      }
    })
  );

  const refreshedAt = new Date();
  const updates = results.map((entry) => {
    if ("error" in entry) {
      return null;
    }

    if (!entry.player) {
      return prisma.faceitProfile.upsert({
        where: { steamId: entry.steamId },
        update: {
          nickname: null,
          elo: null,
          level: null,
          faceitUrl: null,
        },
        create: {
          steamId: entry.steamId,
          nickname: null,
          elo: null,
          level: null,
          faceitUrl: null,
        },
      });
    }

    const stats = getGameStats(entry.player);
    return prisma.faceitProfile.upsert({
      where: { steamId: entry.steamId },
      update: {
        nickname: entry.player.nickname ?? null,
        elo: stats.elo,
        level: stats.level,
        faceitUrl: entry.player.faceit_url ?? null,
      },
      create: {
        steamId: entry.steamId,
        nickname: entry.player.nickname ?? null,
        elo: stats.elo,
        level: stats.level,
        faceitUrl: entry.player.faceit_url ?? null,
      },
    });
  });

  const writes = updates.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  if (writes.length > 0) {
    await prisma.$transaction(writes);
  }

  for (const entry of results) {
    if ("error" in entry) continue;
    const player = entry.player;
    if (!player) {
      cache.set(entry.steamId, {
        steamId: entry.steamId,
        nickname: null,
        elo: null,
        level: null,
        faceitUrl: null,
        updatedAt: refreshedAt,
      });
      continue;
    }
    const stats = getGameStats(player);
    cache.set(entry.steamId, {
      steamId: entry.steamId,
      nickname: player.nickname ?? null,
      elo: stats.elo,
      level: stats.level,
      faceitUrl: player.faceit_url ?? null,
      updatedAt: refreshedAt,
    });
  }

  return cache;
}
