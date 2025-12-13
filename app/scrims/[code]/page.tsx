import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { MapPoolSelector } from "./MapPoolSelector";
import { JoinButtons } from "./JoinButtons";
import { PickButton } from "./PickButton";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SseListener } from "./SseListener";
import { ScrimCreatorControls } from "./ScrimCreatorControls";
import { MapVetoClient } from "./MapVetoClient";
import { ScrimControls } from "./ScrimControls";
import { parseVetoState, TeamSide } from "@/lib/veto";
import { getConnectPassword } from "@/lib/serverControl";


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
    return (
      <div className="p-10 text-slate-50">
        <h1 className="text-xl font-bold mb-4">
          You must be logged in to view this scrim.
        </h1>
        <Link href="/api/auth/steam" className="underline text-sky-400">
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

  const team1 = updatedScrim.players.filter((p) => p.team === "TEAM1");
  const team2 = updatedScrim.players.filter((p) => p.team === "TEAM2");
  const waiting = updatedScrim.players.filter(
    (p) => p.team === "WAITING_ROOM"
  );

  // Captain detection
  const captain1UserId = team1.find((p) => p.isCaptain)?.userId;
  const captain2UserId = team2.find((p) => p.isCaptain)?.userId;
  const isCaptain = user.id === captain1UserId || user.id === captain2UserId;

  return (
    <div className="p-8 text-slate-50">
      <SseListener code={updatedScrim.code} />

      <h1 className="text-2xl font-bold mb-6">
        Scrim Lobby – {updatedScrim.code}
      </h1>

      {/* JOIN BUTTONS */}
    <JoinButtons code={updatedScrim.code} canChangeTeams={canChangeTeams} />


      {/* SCRIM MANAGEMENT / START MATCH (starts veto) */}
      <div className="mt-6">
        <ScrimControls
          scrimCode={updatedScrim.code}
          isCreator={isCreator}
          vetoState={vetoState}
          mapPoolLength={mapPool.length}
          selectedMap={updatedScrim.selectedMap}
          serverAddress={serverAddress || undefined}
          connectPassword={connectPassword}
        />
      </div>

      {/* Extra creator-only config (team mode, veto type etc.) */}
      {isCreator && (
        <div className="mt-4">
          <ScrimCreatorControls scrim={updatedScrim} />
        </div>
      )}

      {/* TEAMS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {/* TEAM 1 */}
        <div className="border border-slate-700 rounded-lg p-4 bg-[color:var(--panel-bg)]">
          <h2 className="text-lg font-semibold mb-3">Team 1</h2>

          {team1.length === 0 && (
            <p className="text-sm text-slate-400">No players yet.</p>
          )}

          {team1.map((player) => (
            <div key={player.id} className="flex items-center gap-3 mb-2">
              <img
                src={player.user.avatarUrl ?? ""}
                className="h-8 w-8 rounded-full border border-slate-600"
              />
              <span>{player.user.displayName}</span>
              {player.isCaptain && (
                <span className="text-xs text-yellow-400">(C)</span>
              )}
            </div>
          ))}
        </div>

        {/* TEAM 2 */}
        <div className="border border-slate-700 rounded-lg p-4 bg-[color:var(--panel-bg)]">
          <h2 className="text-lg font-semibold mb-3">Team 2</h2>

          {team2.length === 0 && (
            <p className="text-sm text-slate-400">No players yet.</p>
          )}

          {team2.map((player) => (
            <div key={player.id} className="flex items-center gap-3 mb-2">
              <img
                src={player.user.avatarUrl ?? ""}
                className="h-8 w-8 rounded-full border border-slate-600"
              />
              <span>{player.user.displayName}</span>
              {player.isCaptain && (
                <span className="text-xs text-yellow-400">(C)</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* WAITING ROOM */}
      <div className="mt-8 border border-slate-700 rounded-lg p-4 bg-[color:var(--panel-bg)]">
        <h2 className="text-lg font-semibold mb-3">Waiting Room</h2>

        {waiting.length === 0 && (
          <p className="text-sm text-slate-400">
            No players in waiting room.
          </p>
        )}

        {waiting.map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between gap-3 mb-2"
          >
            <div className="flex items-center gap-3">
              <img
                src={player.user.avatarUrl ?? ""}
                className="h-8 w-8 rounded-full border border-slate-600"
              />
              <span>{player.user.displayName}</span>
            </div>

            {/* CAPTAIN-ONLY PICK BUTTON */}
            {isCaptain && (
              <PickButton
                scrimCode={updatedScrim.code}
                targetUserId={player.userId}
              />
            )}
          </div>
        ))}
      </div>

      {/* MAP POOL CONFIG + DISPLAY */}
      <div className="mt-10">
        <MapPoolSelector
          scrimCode={updatedScrim.code}
          initialMapPool={mapPool}
          canEdit={isCreator && updatedScrim.status === "LOBBY"}

        />

      </div>

      {/* MAP VETO UI (ABBA bans etc.) */}
      <div className="mt-10">
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
        />
      </div>
    </div>
  );
}
