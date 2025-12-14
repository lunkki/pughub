export async function getSteamProfile(steamId: string) {
  const url =
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?` +
    `key=${process.env.STEAM_API_KEY}&steamids=${steamId}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    const player = data.response.players?.[0];
    if (!player) return null;

    return {
      steamId,
      name: player.personaname,
      avatar: player.avatarfull,
    };
  } catch {
    return null;
  }
}
