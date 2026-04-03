import {
  LEVELS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  addRound,
  buildHistoryEntry,
  createGameState,
  defaultState,
  deleteRound,
  getGameSummary,
  normalizeState,
  undoLastRound,
  updateRound,
} from "../lib/game-engine.js";
import {
  buildBackupPayload,
  clearHistory,
  loadHistory,
  loadLastVersion,
  loadSettings,
  loadState,
  normalizeSettings,
  parseBackup,
  saveHistory,
  saveLastVersion,
  saveSettings,
  saveState,
  stringifyBackup,
} from "../lib/storage.js";

const VERSION = "3.2.0";
const BASE_URL = import.meta.env.BASE_URL;

const CHANGELOG = {
  "2.1.0": ["Historikk: siste 5 spill lagres og vises i statistikk."],
  "2.2.0": ["Rediger tidligere runder direkte fra oversikten.", "Bekreftelsesdialog ved nytt spill."],
  "2.3.0": ["Klikkbare spilldetaljer i historikk.", "Dobbelttrykk-zoom er deaktivert på mobil."],
  "2.4.0": ["Innstillingsknapp med fargevalg, temavalg og juksregistrering."],
  "2.5.0": ["Fargevalg fungerer nå også i mørk modus.", "Nye oppdateringer får en endringslogg etter reload."],
  "2.6.0": ["Regelknapp på startsiden åpner komplett spillregler-modal."],
  "3.0.0": ["Appen ble migrert til Astro og Tailwind CSS.", "GitHub Pages-oppsett og oppdatert PWA-struktur."],
  "3.1.0": [
    "Synk med originalen: regler-modal, innstillinger og fargevalg.",
    "Juksregistrering og klikkbar spillhistorikk er nå med i Astro-versjonen.",
    "Service worker oppdaterer seg automatisk med changelog etter reload.",
  ],
  "3.2.0": [
    "Angre siste runde og raskere poengregistrering med +/-5-kontroller.",
    "Eksport og import av backup med validering og versjonert lagring.",
    "Ny sluttskjerm, bedre modaltilgjengelighet og tester for spillmotoren.",
  ],
};

const storage = window.localStorage;

let state = defaultState();
let settings = normalizeSettings({});
let historyEntries = [];
let editingRoundIndex = null;
let activeModal = null;
let focusReturnElement = null;

const refs = {};

function escHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function cacheRefs() {
  Object.assign(refs, {
    app: document.getElementById("app"),
    versionDisplay: document.getElementById("version-display"),
    versionDisplayRound: document.getElementById("version-display-round"),
    playerCountDisplay: document.getElementById("player-count-display"),
    playerNameList: document.getElementById("player-name-list"),
    statsContent: document.getElementById("stats-content"),
    scoreList: document.getElementById("player-score-list"),
    roundBadge: document.getElementById("round-badge"),
    roundSubmitError: document.getElementById("round-submit-error"),
    roundActionStatus: document.getElementById("round-action-status"),
    historyCount: document.getElementById("history-count"),
    historyList: document.getElementById("history-list"),
    levelOverviewSection: document.getElementById("level-overview-section"),
    modalConfirm: document.getElementById("modal-confirm"),
    modalEdit: document.getElementById("modal-edit"),
    modalRules: document.getElementById("modal-rules"),
    modalSettings: document.getElementById("modal-settings"),
    modalChangelog: document.getElementById("modal-changelog"),
    modalSummary: document.getElementById("modal-summary"),
    modalEditTitle: document.getElementById("modal-edit-title"),
    modalEditBody: document.getElementById("modal-edit-body"),
    modalEditError: document.getElementById("modal-edit-error"),
    settingsCheatToggle: document.getElementById("settings-cheat-toggle"),
    settingsCheatPoints: document.getElementById("settings-cheat-points"),
    settingsCheatPointsRow: document.getElementById("settings-cheat-points-row"),
    settingsDataStatus: document.getElementById("settings-data-status"),
    importDataInput: document.getElementById("import-data-input"),
    rulesLevelsGrid: document.getElementById("rules-levels-grid"),
    changelogBody: document.getElementById("modal-changelog-body"),
    summaryContent: document.getElementById("summary-content"),
    undoRoundButton: document.getElementById("btn-undo-round"),
    summaryContinue: document.getElementById("summary-continue"),
    summaryNewGame: document.getElementById("summary-new-game"),
  });
}

function loadPersistedData() {
  state = loadState(storage);
  settings = loadSettings(storage);
  historyEntries = loadHistory(storage);

  if (state.players.length >= MIN_PLAYERS) {
    state.playerCount = state.players.length;
  }

  saveState(storage, state);
  saveSettings(storage, settings);
  saveHistory(storage, historyEntries);
}

function persistState() {
  saveState(storage, state);
}

function persistSettings() {
  saveSettings(storage, settings);
}

