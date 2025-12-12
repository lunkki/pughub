import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "../ui/Button";
import { LoginButton } from "./LoginButton";

export async function Shell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            pughub.alak.fi
          </Link>

          <nav className="flex items-center gap-4 text-sm">
            {user ? (
            <Link
              href="/scrims/new"
              className="hover:text-sky-400"
            >
              Start scrim
            </Link>
            ): null}

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
