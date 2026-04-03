import test from "node:test";
import assert from "node:assert/strict";

import {
  BACKUP_SCHEMA_VERSION,
  HISTORY_KEY,
  SETTINGS_KEY,
  STORAGE_KEY,
  buildBackupPayload,
  loadHistory,
  loadSettings,
  loadState,
  parseBackup,
  saveHistory,
  saveSettings,
  saveState,
  stringifyBackup,
} from "../src/lib/storage.js";
import { createGameState } from "../src/lib/game-engine.js";

function createMemoryStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

test("state, history and settings are saved as versioned envelopes", () => {
  const storage = createMemoryStorage();
  const state = createGameState(["Ada", "Bo"]);
  const history = [
    {
      id: 1,
      date: "03.04.2026",
      players: ["Ada", "Bo"],
      finalScores: [10, 20],
      finalLevels: [2, 1],
      rounds: 1,
      winners: ["Ada"],
      ranking: [
        { name: "Ada", total: 10, level: 2 },
        { name: "Bo", total: 20, level: 1 },
      ],
    },
  ];
  const settings = { theme: "dark", color: "teal", cheatEnabled: true, cheatPoints: 15 };

  saveState(storage, state);
  saveHistory(storage, history);
  saveSettings(storage, settings);

  const rawState = JSON.parse(storage.getItem(STORAGE_KEY));
  const rawHistory = JSON.parse(storage.getItem(HISTORY_KEY));
  const rawSettings = JSON.parse(storage.getItem(SETTINGS_KEY));

  assert.equal(rawState.version, 2);
  assert.equal(rawHistory.version, 2);
  assert.equal(rawSettings.version, 2);
});

test("legacy raw storage values are still loaded correctly", () => {
  const storage = createMemoryStorage({
    [STORAGE_KEY]: JSON.stringify({
      view: "round",
      players: [{ name: "Ada" }, { name: "Bo" }],
      rounds: [[5, 10]],
      roundLevelCleared: [[true, false]],
      playerLevels: [1, 1],
    }),
    [SETTINGS_KEY]: JSON.stringify({
      theme: "auto",
      color: "blue",
      cheatEnabled: false,
      cheatPoints: 10,
    }),
    [HISTORY_KEY]: JSON.stringify([]),
  });

  const state = loadState(storage);
  const settings = loadSettings(storage);
  const history = loadHistory(storage);

  assert.equal(state.players.length, 2);
  assert.deepEqual(state.playerLevels, [2, 1]);
  assert.equal(settings.color, "blue");
  assert.deepEqual(history, []);
});

test("parseBackup accepts valid exports", () => {
  const payload = buildBackupPayload({
    state: createGameState(["Ada", "Bo"]),
    history: [],
    settings: { theme: "light", color: "green", cheatEnabled: false, cheatPoints: 10 },
    lastVersion: "3.1.0",
    appVersion: "3.2.0",
  });

  const parsed = parseBackup(stringifyBackup(payload));

  assert.equal(payload.version, BACKUP_SCHEMA_VERSION);
  assert.equal(parsed.state.players.length, 2);
  assert.equal(parsed.settings.theme, "light");
});

test("parseBackup rejects invalid history rows", () => {
  const invalid = JSON.stringify({
    format: "11ern-backup",
    version: 1,
    data: {
      state: createGameState(["Ada", "Bo"]),
      history: [
        {
          id: 1,
          date: "03.04.2026",
          players: ["Ada", "Bo"],
          finalScores: ["bad", 10],
          finalLevels: [1, 1],
          rounds: 1,
          winners: ["Ada"],
        },
      ],
      settings: { theme: "auto", color: "green", cheatEnabled: false, cheatPoints: 10 },
    },
  });

  assert.throws(
    () => parseBackup(invalid),
    /Backupfilen inneholder historikk med ugyldige felter/,
  );
});
