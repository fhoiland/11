import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  defaultState,
  normalizeState,
} from "./game-engine.js";

export const STORAGE_SCHEMA_VERSION = 2;
export const BACKUP_SCHEMA_VERSION = 1;
export const STORAGE_KEY = "11ern_state";
export const HISTORY_KEY = "11ern_history";
export const SETTINGS_KEY = "11ern_settings";
export const LAST_VERSION_KEY = "11ern_last_version";
export const LEGACY_THEME_KEY = "11ern_theme";

const VALID_THEMES = new Set(["light", "auto", "dark"]);
const VALID_COLORS = new Set(["green", "blue", "purple", "teal", "red"]);

function createEnvelope(data) {
  return {
    version: STORAGE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    data,
  };
}

function parseStoredValue(raw) {
  if (!raw) {
    return null;
  }

  const parsed = JSON.parse(raw);
  if (
    parsed &&
    typeof parsed === "object" &&
    Number.isInteger(parsed.version) &&
    Object.prototype.hasOwnProperty.call(parsed, "data")
  ) {
    return parsed.data;
  }

  return parsed;
}

function normalizeTheme(value, fallback = "auto") {
  return VALID_THEMES.has(value) ? value : fallback;
}

function normalizeColor(value) {
  return VALID_COLORS.has(value) ? value : "green";
}

export function normalizeSettings(candidate, legacyTheme = null) {
  const rawPoints = Number.parseInt(candidate?.cheatPoints, 10);

  return {
    theme: normalizeTheme(candidate?.theme, normalizeTheme(legacyTheme, "auto")),
    color: normalizeColor(candidate?.color),
    cheatEnabled: Boolean(candidate?.cheatEnabled),
    cheatPoints: Number.isNaN(rawPoints) || rawPoints < 1 ? 10 : rawPoints,
  };
}

function normalizeHistoryEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const players = Array.isArray(entry.players)
    ? entry.players
        .map((player) => (typeof player === "string" ? player.trim() : ""))
        .filter(Boolean)
    : [];

  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    return null;
  }

  const finalScores = Array.isArray(entry.finalScores)
    ? entry.finalScores.map((value) => Number.parseInt(value, 10))
    : [];

  const finalLevels = Array.isArray(entry.finalLevels)
    ? entry.finalLevels.map((value) => Number.parseInt(value, 10))
    : [];

  if (
    finalScores.length !== players.length ||
    finalLevels.length !== players.length ||
    finalScores.some((value) => Number.isNaN(value) || value < 0) ||
    finalLevels.some((value) => Number.isNaN(value) || value < 1)
  ) {
    return null;
  }

  const winners = Array.isArray(entry.winners)
    ? entry.winners.filter((name) => typeof name === "string" && players.includes(name))
    : [];

  const ranking = Array.isArray(entry.ranking)
    ? entry.ranking
        .map((row) => {
          const name = typeof row?.name === "string" ? row.name : "";
          const total = Number.parseInt(row?.total, 10);
          const level = Number.parseInt(row?.level, 10);

          if (!name || Number.isNaN(total) || total < 0 || Number.isNaN(level) || level < 1) {
            return null;
          }

          return { name, total, level };
        })
        .filter(Boolean)
    : [];

  return {
    id: Number.isFinite(entry.id) ? entry.id : Date.now(),
    date: typeof entry.date === "string" && entry.date.trim() ? entry.date : "Ukjent dato",
    players,
    finalScores,
    finalLevels,
    rounds: Number.isInteger(entry.rounds) && entry.rounds >= 0 ? entry.rounds : 0,
    winners,
    ranking,
  };
}

export function normalizeHistory(candidate) {
  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate
    .map((entry) => normalizeHistoryEntry(entry))
    .filter(Boolean)
    .slice(-50);
}

export function loadState(storage) {
  try {
    return normalizeState(parseStoredValue(storage.getItem(STORAGE_KEY)));
  } catch {
    return defaultState();
  }
}

export function saveState(storage, state) {
  storage.setItem(STORAGE_KEY, JSON.stringify(createEnvelope(normalizeState(state))));
}

export function loadHistory(storage) {
  try {
    return normalizeHistory(parseStoredValue(storage.getItem(HISTORY_KEY)));
  } catch {
    return [];
  }
}

export function saveHistory(storage, history) {
  storage.setItem(HISTORY_KEY, JSON.stringify(createEnvelope(normalizeHistory(history))));
}

export function loadSettings(storage) {
  try {
    const legacyTheme = storage.getItem(LEGACY_THEME_KEY);
    return normalizeSettings(parseStoredValue(storage.getItem(SETTINGS_KEY)), legacyTheme);
  } catch {
    return normalizeSettings({}, null);
  }
}

export function saveSettings(storage, settings) {
  storage.setItem(
    SETTINGS_KEY,
    JSON.stringify(createEnvelope(normalizeSettings(settings))),
  );
}

export function loadLastVersion(storage) {
  try {
    const value = storage.getItem(LAST_VERSION_KEY);
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

export function saveLastVersion(storage, version) {
  storage.setItem(LAST_VERSION_KEY, version);
}

export function clearHistory(storage) {
  storage.removeItem(HISTORY_KEY);
}

export function buildBackupPayload({ state, history, settings, lastVersion, appVersion }) {
  return {
    format: "11ern-backup",
    version: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion,
    data: {
      state: normalizeState(state),
      history: normalizeHistory(history),
      settings: normalizeSettings(settings),
      lastVersion: typeof lastVersion === "string" ? lastVersion : null,
    },
  };
}

export function stringifyBackup(payload) {
  return JSON.stringify(payload, null, 2);
}

export function parseBackup(text) {
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Backupfilen er ikke gyldig JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Backupfilen har ugyldig format.");
  }

  const payload = parsed.data && typeof parsed.data === "object" ? parsed.data : parsed;
  const rawState = payload.state ?? defaultState();
  const rawHistory = payload.history ?? [];
  const rawSettings = payload.settings ?? {};

  if (rawState && typeof rawState !== "object") {
    throw new Error("Backupfilen inneholder et spill med ugyldig format.");
  }

  if (!Array.isArray(rawHistory)) {
    throw new Error("Backupfilen inneholder historikk med ugyldig format.");
  }

  const state = normalizeState(rawState);
  const history = normalizeHistory(rawHistory);
  const settings = normalizeSettings(rawSettings);

  if (
    Array.isArray(rawState?.players) &&
    rawState.players.length > 0 &&
    state.players.length !== rawState.players.length
  ) {
    throw new Error("Backupfilen inneholder et spill som ikke kan leses.");
  }

  if (Array.isArray(rawState?.rounds) && state.rounds.length !== rawState.rounds.length) {
    throw new Error("Backupfilen inneholder runder med ugyldige verdier.");
  }

  if (history.length !== rawHistory.length) {
    throw new Error("Backupfilen inneholder historikk med ugyldige felter.");
  }

  return {
    state,
    history,
    settings,
    lastVersion:
      typeof payload.lastVersion === "string" ? payload.lastVersion : null,
  };
}