function persistHistory() {
  saveHistory(storage, historyEntries);
}

function setStatus(element, message = "", tone = "info") {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.dataset.tone = tone;
  element.hidden = message === "";
  if ("style" in element) {
    element.style.display = message === "" ? "none" : "";
  }
}

function updateMetaThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    return;
  }

  const primary = getComputedStyle(document.documentElement)
    .getPropertyValue("--primary")
    .trim();
  meta.setAttribute("content", primary || "#2C5F2E");
}

function syncThemeFromSettings() {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = settings.theme === "dark" || (settings.theme === "auto" && prefersDark);
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  document.documentElement.dataset.color = settings.color;
  updateMetaThemeColor();
}

function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      'button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.disabled && !element.hidden && element.offsetParent !== null);
}

function openModal(modal, initialFocusSelector = null) {
  if (!modal) {
    return;
  }

  if (activeModal && activeModal !== modal) {
    closeModal(activeModal, false);
  }

  focusReturnElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  activeModal = modal;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  const target =
    (initialFocusSelector ? modal.querySelector(initialFocusSelector) : null) ??
    getFocusableElements(modal)[0] ??
    modal;

  requestAnimationFrame(() => {
    target.focus();
  });
}

function closeModal(modal, restoreFocus = true) {
  if (!modal) {
    return;
  }

  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");

  if (activeModal === modal) {
    activeModal = null;
  }

  if (!document.querySelector(".modal-overlay.open")) {
    document.body.classList.remove("modal-open");
  }

  if (restoreFocus && focusReturnElement) {
    focusReturnElement.focus();
  }

  if (!document.querySelector(".modal-overlay.open")) {
    focusReturnElement = null;
  }
}

function closeActiveModal() {
  if (activeModal) {
    closeModal(activeModal);
  }
}

