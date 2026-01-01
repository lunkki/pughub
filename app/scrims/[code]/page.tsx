import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { MapPoolSelector } from "./MapPoolSelector";
import { PickButton } from "./PickButton";
import { KickButton } from "./KickButton";
import { TeamMoveButton } from "./TeamMoveButton";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SseListener } from "./SseListener";
import { ScrimCreatorControls } from "./ScrimCreatorControls";
import { MapVetoClient } from "./MapVetoClient";
import { ScrimControls } from "./ScrimControls";
import { PlaceholderPlayerForm } from "./PlaceholderPlayerForm";
import { parseVetoState, TeamSide } from "@/lib/veto";
import { getConnectPassword } from "@/lib/serverControl";
import { canManageLobbyPlayers, canManageServers, canStartScrim } from "@/lib/permissions";
import { fetchRecentPlayerMatchSummaries, hasMatchzyConfig } from "@/lib/matchzy";
import { getRating } from "@/lib/matchStatsFormat";

type RatingMatchSummary = {
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  clutchWins: number;
};

function buildRatingPlayer(steamId64: string, match: RatingMatchSummary) {
  return {
    steamId64,
    team: "",
    name: "",
    kills: match.kills,
    deaths: match.deaths,
    assists: match.assists,
    damage: match.damage,
    enemy5ks: 0,
    enemy4ks: 0,
    enemy3ks: 0,
    enemy2ks: 0,
    utilityCount: 0,
    headshotKills: 0,
    utilityDamage: 0,
    utilitySuccesses: 0,
    utilityEnemies: 0,
    flashCount: 0,
    flashSuccesses: 0,
    healthPointsRemovedTotal: 0,
    healthPointsDealtTotal: 0,
    shotsFiredTotal: 0,
    shotsOnTargetTotal: 0,
    entryCount: 0,
    entryWins: 0,
    clutchCount: 0,
    clutchWins: match.clutchWins,
    v1Count: 0,
    v1Wins: 0,
    v2Count: 0,
    v2Wins: 0,
    equipmentValue: 0,
    moneySaved: 0,
    killReward: 0,
    liveTime: 0,
    cashEarned: 0,
    enemiesFlashed: 0,
  };
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ScrimLobbyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  // 1. Require login
  const user = await getCurrentUser();
  if (!user) {
    const redirectParam = encodeURIComponent(`/scrims/${code}`);
    return (
      <div className="p-10 text-slate-50">
        <h1 className="text-xl font-bold mb-4">
          You must be logged in to view this scrim.
        </h1>
        <Link
          href={`/api/auth/steam?redirect=${redirectParam}`}
          className="underline text-sky-400"
        >
          Sign in with Steam
        </Link>
      </div>
    );
  }

  // 2. Load scrim
  const scrim = await prisma.scrim.findUnique({
    where: { code },
    include: {
      players: { include: { user: true } },
      server: true,
    },
  });

  if (!scrim) {
    return <div className="p-10 text-slate-50">Scrim not found.</div>;
  }

  // 3. Auto-add user to scrim if missing
  const existing = scrim.players.find((p) => p.userId === user.id);

  if (!existing) {
    await prisma.scrimPlayer.create({
      data: {
        scrimId: scrim.id,
        userId: user.id,
        steamId: user.steamId,
        team: "WAITING_ROOM",
        isCaptain: false,
      },
    });

    // Touch updatedAt so lobby SSE picks up the change
    await prisma.scrim.update({
      where: { id: scrim.id },
      data: { updatedAt: new Date() },
    });

    // re-enter lobby so user is included in players
    redirect(`/scrims/${scrim.code}`);
  }

  // 4. Reload scrim with updated players
  const updatedScrim = await prisma.scrim.findUnique({
    where: { code },
    include: {
      players: { include: { user: true } },
      server: true,
    },
  });

  if (!updatedScrim) redirect("/");

  const canChangeTeams = updatedScrim.status === "LOBBY";

  const serverAddress = updatedScrim.server?.address ?? null;
  const connectPassword = getConnectPassword();
  const selectedMap = updatedScrim.selectedMap;
  const finalConnectString =
    serverAddress && connectPassword && selectedMap
      ? `connect ${serverAddress}; password ${connectPassword}`
      : null;

  const playerForUser = updatedScrim.players.find(
    (p) => p.userId === user.id
  );
  const currentUserTeam = playerForUser?.team ?? null;

  // mapPool as string[]
  const mapPool: string[] = updatedScrim.mapPool
    ? (JSON.parse(updatedScrim.mapPool) as string[])
    : [];

  const vetoState = parseVetoState(updatedScrim.vetoState);
  const isCreator = user.id === updatedScrim.creatorId;
  const canStartScrimUser = canStartScrim(user);
  const canManageLobbyPlayersUser = canManageLobbyPlayers(user);
  const canManageServersUser = canManageServers(user);
  const canManageServersForScrim = isCreator && canManageServersUser;
  const statusLabel = updatedScrim.status.replace(/_/g, " ");
  const servers = canManageServersForScrim
    ? await prisma.server.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, address: true, isActive: true },
      })
    : [];

  const team1 = updatedScrim.players.filter((p) => p.team === "TEAM1");
  const team2 = updatedScrim.players.filter((p) => p.team === "TEAM2");
  const waiting = updatedScrim.players.filter(
    (p) => p.team === "WAITING_ROOM"
  );
  const vetoPlayers = updatedScrim.players.filter(
    (
      player
    ): player is typeof player & { user: NonNullable<typeof player.user> } =>
      Boolean(player.user && player.userId)
  );

  // Captain detection
  const captain1UserId = team1.find((p) => p.isCaptain)?.userId;
  const captain2UserId = team2.find((p) => p.isCaptain)?.userId;
  const isCaptain = user.id === captain1UserId || user.id === captain2UserId;

  const averageRatings = new Map<string, number>();
  if (hasMatchzyConfig()) {
    try {
      const steamIds = Array.from(
        new Set(
          updatedScrim.players
            .filter((player) => player.steamId && !player.isPlaceholder)
            .map((player) => player.steamId)
            .filter((steamId): steamId is string => Boolean(steamId))
        )
      );

      if (steamIds.length > 0) {
        const ratingEntries = await Promise.all(
          steamIds.map(async (steamId) => {
            const matches = await fetchRecentPlayerMatchSummaries(steamId, 5);
            const ratings = matches
              .map((match) =>
                getRating(buildRatingPlayer(steamId, match), match.rounds)
              )
              .filter((rating): rating is number => rating !== null);

            if (ratings.length === 0) return null;

            const average =
              ratings.reduce((sum, rating) => sum + rating, 0) /
              ratings.length;
            return { steamId, average };
          })
        );

        for (const entry of ratingEntries) {
          if (entry) {
            averageRatings.set(entry.steamId, entry.average);
          }
        }
      }
    } catch {
      // ignore match stats failures to keep the lobby usable
    }
  }

  const averageRatingLabel = (steamId: string) => {
    const average = averageRatings.get(steamId);
    if (average === undefined) return null;
    return average.toFixed(2);
  };

  const canKickPlayers = isCreator || canManageLobbyPlayersUser;
  const getPlayerMeta = (player: (typeof updatedScrim.players)[number]) => {
    const displayName =
      player.user?.displayName || player.displayName || "Unknown player";
    const avatarUrl = player.user?.avatarUrl ?? "";
    const isPlaceholder = player.isPlaceholder || !player.userId;
    const ratingLabel =
      player.steamId && !isPlaceholder
        ? averageRatingLabel(player.steamId)
        : null;
    const initial = displayName.trim().charAt(0).toUpperCase() || "?";
    return { displayName, avatarUrl, isPlaceholder, ratingLabel, initial };
  };

  return (
    <div className="w-full space-y-6 p-6 text-slate-50 md:p-8">
      <SseListener code={updatedScrim.code} />

      {/* HERO */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-[#0f1b2d] p-6 shadow-xl shadow-sky-900/30">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-sky-200">
              Scrim lobby
            </p>
            <h1 className="text-3xl font-semibold mt-1">{updatedScrim.code}</h1>
            <p className="text-sm text-slate-300 mt-2">
              Team up, draft maps, and launch when everyone is ready.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-slate-700 px-3 py-1 text-[11px] uppercase tracking-[0.15em] text-slate-200">
              Status: {statusLabel}
            </span>
            {selectedMap && (
              <span className="rounded-full border border-emerald-600/70 bg-emerald-900/30 px-3 py-1 text-xs font-semibold text-emerald-100">
                Map: {selectedMap}
              </span>
            )}
            {finalConnectString && (
              <span className="rounded-full border border-cyan-600/70 bg-cyan-900/30 px-3 py-1 text-xs font-semibold text-cyan-100">
                {finalConnectString}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* JOIN + MANAGEMENT */}
      <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-md shadow-sky-900/10">
            <ScrimControls
              scrimCode={updatedScrim.code}
              isCreator={isCreator}
              canStartScrim={canStartScrimUser}
              vetoState={vetoState}
              mapPoolLength={mapPool.length}
              selectedMap={updatedScrim.selectedMap}
              serverAddress={serverAddress || undefined}
              connectPassword={connectPassword}
              embedded
            />

            {isCreator && (
              <div className="mt-5 border-t border-slate-800 pt-5">
                <ScrimCreatorControls
                  scrim={{
                    code: updatedScrim.code,
                    vetoMode: updatedScrim.vetoMode,
                    status: updatedScrim.status,
                    serverId: updatedScrim.serverId,
                  }}
                  servers={servers}
                  canManageServers={canManageServersForScrim}
                  embedded
                />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-md shadow-sky-900/10">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Team 1 ({team1.length})</h2>
                {canChangeTeams && currentUserTeam !== "TEAM1" && (
                  <TeamMoveButton
                    scrimCode={updatedScrim.code}
                    team="TEAM1"
                    className="border-slate-700 text-slate-200 hover:bg-slate-800 active:scale-[0.98]"
                  >
                    Join
                  </TeamMoveButton>
                )}
              </div>

              {team1.length === 0 && (
                <p className="text-sm text-slate-400">No players yet.</p>
              )}

              {team1.map((player) => {
                const { displayName, avatarUrl, isPlaceholder, ratingLabel, initial } =
                  getPlayerMeta(player);
                const isSelf = player.userId === user.id;
                return (
                  <div
                    key={player.id}
                    className="mb-2 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          className="h-8 w-8 rounded-full border border-slate-600 object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-xs font-semibold text-slate-300">
                          {initial}
                        </div>
                      )}
                      <span>{displayName}</span>
                      {isPlaceholder && (
                        <span className="inline-flex items-center rounded-full border border-slate-600/60 bg-slate-800/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-slate-300">
                          Placeholder
                        </span>
                      )}
                      {ratingLabel && (
                        <span className="inline-flex items-center rounded-full border border-sky-500/40 bg-sky-900/40 px-2.5 py-0.5 text-[11px] font-semibold text-sky-200">
                          (~{ratingLabel})
                        </span>
                      )}
                      {player.isCaptain && (
                        <span className="text-xs text-yellow-400">(C)</span>
                      )}
                    </div>
                    {canKickPlayers && !isSelf && (
                      <KickButton
                        scrimCode={updatedScrim.code}
                        targetPlayerId={player.id}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-md shadow-sky-900/10">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Team 2 ({team2.length})</h2>
                {canChangeTeams && currentUserTeam !== "TEAM2" && (
                  <TeamMoveButton
                    scrimCode={updatedScrim.code}
                    team="TEAM2"
                    className="border-slate-700 text-slate-200 hover:bg-slate-800 active:scale-[0.98]"
                  >
                    Join
                  </TeamMoveButton>
                )}
              </div>

              {team2.length === 0 && (
                <p className="text-sm text-slate-400">No players yet.</p>
              )}

              {team2.map((player) => {
                const { displayName, avatarUrl, isPlaceholder, ratingLabel, initial } =
                  getPlayerMeta(player);
                const isSelf = player.userId === user.id;
                return (
                  <div
                    key={player.id}
                    className="mb-2 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          className="h-8 w-8 rounded-full border border-slate-600 object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-xs font-semibold text-slate-300">
                          {initial}
                        </div>
                      )}
                      <span>{displayName}</span>
                      {isPlaceholder && (
                        <span className="inline-flex items-center rounded-full border border-slate-600/60 bg-slate-800/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-slate-300">
                          Placeholder
                        </span>
                      )}
                      {ratingLabel && (
                        <span className="inline-flex items-center rounded-full border border-sky-500/40 bg-sky-900/40 px-2.5 py-0.5 text-[11px] font-semibold text-sky-200">
                          (~{ratingLabel})
                        </span>
                      )}
                      {player.isCaptain && (
                        <span className="text-xs text-yellow-400">(C)</span>
                      )}
                    </div>
                    {canKickPlayers && !isSelf && (
                      <KickButton
                        scrimCode={updatedScrim.code}
                        targetPlayerId={player.id}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-md shadow-sky-900/10">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                Waiting Room ({waiting.length})
              </h2>
              {canChangeTeams && currentUserTeam !== "WAITING_ROOM" && (
                <TeamMoveButton
                  scrimCode={updatedScrim.code}
                  team="WAITING_ROOM"
                  className="border-slate-700 text-slate-200 hover:bg-slate-800 active:scale-[0.98]"
                >
                  Move here
                </TeamMoveButton>
              )}
            </div>

            {waiting.length === 0 && (
              <p className="text-sm text-slate-400">
                No players in waiting room.
              </p>
            )}

            {waiting.map((player) => {
              const { displayName, avatarUrl, isPlaceholder, ratingLabel, initial } =
                getPlayerMeta(player);
              const isSelf = player.userId === user.id;
              return (
                <div
                  key={player.id}
                  className="flex items-center justify-between gap-3 mb-2"
                >
                  <div className="flex items-center gap-3">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        className="h-8 w-8 rounded-full border border-slate-600 object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-xs font-semibold text-slate-300">
                        {initial}
                      </div>
                    )}
                    <span>{displayName}</span>
                    {isPlaceholder && (
                      <span className="inline-flex items-center rounded-full border border-slate-600/60 bg-slate-800/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-slate-300">
                        Placeholder
                      </span>
                    )}
                    {ratingLabel && (
                      <span className="inline-flex items-center rounded-full border border-sky-500/40 bg-sky-900/40 px-2.5 py-0.5 text-[11px] font-semibold text-sky-200">
                        (~{ratingLabel})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isCaptain && (
                      <PickButton
                        scrimCode={updatedScrim.code}
                        targetPlayerId={player.id}
                      />
                    )}
                    {canKickPlayers && !isSelf && (
                      <KickButton
                        scrimCode={updatedScrim.code}
                        targetPlayerId={player.id}
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {canChangeTeams && canManageLobbyPlayersUser && (
              <PlaceholderPlayerForm scrimCode={updatedScrim.code} />
            )}
          </div>
        </div>
      </div>

      {/* MAPS + VETO */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-md shadow-sky-900/10">
        <MapPoolSelector
          scrimCode={updatedScrim.code}
          initialMapPool={mapPool}
          canEdit={isCreator && updatedScrim.status === "LOBBY"}
        />

        <div className="mt-5 border-t border-slate-800 pt-5">
          <MapVetoClient
            scrimCode={updatedScrim.code}
            mapPool={mapPool}
            state={vetoState}
            myTeam={
              currentUserTeam === "TEAM1" || currentUserTeam === "TEAM2"
                ? (currentUserTeam as TeamSide)
                : null
            }
            vetoMode={updatedScrim.vetoMode}
            players={vetoPlayers}
          />
        </div>
      </div>
    </div>
  );
}
