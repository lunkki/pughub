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
    selections: Record<string, string[]>; // userId -> map picks
  };
};

const EMPTY_STATE: VetoState = {
  phase: "NOT_STARTED",
  pool: [],
  banned: [],
  turn: null,
};

export const VETO_TURN_SECONDS = 30;

export function parseVetoState(raw: string | null): VetoState {
  if (!raw) {
    return { ...EMPTY_STATE };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<VetoState>;
    const rawPending = parsed.pendingVotes as
      | { team?: TeamSide; turn?: number; selections?: Record<string, string[] | string> }
      | undefined;
    let pendingVotes: VetoState["pendingVotes"] | undefined;

    if (rawPending && rawPending.team && typeof rawPending.turn === "number") {
      const selections: Record<string, string[]> = {};
      if (rawPending.selections && typeof rawPending.selections === "object") {
        for (const [userId, selection] of Object.entries(rawPending.selections)) {
          if (Array.isArray(selection)) {
            selections[userId] = selection.filter((m) => typeof m === "string");
          } else if (typeof selection === "string") {
            selections[userId] = [selection];
          }
        }
      }
      pendingVotes = { team: rawPending.team, turn: rawPending.turn, selections };
    }

    return {
      phase: parsed.phase ?? "NOT_STARTED",
      pool: parsed.pool ?? [],
      banned: parsed.banned ?? [],
      turn: parsed.turn ?? null,
      ...(parsed.deadline ? { deadline: parsed.deadline } : {}),
      ...(parsed.finalMap ? { finalMap: parsed.finalMap } : {}),
      ...(pendingVotes ? { pendingVotes } : {}),
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

export function getVetoVoteLimit(state: VetoState): number {
  if (state.phase !== "IN_PROGRESS" || !state.turn) return 1;

  const poolAfterFirst = state.pool.length - 1;
  if (poolAfterFirst <= 1) return 1;

  const nextTurn =
    poolAfterFirst === 2
      ? state.turn === "TEAM1"
        ? "TEAM2"
        : "TEAM1"
      : getNextTeamABBA(state.banned.length + 1);

  return nextTurn === state.turn ? 2 : 1;
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
