// lib/veto.ts

export type TeamSide = "TEAM1" | "TEAM2";

export type VetoPhase = "NOT_STARTED" | "IN_PROGRESS" | "DONE";

export type VetoState = {
  phase: VetoPhase;
  pool: string[];
  banned: { map: string; by: TeamSide | "RANDOM" }[];
  turn: TeamSide | null;
  deadline?: string;
  finalMap?: string;
  pendingVotes?: {
    team: TeamSide;
    turn: number;
    selections: Record<string, string>; // userId -> map pick
  };
};

const EMPTY_STATE: VetoState = {
  phase: "NOT_STARTED",
  pool: [],
  banned: [],
  turn: null,
};

export function parseVetoState(raw: string | null): VetoState {
  if (!raw) {
    return { ...EMPTY_STATE };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<VetoState>;

    return {
      phase: parsed.phase ?? "NOT_STARTED",
      pool: parsed.pool ?? [],
      banned: parsed.banned ?? [],
      turn: parsed.turn ?? null,
      ...(parsed.deadline ? { deadline: parsed.deadline } : {}),
      ...(parsed.finalMap ? { finalMap: parsed.finalMap } : {}),
      ...(parsed.pendingVotes ? { pendingVotes: parsed.pendingVotes } : {}),
    };
  } catch {
    return { ...EMPTY_STATE };
  }
}

// ABBA pattern helper: T1, T2, T2, T1, repeat
export function getNextTeamABBA(banCount: number): TeamSide {
  const pattern: TeamSide[] = ["TEAM1", "TEAM2", "TEAM2", "TEAM1"];
  return pattern[banCount % pattern.length];
}
