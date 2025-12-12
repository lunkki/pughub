import { cookies } from "next/headers";
import { prisma } from "./db";
import { verifySession } from "./session";

export type SessionUser = {
  id: string;
  displayName: string;
  avatarUrl?: string;
  steamId: string;
  role: "PLAYER" | "ADMIN";
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  // 1. Read session cookie
  const cookieStore = cookies();
  const token = (await cookieStore).get("session")?.value;
  if (!token) {
    return null;
  }

  // 2. Verify JWT and extract userId
  const userId = await verifySession(token);
  if (!userId) {
    return null;
  }

  // 3. Look up user in database
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return null;
  }

  // 4. Return SessionUser object to the app
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? undefined,
    steamId: user.steamId,
    role: user.role,
  };
}
