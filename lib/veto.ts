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

export const VETO_TURN_SECONDS = 40;

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

export function advanceVetoState({
  state,
  banChoice,
  turnTeam,
  by = turnTeam,
}: {
  state: VetoState;
  banChoice: string;
  turnTeam: TeamSide;
  by?: TeamSide | "RANDOM";
}): {
  updatedState: VetoState;
  statusUpdate: "MAP_VETO" | "READY_TO_PLAY";
  finalMap?: string;
} {
  const newPool = state.pool.filter((m) => m !== banChoice);
  const newBanned = [...state.banned, { map: banChoice, by }];

  let newTurn: TeamSide | null = null;
  let phase: VetoPhase = "IN_PROGRESS";
  let finalMap: string | undefined;
  let statusUpdate: "MAP_VETO" | "READY_TO_PLAY" = "MAP_VETO";

  if (newPool.length <= 1) {
    phase = "DONE";
    newTurn = null;
    finalMap = newPool[0] ?? banChoice;
    statusUpdate = "READY_TO_PLAY";
  } else if (newPool.length === 2) {
    newTurn = turnTeam === "TEAM1" ? "TEAM2" : "TEAM1";
  } else {
    newTurn = getNextTeamABBA(newBanned.length);
  }

  const deadline = newTurn
    ? new Date(Date.now() + VETO_TURN_SECONDS * 1000).toISOString()
    : undefined;

  return {
    updatedState: {
      phase,
      pool: newPool,
      banned: newBanned,
      turn: newTurn,
      deadline,
      ...(finalMap ? { finalMap } : {}),
    },
    statusUpdate,
    finalMap,
  };
}
