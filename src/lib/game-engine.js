export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;

export const LEVELS = [
  { n: 1, desc: "Serie på 4", trump: 0 },
  { n: 2, desc: "Tress 2 ganger", trump: 1 },
  { n: 3, desc: "Serie på 4 + tress", trump: 1 },
  { n: 4, desc: "Serie på 5", trump: 2 },
  { n: 5, desc: "Tress 3 ganger", trump: 2 },
  { n: 6, desc: "Serie på 5 + tress", trump: 2 },
  { n: 7, desc: "Serie på 7", trump: 2 },
  { n: 8, desc: "Serie på 6 + tress", trump: 3 },
  { n: 9, desc: "Serie på 4, 2 ganger", trump: 2 },
  { n: 10, desc: "5 like 2 ganger", trump: 4 },
  { n: 11, desc: "Serie på 9", trump: 4 },
];

export function defaultState() {
  return {
    view: "setup",
    playerCount: 4,
    players: [],
    rounds: [],
    playerLevels: [],
    roundLevelCleared: [],
  };
}

function cloneState(state) {
  return {
    view: state.view,
    playerCount: state.playerCount,
    players: state.players.map((player) => ({ ...player })),
    rounds: state.rounds.map((round) => [...round]),
    playerLevels: [...state.playerLevels],
    roundLevelCleared: state.roundLevelCleared.map((row) => [...row]),
  };
}

