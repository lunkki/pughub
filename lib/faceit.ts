import "server-only";

type FaceitGameStats = {
  faceit_elo?: number;
  skill_level?: number;
};

export type FaceitPlayer = {
  player_id: string;
  nickname: string;
  faceit_url?: string;
  games?: {
    cs2?: FaceitGameStats;
    csgo?: FaceitGameStats;
  };
};

export async function fetchFaceitPlayerBySteamId(steamId64: string) {
  const apiKey = process.env.FACEIT_APIKEY;
  if (!apiKey) return null;

  const url = new URL("https://open.faceit.com/data/v4/players");
  url.searchParams.set("game", "cs2");
  url.searchParams.set("game_player_id", steamId64);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    next: { revalidate: 3600 },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Faceit request failed (${res.status})`);
  }

  const data = (await res.json()) as FaceitPlayer;
  return data;
}
