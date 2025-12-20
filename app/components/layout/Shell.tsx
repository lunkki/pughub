import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "../ui/Button";
import { LoginButton } from "./LoginButton";
import { isScrimStarter } from "@/lib/permissions";

export async function Shell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const canStartScrim = user ? isScrimStarter(user.steamId) : false;

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

          <nav className="flex items-center gap-4 text-sm">
            {user ? (
              <Link href="/stats" className="hover:text-sky-400">
                Stats
              </Link>
            ) : null}
            {canStartScrim ? (
              <>
                <Link href="/scrims/new" className="hover:text-sky-400">
                  Start scrim
                </Link>
                <Link href="/servers" className="hover:text-sky-400">
                  Servers
                </Link>
              </>
            ) : null}

            {/* Auth UI */}
            {user ? (
              <div className="flex items-center gap-3">
                <img
                  src={user.avatarUrl ?? ""}
                  alt="avatar"
                  className="h-8 w-8 rounded-full border border-slate-700"
                />
                <span>{user.displayName}</span>
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
