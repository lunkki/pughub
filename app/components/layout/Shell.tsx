import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "../ui/Button";
import { LoginButton } from "./LoginButton";
import { canManageRoles, canManageServers, canStartScrim } from "@/lib/permissions";

export async function Shell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const canStartScrimUser = canStartScrim(user);
  const canManageServersUser = canManageServers(user);
  const canManageRolesUser = canManageRoles(user);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="rounded-full border border-slate-800 bg-slate-900/70 px-4 py-1 text-lg font-semibold tracking-[0.05em] text-slate-100 shadow-md shadow-sky-900/20 transition hover:border-sky-500/60 hover:text-sky-50"
          >
            <span className="bg-gradient-to-r from-sky-300 to-cyan-400 bg-clip-text text-transparent">
              PugHub
            </span>
          </Link>

          <nav className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-3">
              {canStartScrimUser ? (
                <Button
                  asChild
                  className="bg-gradient-to-r from-sky-400 to-cyan-500 text-slate-950 shadow-md shadow-sky-500/30 hover:from-sky-300 hover:to-cyan-400"
                >
                  <Link href="/scrims/new">Start scrim</Link>
                </Button>
              ) : null}
              {user ? (
                <>
                  <Link href="/matches" className="hover:text-sky-400">
                    Matches
                  </Link>
                  <Link href="/leaderboard" className="hover:text-sky-400">
                    Leaderboard
                  </Link>
                </>
              ) : null}
            </div>

            {(canManageServersUser || canManageRolesUser) && (
              <div className="flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-slate-400">
                <span className="h-5 w-px bg-slate-700/70" aria-hidden="true" />
                <div className="flex items-center gap-3">
                  {canManageServersUser ? (
                    <Link href="/servers" className="hover:text-sky-300">
                      Servers
                    </Link>
                  ) : null}
                  {canManageRolesUser ? (
                    <Link href="/admin/roles" className="hover:text-sky-300">
                      Roles
                    </Link>
                  ) : null}
                </div>
              </div>
            )}

            {/* Auth UI */}
            {user ? (
              <div className="flex items-center gap-3">
                <img
                  src={user.avatarUrl ?? ""}
                  alt="avatar"
                  className="h-8 w-8 rounded-full border border-slate-700"
                />
                <Link href="/profile" className="hover:text-sky-400">
                  {user.displayName}
                </Link>
                <Button asChild variant="outline">
                  <a href="/api/auth/logout">Logout</a>
                </Button>
              </div>
            ) : (
            <LoginButton />
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
