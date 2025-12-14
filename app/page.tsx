import Link from "next/link";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Button } from "./components/ui/Button";
import { JoinByCodeForm } from "./components/JoinByCodeForm";
import { getCurrentUser } from "@/lib/auth";
import { isScrimStarter } from "@/lib/permissions";

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
  const canStartScrim = user ? isScrimStarter(user.steamId) : false;
  const loginUrl = `/api/auth/steam?redirect=${encodeURIComponent("/")}`;

  return (
    <div className="w-full space-y-12">
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-[#0e1627] px-8 py-12 shadow-2xl shadow-sky-900/40 md:px-12 md:py-16">
        <div className="pointer-events-none absolute -right-10 -top-16 h-72 w-72 rounded-full bg-sky-500/10 blur-[120px]" />
        <div className="pointer-events-none absolute left-10 top-24 h-64 w-64 rotate-12 rounded-full bg-cyan-400/5 blur-[120px]" />

        <div className="relative flex flex-col gap-10 lg:flex-row lg:items-center">
          <div className="flex-1 space-y-6">
            <p
              className={`${mono.className} text-xs uppercase tracking-[0.35em] text-sky-200`}
            >
              Pughub / CS2 Nights
            </p>
            <h1
              className={`${headingFont.className} text-4xl font-semibold leading-tight text-slate-50 sm:text-5xl`}
            >
              Run scrims without admin chaos.
            </h1>
            <p className="max-w-2xl text-lg text-slate-300">
              Start a lobby, share a code, veto maps together, and hand out the
              connect string. That is the whole flow.
            </p>

            <div className="flex flex-wrap gap-3">
              {canStartScrim ? (
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
                  title="Ask an admin to add your SteamID to SCRIM_START_STEAM_IDS"
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

              <Button
                asChild
                variant="outline"
                className="border-slate-700 text-slate-200 hover:border-sky-400 hover:text-sky-200"
              >
                <Link href="#playbook">See how it works</Link>
              </Button>
            </div>

            <div className="flex flex-wrap gap-5 text-sm text-slate-400">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-sky-400" />
                Live lobby updates
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Map veto automation
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400" />
                RCON-ready server info
              </span>
            </div>
          </div>

          <div className="flex-1">
            <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-sky-900/30">
              <div className="absolute left-6 top-6 h-10 w-10 rounded-full bg-gradient-to-br from-sky-400/50 to-cyan-500/30 blur-3xl" />
              <div className="absolute right-3 top-10 h-24 w-24 rounded-full bg-sky-500/10 blur-3xl" />
              <div className="relative space-y-5">
                <p
                  className={`${mono.className} text-[11px] uppercase tracking-[0.2em] text-slate-300`}
                >
                  Lobby Snapshot
                </p>
                <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div>
                    <p className="text-xs text-slate-400">Team One</p>
                    <p className={`${headingFont.className} text-2xl`}>
                      5 players
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Team Two</p>
                    <p className={`${headingFont.className} text-2xl`}>
                      5 players
                    </p>
                  </div>
                  <div className="col-span-2 rounded-lg border border-slate-800 bg-slate-900/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-sky-200">
                      Map veto
                    </p>
                    <p className="mt-1 text-slate-200">ABBA bans in progress</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase">
                      {["Ancient", "Anubis", "Inferno", "Mirage"].map((map) => (
                        <span
                          key={map}
                          className="rounded-full border border-slate-700 px-3 py-1 text-slate-300"
                        >
                          {map}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center justify-between rounded-lg border border-emerald-700/50 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-200">
                    <div>
                      <p className={`${mono.className} text-[11px] uppercase tracking-[0.18em]`}>
                        Ready to launch
                      </p>
                      <p className="text-emerald-100">Server reserved & password set</p>
                    </div>
                    <span className="rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-semibold text-emerald-950">
                      Prime
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <JoinByCodeForm />

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-sky-900/20">
          <p
            className={`${mono.className} text-[11px] uppercase tracking-[0.2em] text-slate-300`}
          >
            Quick setup
          </p>
          <h2
            className={`${headingFont.className} mt-2 text-xl font-semibold text-slate-50`}
          >
            Less lobby wrangling, more rounds.
          </h2>
          <p className="mt-3 text-sm text-slate-300">
            Share one code, let players join the waiting room, captains draft,
            and everyone gets the same connect string.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-200">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              Automatic waiting room to team assignment
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              Creator-only controls for server + veto
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Live updates, no refresh required
            </li>
          </ul>
        </div>
      </section>

      <section
        id="playbook"
        className="rounded-3xl border border-slate-800 bg-slate-950/80 p-8 shadow-inner shadow-sky-900/30"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p
              className={`${mono.className} text-[11px] uppercase tracking-[0.2em] text-slate-400`}
            >
              Playbook
            </p>
            <h3
              className={`${headingFont.className} mt-2 text-2xl font-semibold`}
            >
              Simple steps for each night
            </h3>
          </div>
          <span className="rounded-full border border-slate-700 px-3 py-1 text-[11px] uppercase tracking-[0.15em] text-slate-300">
            Built for repeat runs
          </span>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Spin up",
              body:
                "If you're cleared, create a lobby in one click. Only approved Steam IDs can start.",
            },
            {
              title: "Assemble",
              body:
                "Share the code. Players join the waiting room and captains draft without reloading.",
            },
            {
              title: "Launch",
              body:
                "Finish the veto and give everyone the connect string for the server.",
            },
          ].map((item, idx) => (
            <div
              key={item.title}
              className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
            >
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200">
                  0{idx + 1}
                </span>
                <h4
                  className={`${headingFont.className} text-lg font-semibold`}
                >
                  {item.title}
                </h4>
              </div>
              <p className="mt-3 text-sm text-slate-300">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
