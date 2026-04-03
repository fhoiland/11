import test from "node:test";
import assert from "node:assert/strict";

import {
  addRound,
  buildHistoryEntry,
  createGameState,
  getGameSummary,
  undoLastRound,
  updateRound,
} from "../src/lib/game-engine.js";

test("addRound advances levels and reports new winners", () => {
  let state = createGameState(["Ada", "Bo"]);

  for (let round = 0; round < 10; round += 1) {
    state = addRound(state, {
      scores: [5, 10],
      cleared: [true, false],
    }).state;
  }

  const result = addRound(state, {
    scores: [0, 5],
    cleared: [true, false],
  });

  assert.deepEqual(result.newWinners, ["Ada"]);
  assert.equal(result.state.playerLevels[0], 11);
});

test("undoLastRound removes the latest round and recalculates levels", () => {
  let state = createGameState(["Ada", "Bo"]);
  state = addRound(state, { scores: [5, 10], cleared: [true, false] }).state;
  state = addRound(state, { scores: [10, 5], cleared: [false, true] }).state;

  const result = undoLastRound(state);

  assert.equal(result.state.rounds.length, 1);
  assert.deepEqual(result.removedRound.scores, [10, 5]);
  assert.deepEqual(result.state.playerLevels, [2, 1]);
});

test("updateRound recalculates standings from edited round data", () => {
  let state = createGameState(["Ada", "Bo"]);
  state = addRound(state, { scores: [5, 30], cleared: [true, false] }).state;
  state = addRound(state, { scores: [10, 10], cleared: [false, true] }).state;

  const updated = updateRound(state, 1, {
    scores: [0, 5],
    cleared: [true, false],
  });

  const summary = getGameSummary(updated);
  assert.equal(summary.standings[0].name, "Ada");
  assert.deepEqual(updated.playerLevels, [3, 1]);
});

test("buildHistoryEntry stores ranking separately and keeps player score order", () => {
  let state = createGameState(["Ada", "Bo"]);
  state = addRound(state, { scores: [25, 5], cleared: [false, true] }).state;
  state = addRound(state, { scores: [5, 40], cleared: [true, false] }).state;

  const entry = buildHistoryEntry(state, new Date("2026-04-03T10:00:00Z"));

  assert.deepEqual(entry.players, ["Ada", "Bo"]);
  assert.deepEqual(entry.finalScores, [30, 45]);
  assert.equal(entry.ranking[0].name, "Ada");
  assert.deepEqual(entry.winners, ["Ada"]);
});
