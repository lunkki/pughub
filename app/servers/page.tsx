import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isScrimStarter } from "@/lib/permissions";
import { ServerManagerClient } from "./ServerManagerClient";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ServersPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="p-10 text-slate-50">
        <h1 className="text-xl font-bold mb-4">You must be logged in.</h1>
        <Link href="/api/auth/steam" className="underline text-sky-400">
          Sign in with Steam
        </Link>
      </div>
    );
  }

  if (!isScrimStarter(user.steamId)) {
    return (
      <div className="p-10 text-slate-50">
        <h1 className="text-xl font-bold mb-2">Access denied</h1>
        <p className="text-slate-300 text-sm">
          Your SteamID is not in SCRIM_START_STEAM_IDS, so you cannot manage servers.
        </p>
      </div>
    );
  }

  const servers = await prisma.server.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-8 text-slate-50">
      <h1 className="text-2xl font-bold mb-4">Server manager</h1>
      <p className="text-slate-300 text-sm mb-6">
        Add or edit CS2 servers. Only Steam IDs in SCRIM_START_STEAM_IDS can see this page.
      </p>
      <ServerManagerClient initialServers={servers} />
    </div>
  );
}