function normalizePlayerName(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePlayers(players) {
  if (!Array.isArray(players)) {
    return [];
  }

  return players
    .map((player) => normalizePlayerName(player?.name ?? player))
    .filter(Boolean)
    .slice(0, MAX_PLAYERS)
    .map((name) => ({ name }));
}

function normalizeRound(round, playerCount) {
  if (!Array.isArray(round) || round.length !== playerCount) {
    return null;
  }

  const normalized = [];
  for (let index = 0; index < playerCount; index += 1) {
    const value = Number.parseInt(round[index], 10);
    if (Number.isNaN(value) || value < 0) {
      return null;
    }
    normalized.push(value);
  }

  return normalized;
}

function normalizeClearedRow(row, playerCount) {
  if (!Array.isArray(row)) {
    return new Array(playerCount).fill(false);
  }

  return Array.from({ length: playerCount }, (_, index) => Boolean(row[index]));
}

function clampPlayerCount(playerCount, fallback) {
  if (Number.isInteger(playerCount) && playerCount >= MIN_PLAYERS && playerCount <= MAX_PLAYERS) {
    return playerCount;
  }

  return fallback;
}

export function recalculateLevels(roundLevelCleared, playerCount) {
  const levels = new Array(playerCount).fill(1);

  roundLevelCleared.forEach((clearedRound) => {
    clearedRound.forEach((didClear, index) => {
      if (didClear && levels[index] < LEVELS.length) {
        levels[index] += 1;
      }
    });
  });

  return levels;
}

export function normalizeState(candidate) {
  const fallback = defaultState();
  const players = normalizePlayers(candidate?.players);

  if (players.length === 0) {
    return {
      ...fallback,
      playerCount: clampPlayerCount(candidate?.playerCount, fallback.playerCount),
    };
  }

  const playerCount = players.length;
  const rounds = Array.isArray(candidate?.rounds)
    ? candidate.rounds
        .map((round) => normalizeRound(round, playerCount))
        .filter(Boolean)
    : [];

  const roundLevelCleared = rounds.map((_, index) =>
    normalizeClearedRow(candidate?.roundLevelCleared?.[index], playerCount),
  );

  return {
    view: candidate?.view === "round" ? "round" : "setup",
    playerCount,
    players,
    rounds,
    roundLevelCleared,
    playerLevels: recalculateLevels(roundLevelCleared, playerCount),
  };
}

export function createGameState(names) {
  const players = normalizePlayers(names);
  if (players.length < MIN_PLAYERS) {
    throw new Error("Et spill må ha minst to spillere.");
  }

  return {
    view: "round",
    playerCount: players.length,
    players,
    rounds: [],
    playerLevels: new Array(players.length).fill(1),
    roundLevelCleared: [],
  };
}

export function getTotals(state) {
  return state.players.map((_, index) =>
    state.rounds.reduce((sum, round) => sum + (round[index] ?? 0), 0),
  );
}

export function getStandings(state) {
  const totals = getTotals(state);

  return state.players
    .map((player, index) => ({
      index,
      name: player.name,
      total: totals[index],
      level: state.playerLevels[index] ?? 1,
    }))
    .sort(
      (a, b) =>
        b.level - a.level ||
        a.total - b.total ||
        a.name.localeCompare(b.name, "nb"),
    );
}

export function getWinnerNames(state) {
  const standings = getStandings(state);
  if (standings.length === 0) {
    return [];
  }

  const top = standings[0];
  return standings
    .filter((entry) => entry.level === top.level && entry.total === top.total)
    .map((entry) => entry.name);
}

function assertRoundPayload(state, payload) {
  const scores = normalizeRound(payload?.scores, state.players.length);
  if (!scores) {
    throw new Error("Rundedata mangler eller inneholder ugyldige poeng.");
  }

  return {
    scores,
    cleared: normalizeClearedRow(payload?.cleared, state.players.length),
  };
}

function getNewWinners(players, previousLevels, cleared) {
  return players
    .filter((_, index) => cleared[index] && previousLevels[index] === LEVELS.length)
    .map((player) => player.name);
}

export function addRound(state, payload) {
  const current = cloneState(normalizeState(state));
  const { scores, cleared } = assertRoundPayload(current, payload);
  const previousLevels = [...current.playerLevels];

  current.rounds.push(scores);
  current.roundLevelCleared.push(cleared);
  current.playerLevels = recalculateLevels(current.roundLevelCleared, current.players.length);

  return {
    state: current,
    newWinners: getNewWinners(current.players, previousLevels, cleared),
  };
}

export function updateRound(state, roundIndex, payload) {
  const current = cloneState(normalizeState(state));
  if (!Number.isInteger(roundIndex) || roundIndex < 0 || roundIndex >= current.rounds.length) {
    throw new Error("Runden finnes ikke.");
  }

  const { scores, cleared } = assertRoundPayload(current, payload);
  current.rounds[roundIndex] = scores;
  current.roundLevelCleared[roundIndex] = cleared;
  current.playerLevels = recalculateLevels(current.roundLevelCleared, current.players.length);
  return current;
}

export function deleteRound(state, roundIndex) {
  const current = cloneState(normalizeState(state));
  if (!Number.isInteger(roundIndex) || roundIndex < 0 || roundIndex >= current.rounds.length) {
    throw new Error("Runden finnes ikke.");
  }

  current.rounds.splice(roundIndex, 1);
  current.roundLevelCleared.splice(roundIndex, 1);
  current.playerLevels = recalculateLevels(current.roundLevelCleared, current.players.length);
  return current;
}

export function undoLastRound(state) {
  const current = cloneState(normalizeState(state));
  if (current.rounds.length === 0) {
    return { state: current, removedRound: null };
  }

  const removedScores = current.rounds.pop();
  const removedCleared = current.roundLevelCleared.pop() ?? [];
  current.playerLevels = recalculateLevels(current.roundLevelCleared, current.players.length);

  return {
    state: current,
    removedRound: {
      scores: removedScores,
      cleared: removedCleared,
    },
  };
}

export function buildHistoryEntry(state, now = new Date()) {
  const normalized = normalizeState(state);
  if (normalized.rounds.length === 0) {
    return null;
  }

  const standings = getStandings(normalized);
  const totals = getTotals(normalized);

  return {
    id: now.getTime(),
    date: now.toLocaleDateString("nb-NO"),
    players: normalized.players.map((player) => player.name),
    finalScores: totals,
    finalLevels: [...normalized.playerLevels],
    rounds: normalized.rounds.length,
    winners: getWinnerNames(normalized),
    ranking: standings.map((entry) => ({
      name: entry.name,
      total: entry.total,
      level: entry.level,
    })),
  };
}

export function getGameSummary(state) {
  const normalized = normalizeState(state);
  const standings = getStandings(normalized);
  const winners = getWinnerNames(normalized);
  const roundTotals = normalized.rounds.map((round) =>
    round.reduce((sum, value) => sum + value, 0),
  );
  const topLevel = standings[0]?.level ?? 1;
  const totalPoints = standings.reduce((sum, entry) => sum + entry.total, 0);

  return {
    rounds: normalized.rounds.length,
    standings,
    winners,
    totalPoints,
    highestLevel: topLevel,
    bestRoundTotal: roundTotals.length > 0 ? Math.min(...roundTotals) : 0,
    lastRoundTotal:
      roundTotals.length > 0 ? roundTotals[roundTotals.length - 1] : 0,
    completedPlayers: standings
      .filter((entry) => entry.level >= LEVELS.length)
      .map((entry) => entry.name),
  };
}