function handleModalKeydown(event) {
  if (event.key === "Escape") {
    closeActiveModal();
    return;
  }

  if (event.key !== "Tab" || !activeModal) {
    return;
  }

  const focusable = getFocusableElements(activeModal);
  if (focusable.length === 0) {
    event.preventDefault();
    activeModal.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function setInputValidity(input, isValid) {
  input.classList.toggle("error", !isValid);
  input.setAttribute("aria-invalid", isValid ? "false" : "true");
}

function archiveCurrentGame() {
  const entry = buildHistoryEntry(state);
  if (!entry) {
    return;
  }

  historyEntries = [...historyEntries, entry].slice(-50);
  persistHistory();
}

function resetGame({ archive = true } = {}) {
  if (archive) {
    archiveCurrentGame();
  }

  state = defaultState();
  editingRoundIndex = null;
  persistState();
  showView("setup");
}

function formatRanking(entry) {
  if (Array.isArray(entry.ranking) && entry.ranking.length === entry.players.length) {
    return entry.ranking;
  }

  return entry.players
    .map((name, index) => ({
      name,
      total: entry.finalScores[index] ?? 0,
      level: entry.finalLevels[index] ?? 1,
    }))
    .sort(
      (a, b) =>
        b.level - a.level ||
        a.total - b.total ||
        a.name.localeCompare(b.name, "nb"),
    );
}

function renderSetup() {
  refs.playerCountDisplay.textContent = String(state.playerCount);
  const previousValues = Array.from(refs.playerNameList.querySelectorAll("input")).map(
    (element) => element.value,
  );
  const seededValues =
    previousValues.length > 0
      ? previousValues
      : state.players.map((player) => player.name);

  refs.playerNameList.innerHTML = "";

  for (let index = 0; index < state.playerCount; index += 1) {
    const row = document.createElement("div");
    row.className = "player-name-row";

    const label = document.createElement("label");
    label.htmlFor = `pname-${index}`;
    label.textContent = `Spiller ${index + 1}`;

    const input = document.createElement("input");
    input.id = `pname-${index}`;
    input.type = "text";
    input.placeholder = `Spiller ${index + 1}`;
    input.autocomplete = "off";
    input.value = seededValues[index] ?? "";

    row.appendChild(label);
    row.appendChild(input);
    refs.playerNameList.appendChild(row);
  }

  renderStats();
}

function renderStats() {
  refs.statsContent.innerHTML = "";

  if (historyEntries.length === 0) {
    refs.statsContent.innerHTML = '<p class="empty-state-copy">Ingen spill registrert ennå.</p>';
    return;
  }

  const playerStats = {};
  historyEntries.forEach((entry) => {
    entry.players.forEach((name, index) => {
      if (!playerStats[name]) {
        playerStats[name] = { games: 0, wins: 0, totalScore: 0 };
      }

      playerStats[name].games += 1;
      playerStats[name].totalScore += entry.finalScores[index] ?? 0;
      if (entry.winners.includes(name)) {
        playerStats[name].wins += 1;
      }
    });
  });

  const rows = Object.entries(playerStats).sort(
    (a, b) => b[1].wins - a[1].wins || a[0].localeCompare(b[0], "nb"),
  );

  const table = document.createElement("table");
  table.className = "stats-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Spiller</th>
        <th>Spill</th>
        <th>Seire</th>
        <th>Snittpoeng</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          ([name, entry]) => `
            <tr>
              <td>${escHtml(name)}</td>
              <td>${entry.games}</td>
              <td>${entry.wins}</td>
              <td>${(entry.totalScore / entry.games).toFixed(1)}</td>
            </tr>`,
        )
        .join("")}
    </tbody>
  `;
  refs.statsContent.appendChild(table);

  const recentLabel = document.createElement("div");
  recentLabel.className = "section-label";
  recentLabel.textContent = "Siste spill";
  refs.statsContent.appendChild(recentLabel);

  const recentList = document.createElement("div");
  [...historyEntries]
    .reverse()
    .slice(0, 5)
    .forEach((entry) => {
      const ranking = formatRanking(entry);
      const row = document.createElement("div");
      row.className = "past-game-row";

      const header = document.createElement("div");
      header.className = "past-game-row-header";

      const headerLeft = document.createElement("div");
      headerLeft.innerHTML = `
        <span class="past-game-winner">🏆 ${entry.winners.map(escHtml).join(" &amp; ")}</span>
        - ${entry.players.map(escHtml).join(", ")}
      `;

      const arrow = document.createElement("span");
      arrow.className = "past-game-arrow";
      arrow.textContent = "›";

      const meta = document.createElement("div");
      meta.className = "past-game-meta";
      meta.textContent = `${entry.date} · ${entry.rounds} runder`;

      const detail = document.createElement("div");
      detail.className = "past-game-detail";
      ranking.forEach((player) => {
        const line = document.createElement("div");
        line.className = "past-game-score-line";
        line.innerHTML = `
          <span>${escHtml(player.name)} · nivå ${player.level}</span>
          <span>${player.total} poeng${entry.winners.includes(player.name) ? " 🏆" : ""}</span>
        `;
        detail.appendChild(line);
      });

      header.appendChild(headerLeft);
      header.appendChild(arrow);
      row.appendChild(header);
      row.appendChild(meta);
      row.appendChild(detail);
      row.addEventListener("click", () => row.classList.toggle("open"));
      recentList.appendChild(row);
    });
  refs.statsContent.appendChild(recentList);

  const clearButton = document.createElement("button");
  clearButton.className = "btn-clear-history";
  clearButton.type = "button";
  clearButton.textContent = "Slett historikk";
  clearButton.addEventListener("click", () => {
    if (confirm("Slette all spillhistorikk?")) {
      historyEntries = [];
      clearHistory(storage);
      renderStats();
      setStatus(refs.settingsDataStatus, "Historikken er slettet.", "success");
    }
  });
  refs.statsContent.appendChild(clearButton);
}

function adjustScoreInput(input, delta) {
  const current = Number.parseInt(input.value || "0", 10);
  const nextValue = Math.max(0, (Number.isNaN(current) ? 0 : current) + delta);
  input.value = String(nextValue);
  setInputValidity(input, true);
}

function createScoreControls(index) {
  const controls = document.createElement("div");
  controls.className = "score-entry-controls";

  const decreaseButton = document.createElement("button");
  decreaseButton.className = "score-step-btn";
  decreaseButton.type = "button";
  decreaseButton.textContent = "-5";
  decreaseButton.setAttribute("aria-label", "Trekk fra fem poeng");

  const inputShell = document.createElement("div");
  inputShell.className = "score-input-shell";

  const input = document.createElement("input");
  input.type = "number";
  input.inputMode = "numeric";
  input.step = "5";
  input.min = "0";
  input.placeholder = "0";
  input.className = "score-input";
  input.dataset.playerIndex = String(index);
  input.setAttribute("aria-label", "Poeng denne runden");

  const increaseButton = document.createElement("button");
  increaseButton.className = "score-step-btn";
  increaseButton.type = "button";
  increaseButton.textContent = "+5";
  increaseButton.setAttribute("aria-label", "Legg til fem poeng");

  decreaseButton.addEventListener("click", () => adjustScoreInput(input, -5));
  increaseButton.addEventListener("click", () => adjustScoreInput(input, 5));

  inputShell.appendChild(input);
  controls.appendChild(decreaseButton);
  controls.appendChild(inputShell);
  controls.appendChild(increaseButton);
  return { controls, input };
}

function renderRound() {
  const roundNumber = state.rounds.length + 1;
  refs.roundBadge.textContent = `Runde ${roundNumber}`;
  refs.roundSubmitError.style.display = "none";
  refs.undoRoundButton.disabled = state.rounds.length === 0;

  const totals = getGameSummary(state).standings.reduce((map, entry) => {
    map[entry.index] = entry.total;
    return map;
  }, {});
  const sortedIndices = state.players
    .map((_, index) => index)
    .sort((a, b) => totals[a] - totals[b]);

  refs.scoreList.innerHTML = "";

  sortedIndices.forEach((index, position) => {
    const row = document.createElement("div");
    row.className = "player-score-row";

    if (roundNumber > 1) {
      if (position === 0) {
        row.classList.add("rank-first");
      }
      if (position === sortedIndices.length - 1 && sortedIndices.length > 1) {
        row.classList.add("rank-last");
      }
    }

    const rank = document.createElement("div");
    rank.className = "player-rank";
    rank.textContent = String(position + 1);

    const info = document.createElement("div");
    info.className = "player-info";

    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = state.players[index].name;

    const total = document.createElement("div");
    total.className = "player-total";
    total.textContent = roundNumber > 1 ? `${totals[index]} poeng` : "";

    const clearedId = `cleared-${index}`;
    const clearedLabel = document.createElement("label");
    clearedLabel.className = "level-cleared-label";
    clearedLabel.htmlFor = clearedId;

    const clearedCheck = document.createElement("input");
    clearedCheck.type = "checkbox";
    clearedCheck.className = "level-cleared-check";
    clearedCheck.id = clearedId;
    clearedCheck.dataset.playerIndex = String(index);

    clearedLabel.appendChild(clearedCheck);
    clearedLabel.appendChild(document.createTextNode("Klarte nivået"));

    info.appendChild(name);
    info.appendChild(total);
    info.appendChild(clearedLabel);

    if (settings.cheatEnabled) {
      const cheatId = `cheat-${index}`;
      const cheatLabel = document.createElement("label");
      cheatLabel.className = "level-cleared-label";
      cheatLabel.htmlFor = cheatId;

      const cheatCheck = document.createElement("input");
      cheatCheck.type = "checkbox";
      cheatCheck.className = "cheat-check";
      cheatCheck.id = cheatId;
      cheatCheck.dataset.playerIndex = String(index);

      cheatLabel.appendChild(cheatCheck);
      cheatLabel.appendChild(
        document.createTextNode(`Juks (+${settings.cheatPoints} poeng)`),
      );
      info.appendChild(cheatLabel);
    }

    const { controls, input } = createScoreControls(index);
    row.appendChild(rank);
    row.appendChild(info);
    row.appendChild(controls);
    refs.scoreList.appendChild(row);

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const inputs = Array.from(refs.scoreList.querySelectorAll(".score-input"));
        const currentIndex = inputs.indexOf(input);
        if (currentIndex >= 0 && currentIndex < inputs.length - 1) {
          inputs[currentIndex + 1].focus();
        } else {
          submitRound();
        }
      }
    });
  });

  renderLevelOverview();
  renderHistory();

  const firstInput = refs.scoreList.querySelector(".score-input");
  if (firstInput) {
    firstInput.focus();
  }
}

function renderLevelOverview() {
  const summary = getGameSummary(state);
  refs.levelOverviewSection.innerHTML = "";

  const container = document.createElement("div");
  container.className = "level-overview";

  const header = document.createElement("div");
  header.className = "level-overview-header";
  header.textContent = "Nivåoversikt";
  container.appendChild(header);

  summary.standings.forEach((entry) => {
    const level = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, entry.level - 1))];
    const isDone = entry.level >= LEVELS.length;

    const row = document.createElement("div");
    row.className = "level-overview-row";
    row.innerHTML = `
      <div>
        <div class="level-overview-name">${escHtml(entry.name)}</div>
        <div class="level-overview-desc">${escHtml(level.desc)} · maks ${level.trump} trumf</div>
      </div>
      <span class="level-overview-badge${isDone ? " level-done" : ""}">
        Nivå ${level.n}${isDone ? " ✓" : ""}
      </span>
    `;
    container.appendChild(row);
  });

  refs.levelOverviewSection.appendChild(container);
}

function renderHistory() {
  refs.historyCount.textContent = String(state.rounds.length);

  if (state.rounds.length === 0) {
    refs.historyList.innerHTML = "";
    return;
  }

  const rows = state.rounds
    .map((scores, roundIndex) => ({
      roundIndex,
      html: `
        <div class="history-round">
          <div class="history-round-header">
            <span class="history-round-num">Runde ${roundIndex + 1}</span>
            <button class="btn-edit-round" type="button" data-round="${roundIndex}">Rediger</button>
          </div>
          <div class="history-round-scores">
            ${state.players
              .map((player, playerIndex) => {
                const cleared = state.roundLevelCleared[roundIndex]?.[playerIndex] ?? false;
                return `
                  <span class="hist-player-score">
                    ${escHtml(player.name)}: <strong>${scores[playerIndex] ?? 0}</strong>${
                      cleared
                        ? '<span class="hist-cleared" title="Klarte nivået">✓</span>'
                        : ""
                    }
                  </span>`;
              })
              .join("")}
          </div>
        </div>`,
    }))
    .reverse();

  refs.historyList.innerHTML = rows.map((row) => row.html).join("");
  refs.historyList.querySelectorAll(".btn-edit-round").forEach((button) => {
    button.addEventListener("click", () => {
      openEditModal(Number.parseInt(button.dataset.round, 10));
    });
  });
}

function showView(viewId) {
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  document.getElementById(`view-${viewId}`)?.classList.add("active");
  state.view = viewId;
  persistState();

  if (viewId === "round") {
    renderRound();
  } else {
    renderSetup();
  }
}

function startGame() {
  const inputs = Array.from(refs.playerNameList.querySelectorAll("input"));
  const names = [];
  let valid = true;

  inputs.forEach((input) => {
    const value = input.value.trim();
    const isValid = value !== "";
    setInputValidity(input, isValid);
    if (isValid) {
      names.push(value);
    } else {
      valid = false;
    }
  });

  if (!valid) {
    return;
  }

  state = createGameState(names);
  persistState();
  showView("round");
}

function collectRoundPayload() {
  const scores = new Array(state.players.length);
  let valid = true;

  refs.scoreList.querySelectorAll(".score-input").forEach((input) => {
    const playerIndex = Number.parseInt(input.dataset.playerIndex, 10);
    const raw = input.value.trim();
    const score = Number.parseInt(raw, 10);
    const isValid = raw !== "" && !Number.isNaN(score) && score >= 0;

    setInputValidity(input, isValid);
    if (!isValid) {
      valid = false;
      return;
    }

    scores[playerIndex] = score;
  });

  if (!valid) {
    throw new Error("Fyll inn poeng (0 eller mer) for alle spillere.");
  }

  const cleared = new Array(state.players.length).fill(false);
  refs.scoreList.querySelectorAll(".level-cleared-check").forEach((checkbox) => {
    cleared[Number.parseInt(checkbox.dataset.playerIndex, 10)] = checkbox.checked;
  });

  if (settings.cheatEnabled) {
    refs.scoreList.querySelectorAll(".cheat-check").forEach((checkbox) => {
      if (checkbox.checked) {
        const playerIndex = Number.parseInt(checkbox.dataset.playerIndex, 10);
        scores[playerIndex] += settings.cheatPoints;
      }
    });
  }

  return { scores, cleared };
}

function submitRound() {
  try {
    const payload = collectRoundPayload();
    const result = addRound(state, payload);
    state = result.state;
    persistState();
    setStatus(refs.roundSubmitError, "");
    setStatus(refs.roundActionStatus, "", "info");
    showView("round");

    if (result.newWinners.length > 0) {
      openSummaryModal("winner", result.newWinners);
    }
  } catch (error) {
    setStatus(refs.roundSubmitError, error.message, "error");
  }
}

function undoLastRoundAction() {
  const result = undoLastRound(state);
  if (!result.removedRound) {
    setStatus(refs.roundActionStatus, "Ingen runder å angre ennå.", "info");
    return;
  }

  state = result.state;
  persistState();
  showView("round");
  setStatus(
    refs.roundActionStatus,
    `Siste runde ble angret. ${state.rounds.length} runder gjenstår.`,
    "success",
  );
}

function openEditModal(roundIndex) {
  editingRoundIndex = roundIndex;
  refs.modalEditTitle.textContent = `Rediger runde ${roundIndex + 1}`;
  setStatus(refs.modalEditError, "");
  refs.modalEditBody.innerHTML = "";

  state.players.forEach((player, playerIndex) => {
    const row = document.createElement("div");
    row.className = "edit-player-row";

    const name = document.createElement("span");
    name.className = "edit-player-name";
    name.textContent = player.name;

    const scoreInput = document.createElement("input");
    scoreInput.type = "number";
    scoreInput.inputMode = "numeric";
    scoreInput.className = "edit-score-input";
    scoreInput.id = `edit-score-${playerIndex}`;
    scoreInput.value = String(state.rounds[roundIndex][playerIndex] ?? 0);
    scoreInput.min = "0";

    const clearedLabel = document.createElement("label");
    clearedLabel.className = "edit-cleared-label";

    const clearedCheck = document.createElement("input");
    clearedCheck.type = "checkbox";
    clearedCheck.id = `edit-cleared-${playerIndex}`;
    clearedCheck.checked = state.roundLevelCleared[roundIndex]?.[playerIndex] ?? false;

    clearedLabel.appendChild(clearedCheck);
    clearedLabel.appendChild(document.createTextNode("Klarte"));
    row.appendChild(name);
    row.appendChild(scoreInput);
    row.appendChild(clearedLabel);
    refs.modalEditBody.appendChild(row);
  });

  openModal(refs.modalEdit, ".edit-score-input");
}

function saveEditedRound() {
  if (editingRoundIndex === null) {
    return;
  }

  try {
    const scores = state.players.map((_, playerIndex) => {
      const input = document.getElementById(`edit-score-${playerIndex}`);
      const value = Number.parseInt(input.value, 10);
      const isValid = !Number.isNaN(value) && value >= 0;
      setInputValidity(input, isValid);

      if (!isValid) {
        throw new Error("Fyll inn gyldige poeng (0 eller mer) for alle spillere.");
      }

      return value;
    });

    const cleared = state.players.map((_, playerIndex) =>
      document.getElementById(`edit-cleared-${playerIndex}`).checked,
    );

    state = updateRound(state, editingRoundIndex, { scores, cleared });
    editingRoundIndex = null;
    persistState();
    closeModal(refs.modalEdit);
    showView("round");
  } catch (error) {
    setStatus(refs.modalEditError, error.message, "error");
  }
}

function deleteRoundAction() {
  if (editingRoundIndex === null) {
    return;
  }

  state = deleteRound(state, editingRoundIndex);
  editingRoundIndex = null;
  persistState();
  closeModal(refs.modalEdit);
  showView("round");
  setStatus(refs.roundActionStatus, "Runden ble slettet.", "success");
}

function populateRulesGrid() {
  if (refs.rulesLevelsGrid.childElementCount > 0) {
    return;
  }

  LEVELS.forEach((level) => {
    const number = document.createElement("span");
    number.className = "lvl-n";
    number.textContent = String(level.n);

    const desc = document.createElement("span");
    desc.textContent = level.desc;

    const trump = document.createElement("span");
    trump.className = "lvl-trump";
    trump.textContent = level.trump > 0 ? `${level.trump} trumf` : "";

    refs.rulesLevelsGrid.appendChild(number);
    refs.rulesLevelsGrid.appendChild(desc);
    refs.rulesLevelsGrid.appendChild(trump);
  });
}

function openRulesModal() {
  populateRulesGrid();
  openModal(refs.modalRules, "#modal-rules-close");
}

function openSettingsModal() {
  refs.modalSettings.querySelectorAll(".theme-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.themeVal === settings.theme);
  });

  refs.modalSettings.querySelectorAll(".color-swatch").forEach((button) => {
    button.classList.toggle("active", button.dataset.colorVal === settings.color);
  });

  refs.settingsCheatToggle.checked = settings.cheatEnabled;
  refs.settingsCheatPoints.value = String(settings.cheatPoints);
  refs.settingsCheatPointsRow.style.display = settings.cheatEnabled ? "flex" : "none";
  if (activeModal !== refs.modalSettings) {
    openModal(refs.modalSettings, "#modal-settings-close");
  }
}

function applyThemePreference(theme) {
  settings.theme = theme;
  persistSettings();
  syncThemeFromSettings();
}

function applyColor(color) {
  settings.color = color;
  persistSettings();
  syncThemeFromSettings();
}

function compareVersions(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);

  for (let index = 0; index < 3; index += 1) {
    if ((a[index] ?? 0) !== (b[index] ?? 0)) {
      return (a[index] ?? 0) - (b[index] ?? 0);
    }
  }

  return 0;
}

function openChangelogModal(entries) {
  refs.changelogBody.innerHTML = "";

  entries.forEach(([version, items]) => {
    const heading = document.createElement("p");
    heading.className = "changelog-version";
    heading.textContent = `v${version}`;

    const list = document.createElement("ul");
    list.className = "changelog-list";

    items.forEach((item) => {
      const line = document.createElement("li");
      line.textContent = item;
      list.appendChild(line);
    });

    refs.changelogBody.appendChild(heading);
    refs.changelogBody.appendChild(list);
  });

  openModal(refs.modalChangelog, "#modal-changelog-close");
}

function checkChangelog() {
  const lastSeen = loadLastVersion(storage);
  if (!lastSeen) {
    saveLastVersion(storage, VERSION);
    return;
  }

  if (lastSeen === VERSION) {
    return;
  }

  const entries = Object.entries(CHANGELOG)
    .filter(
      ([version]) =>
        compareVersions(version, lastSeen) > 0 && compareVersions(version, VERSION) <= 0,
    )
    .sort((a, b) => compareVersions(a[0], b[0]));

  saveLastVersion(storage, VERSION);
  if (entries.length > 0) {
    openChangelogModal(entries);
  }
}

function buildSummaryMarkup(reason, highlightedWinners) {
  const summary = getGameSummary(state);
  const winners = highlightedWinners.length > 0 ? highlightedWinners : summary.winners;
  const winnerLine =
    winners.length > 0
      ? winners.join(" og ")
      : summary.standings[0]?.name ?? "Ingen leder ennå";

  const title = reason === "winner" ? "Spillet har en vinner" : "Avslutte spillet nå?";
  const lead =
    reason === "winner"
      ? `${winnerLine} nådde toppen og kan feires med en ordentlig sluttskjerm.`
      : `${winnerLine} ligger best an dersom dere avslutter spillet nå.`;

  return `
    <p id="modal-summary-title" class="modal-title">${escHtml(title)}</p>
    <p class="summary-lead">${escHtml(lead)}</p>
    <div class="summary-pill-row">
      <span class="summary-pill">${summary.rounds} runder</span>
      <span class="summary-pill">Høyeste nivå ${summary.highestLevel}</span>
      <span class="summary-pill">${summary.totalPoints} totalpoeng</span>
    </div>
    <div class="summary-card">
      <div class="summary-card-title">Stillingen akkurat nå</div>
      <div class="summary-standings">
        ${summary.standings
          .map(
            (entry, index) => `
              <div class="summary-standing-row${summary.winners.includes(entry.name) ? " is-winner" : ""}">
                <span class="summary-standing-rank">${index + 1}</span>
                <span class="summary-standing-name">${escHtml(entry.name)}</span>
                <span class="summary-standing-level">Nivå ${entry.level}</span>
                <span class="summary-standing-total">${entry.total} poeng</span>
              </div>`,
          )
          .join("")}
      </div>
    </div>
    <div class="summary-metrics">
      <div class="summary-metric">
        <span class="summary-metric-label">Beste runde</span>
        <strong>${summary.bestRoundTotal} poeng totalt</strong>
      </div>
      <div class="summary-metric">
        <span class="summary-metric-label">Siste runde</span>
        <strong>${summary.lastRoundTotal} poeng totalt</strong>
      </div>
      <div class="summary-metric">
        <span class="summary-metric-label">Ferdige spillere</span>
        <strong>${summary.completedPlayers.length > 0 ? escHtml(summary.completedPlayers.join(", ")) : "Ingen ennå"}</strong>
      </div>
    </div>
  `;
}

function openSummaryModal(reason, highlightedWinners = []) {
  refs.summaryContent.innerHTML = buildSummaryMarkup(reason, highlightedWinners);
  refs.summaryContinue.textContent = "Fortsett spillet";
  refs.summaryNewGame.textContent = reason === "winner" ? "Nytt spill" : "Avslutt og start nytt";
  openModal(refs.modalSummary, "#summary-continue");
}

function exportBackup() {
  const payload = buildBackupPayload({
    state,
    history: historyEntries,
    settings,
    lastVersion: loadLastVersion(storage),
    appVersion: VERSION,
  });
  const blob = new Blob([stringifyBackup(payload)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `11ern-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus(refs.settingsDataStatus, "Backup eksportert som JSON.", "success");
}

