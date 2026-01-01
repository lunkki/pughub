import Link from "next/link";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Button } from "./components/ui/Button";
import { JoinByCodeForm } from "./components/JoinByCodeForm";
import { getCurrentUser } from "@/lib/auth";
import { canStartScrim } from "@/lib/permissions";

const headingFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
});

export default async function HomePage() {
  const user = await getCurrentUser();
  const canStartScrimUser = canStartScrim(user);
  const loginUrl = `/api/auth/steam?redirect=${encodeURIComponent("/")}`;

  return (
    <div className="w-full space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-[#0e1627] px-8 py-12 shadow-2xl shadow-sky-900/40 md:px-12 md:py-16">
        <div className="pointer-events-none absolute -right-10 -top-16 h-72 w-72 rounded-full bg-sky-500/10 blur-[120px]" />
        <div className="pointer-events-none absolute left-10 top-24 h-64 w-64 rotate-12 rounded-full bg-cyan-400/5 blur-[120px]" />

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center">
          <div className="flex-1 space-y-5">
            <p
              className={`${mono.className} text-xs uppercase tracking-[0.35em] text-sky-200`}
            >
              PugHub
            </p>
            <h1
              className={`${headingFont.className} text-4xl font-semibold leading-tight text-slate-50 sm:text-5xl`}
            >
              Scrims, without the chaos.
            </h1>
            <p className="max-w-2xl text-lg text-slate-300">
              Create a lobby, share the code, pick teams, veto maps, play.
            </p>

            <div className="flex flex-wrap gap-3">
              {canStartScrimUser ? (
                <Button
                  asChild
                  className="bg-gradient-to-r from-sky-400 to-cyan-500 text-slate-950 shadow-lg shadow-sky-500/40 hover:from-sky-300 hover:to-cyan-400"
                >
                  <Link href="/scrims/new">Start a scrim</Link>
                </Button>
              ) : user ? (
                <Button
                  disabled
                  className="bg-slate-800 text-slate-300"
                  title="Ask an admin for the MANAGER role or add your SteamID to SCRIM_START_STEAM_IDS"
                >
                  Not cleared to start scrims
                </Button>
              ) : (
                <Button
                  asChild
                  className="bg-gradient-to-r from-sky-400 to-cyan-500 text-slate-950 shadow-lg shadow-sky-500/40 hover:from-sky-300 hover:to-cyan-400"
                >
                  <Link href={loginUrl}>Sign in to get started</Link>
                </Button>
              )}
            </div>
          </div>

          <div className="flex-1">
            <JoinByCodeForm className="border-slate-800 bg-slate-900/50" />
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {[
          { title: "Create", body: "Start a lobby." },
          { title: "Share", body: "Send the code to players." },
          { title: "Play", body: "Pick teams, veto maps, connect." },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-md shadow-sky-900/10"
          >
            <div className={`${mono.className} text-[11px] uppercase tracking-[0.2em] text-slate-400`}>
              {item.title}
            </div>
            <div className="mt-2 text-sm text-slate-200">{item.body}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