async function importBackupFromFile(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const backup = parseBackup(await file.text());
    state = normalizeState(backup.state);
    settings = normalizeSettings(backup.settings);
    historyEntries = backup.history;
    editingRoundIndex = null;

    persistState();
    persistSettings();
    persistHistory();
    saveLastVersion(storage, backup.lastVersion ?? VERSION);
    syncThemeFromSettings();
    setStatus(
      refs.settingsDataStatus,
      `Backup importert. ${historyEntries.length} avsluttede spill og ${state.rounds.length} aktive runder lastet inn.`,
      "success",
    );
    closeModal(refs.modalSettings, false);
    showView(state.players.length >= MIN_PLAYERS && state.view === "round" ? "round" : "setup");
  } catch (error) {
    setStatus(refs.settingsDataStatus, error.message, "error");
  } finally {
    refs.importDataInput.value = "";
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  navigator.serviceWorker.register(`${BASE_URL}sw.js`).catch(() => {
    // Service worker registration is optional.
  });

  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!reloading) {
      reloading = true;
      window.location.reload();
    }
  });
}

function bindEvents() {
  document.addEventListener("keydown", handleModalKeydown);

  document.getElementById("players-dec").addEventListener("click", () => {
    if (state.playerCount > MIN_PLAYERS) {
      state.playerCount -= 1;
      persistState();
      renderSetup();
    }
  });

  document.getElementById("players-inc").addEventListener("click", () => {
    if (state.playerCount < MAX_PLAYERS) {
      state.playerCount += 1;
      persistState();
      renderSetup();
    }
  });

  document.getElementById("btn-start-game").addEventListener("click", startGame);
  document.getElementById("btn-submit-round").addEventListener("click", submitRound);
  refs.undoRoundButton.addEventListener("click", undoLastRoundAction);

  document.getElementById("btn-rules").addEventListener("click", openRulesModal);
  document.getElementById("btn-settings-setup").addEventListener("click", openSettingsModal);
  document.getElementById("btn-settings-round").addEventListener("click", openSettingsModal);

  refs.modalRules.addEventListener("click", (event) => {
    if (event.target === refs.modalRules) {
      closeModal(refs.modalRules);
    }
  });
  document.getElementById("modal-rules-close").addEventListener("click", () => {
    closeModal(refs.modalRules);
  });

  refs.modalSettings.addEventListener("click", (event) => {
    if (event.target === refs.modalSettings) {
      closeModal(refs.modalSettings);
    }
  });
  document.getElementById("modal-settings-close").addEventListener("click", () => {
    closeModal(refs.modalSettings);
  });

  refs.modalChangelog.addEventListener("click", (event) => {
    if (event.target === refs.modalChangelog) {
      closeModal(refs.modalChangelog);
    }
  });
  document.getElementById("modal-changelog-close").addEventListener("click", () => {
    closeModal(refs.modalChangelog);
  });

  refs.modalEdit.addEventListener("click", (event) => {
    if (event.target === refs.modalEdit) {
      closeModal(refs.modalEdit);
    }
  });
  document.getElementById("modal-edit-save").addEventListener("click", saveEditedRound);
  document.getElementById("modal-edit-cancel").addEventListener("click", () => {
    editingRoundIndex = null;
    closeModal(refs.modalEdit);
  });
  document.getElementById("modal-edit-delete").addEventListener("click", deleteRoundAction);

  refs.modalConfirm.addEventListener("click", (event) => {
    if (event.target === refs.modalConfirm) {
      closeModal(refs.modalConfirm);
    }
  });
  document.getElementById("modal-no").addEventListener("click", () => {
    closeModal(refs.modalConfirm);
  });
  document.getElementById("modal-yes").addEventListener("click", () => {
    closeModal(refs.modalConfirm, false);
    resetGame({ archive: false });
  });

  refs.modalSummary.addEventListener("click", (event) => {
    if (event.target === refs.modalSummary) {
      closeModal(refs.modalSummary);
    }
  });
  refs.summaryContinue.addEventListener("click", () => {
    closeModal(refs.modalSummary);
  });
  refs.summaryNewGame.addEventListener("click", () => {
    closeModal(refs.modalSummary, false);
    resetGame({ archive: true });
  });

  document.getElementById("btn-new-game-round").addEventListener("click", () => {
    if (state.rounds.length > 0) {
      openSummaryModal("manual");
      return;
    }

    openModal(refs.modalConfirm, "#modal-yes");
  });

  refs.modalSettings.querySelectorAll(".theme-btn").forEach((button) => {
    button.addEventListener("click", () => {
      applyThemePreference(button.dataset.themeVal);
      openSettingsModal();
    });
  });

  refs.modalSettings.querySelectorAll(".color-swatch").forEach((button) => {
    button.addEventListener("click", () => {
      applyColor(button.dataset.colorVal);
      openSettingsModal();
    });
  });

  refs.settingsCheatToggle.addEventListener("change", (event) => {
    settings.cheatEnabled = event.target.checked;
    refs.settingsCheatPointsRow.style.display = settings.cheatEnabled ? "flex" : "none";
    persistSettings();
    if (state.view === "round") {
      renderRound();
    }
  });

  refs.settingsCheatPoints.addEventListener("change", (event) => {
    const value = Number.parseInt(event.target.value, 10);
    if (!Number.isNaN(value) && value > 0) {
      settings.cheatPoints = value;
      persistSettings();
      if (state.view === "round" && settings.cheatEnabled) {
        renderRound();
      }
      return;
    }

    event.target.value = String(settings.cheatPoints);
  });

  document.getElementById("btn-export-data").addEventListener("click", exportBackup);
  document.getElementById("btn-import-data").addEventListener("click", () => {
    refs.importDataInput.click();
  });
  refs.importDataInput.addEventListener("change", importBackupFromFile);

  const themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
  themeMedia.addEventListener("change", () => {
    if (settings.theme === "auto") {
      syncThemeFromSettings();
    }
  });
}

function init() {
  cacheRefs();
  document.querySelectorAll(".modal-overlay").forEach((modal) => {
    modal.setAttribute("aria-hidden", "true");
    modal.tabIndex = -1;
  });
  loadPersistedData();
  syncThemeFromSettings();

  refs.versionDisplay.textContent = `v${VERSION}`;
  refs.versionDisplayRound.textContent = `v${VERSION}`;
  setStatus(refs.roundActionStatus, "");
  setStatus(
    refs.settingsDataStatus,
    "Eksporterer aktivt spill, historikk og innstillinger som JSON.",
  );

  bindEvents();

  if (state.players.length >= MIN_PLAYERS && state.view === "round") {
    showView("round");
  } else {
    showView("setup");
  }

  checkChangelog();
  registerServiceWorker();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
