const VERSION = "3.1.0";
const STORAGE_KEY = "11ern_state";
const HISTORY_KEY = "11ern_history";
const SETTINGS_KEY = "11ern_settings";
const LAST_VERSION_KEY = "11ern_last_version";
const LEGACY_THEME_KEY = "11ern_theme";
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;
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
};

const LEVELS = [
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

let state = defaultState();
let editingRoundIndex = null;
let settings = loadSettings();

function defaultState() {
  return {
    view: "setup",
    playerCount: 4,
    players: [],
    rounds: [],
    playerLevels: [],
    roundLevelCleared: [],
  };
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const legacyTheme = localStorage.getItem(LEGACY_THEME_KEY);
    const cheatPoints = Number.parseInt(parsed.cheatPoints, 10);

    return {
      theme: parsed.theme ?? legacyTheme ?? "auto",
      color: parsed.color ?? "green",
      cheatEnabled: parsed.cheatEnabled ?? false,
      cheatPoints: Number.isNaN(cheatPoints) || cheatPoints < 1 ? 10 : cheatPoints,
    };
  } catch {
    return {
      theme: "auto",
      color: "green",
      cheatEnabled: false,
      cheatPoints: 10,
    };
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage failures.
  }
}

function prefersDarkMode() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function syncThemeFromSettings() {
  const isDark = settings.theme === "dark" || (settings.theme === "auto" && prefersDarkMode());
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  document.documentElement.dataset.color = settings.color;
}

function initTheme() {
  syncThemeFromSettings();
}

function applyThemePreference(themePreference) {
  settings.theme = themePreference;
  syncThemeFromSettings();
  saveSettings();
}

function applyColor(color) {
  settings.color = color;
  document.documentElement.dataset.color = color;
  saveSettings();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures.
  }
}

function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const saved = JSON.parse(raw);
    if (!saved || !Array.isArray(saved.players) || saved.players.length < MIN_PLAYERS) {
      return null;
    }

    if (!Array.isArray(saved.rounds)) {
      saved.rounds = [];
    }

    if (!Array.isArray(saved.playerLevels) || saved.playerLevels.length !== saved.players.length) {
      saved.playerLevels = new Array(saved.players.length).fill(1);
    }

    if (
      !Array.isArray(saved.roundLevelCleared) ||
      saved.roundLevelCleared.length !== saved.rounds.length
    ) {
      saved.roundLevelCleared = saved.rounds.map(
        () => new Array(saved.players.length).fill(false),
      );
    }

    return saved;
  } catch {
    return null;
  }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveGameToHistory() {
  if (state.rounds.length === 0) {
    return;
  }

  const totals = getTotals();
  const minScore = Math.min(...totals);
  const winners = state.players
    .filter((_, index) => totals[index] === minScore)
    .map((player) => player.name);

  const entry = {
    id: Date.now(),
    date: new Date().toLocaleDateString("nb-NO"),
    players: state.players.map((player) => player.name),
    finalScores: totals,
    finalLevels: [...state.playerLevels],
    rounds: state.rounds.length,
    winners,
  };

  try {
    const history = loadHistory();
    history.push(entry);
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Ignore storage failures.
  }
}

function escHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getTotals() {
  return state.players.map((_, index) =>
    state.rounds.reduce((sum, round) => sum + (round[index] ?? 0), 0),
  );
}

function recalculateLevels() {
  state.playerLevels = new Array(state.players.length).fill(1);
  state.roundLevelCleared.forEach((clearedRound) => {
    clearedRound.forEach((didClear, index) => {
      if (didClear && state.playerLevels[index] < LEVELS.length) {
        state.playerLevels[index] += 1;
      }
    });
  });
}

function rerenderCurrentView() {
  if (state.view === "round") {
    renderRound();
  } else {
    renderSetup();
  }
}

function showView(viewId) {
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  document.getElementById(`view-${viewId}`)?.classList.add("active");
  state.view = viewId;
  saveState();
  renders[viewId]?.();
}

function renderSetup() {
  document.getElementById("player-count-display").textContent = String(state.playerCount);
  const list = document.getElementById("player-name-list");
  const existing = list.querySelectorAll("input");
  const oldValues = Array.from(existing).map((element) => element.value);

  list.innerHTML = "";

  for (let index = 0; index < state.playerCount; index += 1) {
    const row = document.createElement("div");
    row.className = "player-name-row";

    const label = document.createElement("label");
    label.textContent = `Spiller ${index + 1}`;
    label.htmlFor = `pname-${index}`;

    const input = document.createElement("input");
    input.type = "text";
    input.id = `pname-${index}`;
    input.placeholder = `Spiller ${index + 1}`;
    input.value = oldValues[index] ?? "";
    input.autocomplete = "off";

    row.appendChild(label);
    row.appendChild(input);
    list.appendChild(row);
  }

  renderStats();
}

function renderStats() {
  const history = loadHistory();
  const content = document.getElementById("stats-content");
  content.innerHTML = "";

  if (history.length === 0) {
    content.innerHTML = '<p class="empty-state-copy">Ingen spill registrert ennå.</p>';
    return;
  }

  const playerStats = {};
  history.forEach((game) => {
    game.players.forEach((name, index) => {
      if (!playerStats[name]) {
        playerStats[name] = { games: 0, wins: 0, totalScore: 0 };
      }

      playerStats[name].games += 1;
      playerStats[name].totalScore += game.finalScores[index] ?? 0;
      if (game.winners.includes(name)) {
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
  content.appendChild(table);

  const recentLabel = document.createElement("div");
  recentLabel.className = "section-label";
  recentLabel.textContent = "Siste spill";
  content.appendChild(recentLabel);

  const recentList = document.createElement("div");
  [...history]
    .reverse()
    .slice(0, 5)
    .forEach((game) => {
      const row = document.createElement("div");
      row.className = "past-game-row";

      const header = document.createElement("div");
      header.className = "past-game-row-header";

      const headerLeft = document.createElement("div");
      headerLeft.innerHTML = `
        <span class="past-game-winner">🏆 ${game.winners.map(escHtml).join(" &amp; ")}</span>
        - ${game.players.map(escHtml).join(", ")}
      `;

      const arrow = document.createElement("span");
      arrow.className = "past-game-arrow";
      arrow.textContent = "›";

      const meta = document.createElement("div");
      meta.className = "past-game-meta";
      meta.textContent = `${game.date} · ${game.rounds} runder`;

      const detail = document.createElement("div");
      detail.className = "past-game-detail";
      game.players
        .map((name, index) => ({ name, score: game.finalScores[index] ?? 0 }))
        .sort((a, b) => a.score - b.score)
        .forEach(({ name, score }) => {
          const line = document.createElement("div");
          line.className = "past-game-score-line";
          const isWinner = game.winners.includes(name);
          line.innerHTML = `
            <span>${escHtml(name)}</span>
            <span>${score} poeng${isWinner ? " 🏆" : ""}</span>
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
  content.appendChild(recentList);

  const clearButton = document.createElement("button");
  clearButton.className = "btn-clear-history";
  clearButton.textContent = "Slett historikk";
  clearButton.addEventListener("click", () => {
    if (confirm("Slette all spillhistorikk?")) {
      localStorage.removeItem(HISTORY_KEY);
      renderStats();
    }
  });
  content.appendChild(clearButton);
}

function renderRound() {
  const roundNumber = state.rounds.length + 1;
  document.getElementById("round-badge").textContent = `Runde ${roundNumber}`;
  document.getElementById("round-submit-error").style.display = "none";

  const totals = getTotals();
  const sortedIndices = state.players
    .map((_, index) => index)
    .sort((a, b) => totals[a] - totals[b]);

  const list = document.getElementById("player-score-list");
  list.innerHTML = "";

  sortedIndices.forEach((index, position) => {
    const player = state.players[index];
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
    name.textContent = player.name;

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

    const input = document.createElement("input");
    input.type = "number";
    input.inputMode = "numeric";
    input.className = "score-input";
    input.dataset.playerIndex = String(index);
    input.value = "";
    input.placeholder = "0";
    input.min = "0";

    row.appendChild(rank);
    row.appendChild(info);
    row.appendChild(input);
    list.appendChild(row);
  });

  renderLevelOverview();
  renderHistory();

  const inputs = list.querySelectorAll(".score-input");
  inputs.forEach((input, index) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (index < inputs.length - 1) {
          inputs[index + 1].focus();
        } else {
          submitRound();
        }
      }
    });
  });

  if (inputs.length > 0) {
    inputs[0].focus();
  }
}

function renderLevelOverview() {
  const section = document.getElementById("level-overview-section");
  section.innerHTML = "";

  const container = document.createElement("div");
  container.className = "level-overview";

  const header = document.createElement("div");
  header.className = "level-overview-header";
  header.textContent = "Nivåoversikt";
  container.appendChild(header);

  const sortedPlayers = state.players
    .map((player, index) => ({ name: player.name, level: state.playerLevels[index] ?? 1 }))
    .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, "nb"));

  sortedPlayers.forEach((entry) => {
    const level = LEVELS[entry.level - 1];
    const done = entry.level >= LEVELS.length;

    const row = document.createElement("div");
    row.className = "level-overview-row";

    const leftColumn = document.createElement("div");

    const name = document.createElement("div");
    name.className = "level-overview-name";
    name.textContent = entry.name;

    const description = document.createElement("div");
    description.className = "level-overview-desc";
    description.textContent = `${level.desc} · maks ${level.trump} trumf`;

    const badge = document.createElement("span");
    badge.className = `level-overview-badge${done ? " level-done" : ""}`;
    badge.textContent = done ? `Nivå ${level.n} ✓` : `Nivå ${level.n}`;

    leftColumn.appendChild(name);
    leftColumn.appendChild(description);
    row.appendChild(leftColumn);
    row.appendChild(badge);
    container.appendChild(row);
  });

  section.appendChild(container);
}

function renderHistory() {
  const count = document.getElementById("history-count");
  const list = document.getElementById("history-list");
  count.textContent = String(state.rounds.length);

  if (state.rounds.length === 0) {
    list.innerHTML = "";
    return;
  }

  const rows = state.rounds
    .map((scores, roundIndex) => {
      const playerScores = state.players
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
        .join("");

      return {
        roundIndex,
        html: `
          <div class="history-round">
            <div class="history-round-header">
              <span class="history-round-num">Runde ${roundIndex + 1}</span>
              <button class="btn-edit-round" data-round="${roundIndex}">Rediger</button>
            </div>
            <div class="history-round-scores">${playerScores}</div>
          </div>`,
      };
    })
    .reverse();

  list.innerHTML = rows.map((row) => row.html).join("");
  list.querySelectorAll(".btn-edit-round").forEach((button) => {
    button.addEventListener("click", () => {
      openEditModal(Number.parseInt(button.dataset.round, 10));
    });
  });
}

function startGame() {
  const inputs = document.querySelectorAll("#player-name-list input");
  let valid = true;
  const names = [];

  inputs.forEach((input) => {
    const value = input.value.trim();
    if (!value) {
      input.classList.add("error");
      valid = false;
    } else {
      input.classList.remove("error");
      names.push(value);
    }
  });

  if (!valid) {
    return;
  }

  state.players = names.map((name) => ({ name }));
  state.rounds = [];
  state.roundLevelCleared = [];
  state.playerLevels = new Array(names.length).fill(1);
  saveState();
  showView("round");
}

function submitRound() {
  const inputs = document.querySelectorAll("#player-score-list .score-input");
  const error = document.getElementById("round-submit-error");
  const scores = new Array(state.players.length);
  let valid = true;

  inputs.forEach((input) => {
    const playerIndex = Number.parseInt(input.dataset.playerIndex, 10);
    const raw = input.value.trim();

    if (raw === "") {
      input.classList.add("error");
      valid = false;
      return;
    }

    const score = Number.parseInt(raw, 10);
    if (Number.isNaN(score) || score < 0) {
      input.classList.add("error");
      valid = false;
      return;
    }

    input.classList.remove("error");
    scores[playerIndex] = score;
  });

  if (!valid) {
    error.textContent = "Fyll inn poeng (0 eller mer) for alle spillere.";
    error.style.display = "";
    return;
  }

  error.style.display = "none";

  const clearedThisRound = new Array(state.players.length).fill(false);
  document.querySelectorAll(".level-cleared-check").forEach((checkbox) => {
    clearedThisRound[Number.parseInt(checkbox.dataset.playerIndex, 10)] = checkbox.checked;
  });

  if (settings.cheatEnabled) {
    document.querySelectorAll(".cheat-check").forEach((checkbox) => {
      if (checkbox.checked) {
        const playerIndex = Number.parseInt(checkbox.dataset.playerIndex, 10);
        scores[playerIndex] += settings.cheatPoints;
      }
    });
  }

  const levelsBeforeSubmit = [...state.playerLevels];

  state.rounds.push(scores);
  state.roundLevelCleared.push(clearedThisRound);
  recalculateLevels();
  saveState();

  const newWinners = state.players
    .filter((_, index) => clearedThisRound[index] && levelsBeforeSubmit[index] === LEVELS.length)
    .map((player) => player.name);

  showView("round");
  if (newWinners.length > 0) {
    showWinnerModal(newWinners);
  }
}

function resetGame() {
  saveGameToHistory();
  state = defaultState();
  saveState();
  showView("setup");
}

function openEditModal(roundIndex) {
  editingRoundIndex = roundIndex;
  document.getElementById("modal-edit-title").textContent = `Rediger runde ${roundIndex + 1}`;
  document.getElementById("modal-edit-error").style.display = "none";

  const body = document.getElementById("modal-edit-body");
  body.innerHTML = "";

  state.players.forEach((player, playerIndex) => {
    const score = state.rounds[roundIndex][playerIndex] ?? 0;
    const cleared = state.roundLevelCleared[roundIndex]?.[playerIndex] ?? false;

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
    scoreInput.value = String(score);
    scoreInput.min = "0";

    const clearedLabel = document.createElement("label");
    clearedLabel.className = "edit-cleared-label";

    const clearedCheck = document.createElement("input");
    clearedCheck.type = "checkbox";
    clearedCheck.id = `edit-cleared-${playerIndex}`;
    clearedCheck.checked = cleared;

    clearedLabel.appendChild(clearedCheck);
    clearedLabel.appendChild(document.createTextNode("Klarte"));

    row.appendChild(name);
    row.appendChild(scoreInput);
    row.appendChild(clearedLabel);
    body.appendChild(row);
  });

  document.getElementById("modal-edit").classList.add("open");
  body.querySelector(".edit-score-input")?.focus();
}

function hideEditModal() {
  editingRoundIndex = null;
  document.getElementById("modal-edit").classList.remove("open");
}

function saveEditedRound() {
  if (editingRoundIndex === null) {
    return;
  }

  const error = document.getElementById("modal-edit-error");
  let valid = true;

  const newScores = state.players.map((_, playerIndex) => {
    const input = document.getElementById(`edit-score-${playerIndex}`);
    const value = Number.parseInt(input.value, 10);

    if (Number.isNaN(value) || value < 0) {
      input.classList.add("error");
      valid = false;
      return 0;
    }

    input.classList.remove("error");
    return value;
  });

  if (!valid) {
    error.textContent = "Fyll inn gyldige poeng (0 eller mer) for alle spillere.";
    error.style.display = "";
    return;
  }

  error.style.display = "none";

  state.rounds[editingRoundIndex] = newScores;
  state.roundLevelCleared[editingRoundIndex] = state.players.map((_, playerIndex) =>
    document.getElementById(`edit-cleared-${playerIndex}`).checked,
  );

  recalculateLevels();
  saveState();
  hideEditModal();
  renderRound();
}

function deleteRound() {
  if (editingRoundIndex === null) {
    return;
  }

  state.rounds.splice(editingRoundIndex, 1);
  state.roundLevelCleared.splice(editingRoundIndex, 1);
  recalculateLevels();
  saveState();
  hideEditModal();
  renderRound();
}

function showWinnerModal(names) {
  document.getElementById("winner-content").innerHTML = `
    <div class="winner-emoji">🎉</div>
    <div class="winner-name">${names.map(escHtml).join(" &amp; ")}</div>
    <div class="winner-sub">Fullførte alle 11 nivåer!</div>
  `;
  document.getElementById("modal-winner").classList.add("open");
}

function openRulesModal() {
  const grid = document.getElementById("rules-levels-grid");
  if (!grid.hasChildNodes()) {
    LEVELS.forEach((level) => {
      const levelNumber = document.createElement("span");
      levelNumber.className = "lvl-n";
      levelNumber.textContent = String(level.n);

      const desc = document.createElement("span");
      desc.textContent = level.desc;

      const trump = document.createElement("span");
      trump.className = "lvl-trump";
      trump.textContent = level.trump > 0 ? `${level.trump} trumf` : "";

      grid.appendChild(levelNumber);
      grid.appendChild(desc);
      grid.appendChild(trump);
    });
  }

  document.getElementById("modal-rules").classList.add("open");
}

function hideRulesModal() {
  document.getElementById("modal-rules").classList.remove("open");
}

function openSettingsModal() {
  document.querySelectorAll(".theme-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.themeVal === settings.theme);
  });

  document.querySelectorAll(".color-swatch").forEach((button) => {
    button.classList.toggle("active", button.dataset.colorVal === settings.color);
  });

  document.getElementById("settings-cheat-toggle").checked = settings.cheatEnabled;
  document.getElementById("settings-cheat-points").value = String(settings.cheatPoints);
  document.getElementById("settings-cheat-points-row").style.display = settings.cheatEnabled
    ? "flex"
    : "none";
  document.getElementById("modal-settings").classList.add("open");
}

function hideSettingsModal() {
  document.getElementById("modal-settings").classList.remove("open");
}

function showConfirmModal() {
  document.getElementById("modal-confirm").classList.add("open");
  document.getElementById("modal-yes").focus();
}

function hideConfirmModal() {
  document.getElementById("modal-confirm").classList.remove("open");
}

function compareVersions(a, b) {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);

  for (let index = 0; index < 3; index += 1) {
    if ((left[index] ?? 0) !== (right[index] ?? 0)) {
      return (left[index] ?? 0) - (right[index] ?? 0);
    }
  }

  return 0;
}

function openChangelogModal(entries) {
  const body = document.getElementById("modal-changelog-body");
  body.innerHTML = "";

  entries.forEach(([version, items]) => {
    const versionLabel = document.createElement("p");
    versionLabel.className = "changelog-version";
    versionLabel.textContent = `v${version}`;

    const list = document.createElement("ul");
    list.className = "changelog-list";

    items.forEach((item) => {
      const line = document.createElement("li");
      line.textContent = item;
      list.appendChild(line);
    });

    body.appendChild(versionLabel);
    body.appendChild(list);
  });

  document.getElementById("modal-changelog").classList.add("open");
}

function checkChangelog() {
  const lastSeen = localStorage.getItem(LAST_VERSION_KEY);
  if (!lastSeen) {
    localStorage.setItem(LAST_VERSION_KEY, VERSION);
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

  localStorage.setItem(LAST_VERSION_KEY, VERSION);
  if (entries.length > 0) {
    openChangelogModal(entries);
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
  document.getElementById("btn-rules").addEventListener("click", openRulesModal);
  document.getElementById("modal-rules-close").addEventListener("click", hideRulesModal);
  document.getElementById("modal-rules").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      hideRulesModal();
    }
  });

  document.querySelectorAll(".btn-settings:not(#btn-rules)").forEach((button) => {
    button.addEventListener("click", openSettingsModal);
  });

  document.querySelectorAll(".theme-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.dataset.themeVal;
      applyThemePreference(value);
      document.querySelectorAll(".theme-btn").forEach((item) => {
        item.classList.toggle("active", item.dataset.themeVal === settings.theme);
      });
    });
  });

  document.querySelectorAll(".color-swatch").forEach((button) => {
    button.addEventListener("click", () => {
      applyColor(button.dataset.colorVal);
      document.querySelectorAll(".color-swatch").forEach((item) => {
        item.classList.toggle("active", item.dataset.colorVal === settings.color);
      });
    });
  });

  document.getElementById("settings-cheat-toggle").addEventListener("change", (event) => {
    settings.cheatEnabled = event.target.checked;
    document.getElementById("settings-cheat-points-row").style.display = settings.cheatEnabled
      ? "flex"
      : "none";
    saveSettings();
    if (state.view === "round") {
      renderRound();
    }
  });

  document.getElementById("settings-cheat-points").addEventListener("change", (event) => {
    const value = Number.parseInt(event.target.value, 10);
    if (!Number.isNaN(value) && value > 0) {
      settings.cheatPoints = value;
      saveSettings();
      if (state.view === "round" && settings.cheatEnabled) {
        renderRound();
      }
      return;
    }

    event.target.value = String(settings.cheatPoints);
  });

  document.getElementById("modal-settings-close").addEventListener("click", hideSettingsModal);
  document.getElementById("modal-settings").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      hideSettingsModal();
    }
  });

  document.getElementById("players-dec").addEventListener("click", () => {
    if (state.playerCount > MIN_PLAYERS) {
      state.playerCount -= 1;
      renderSetup();
    }
  });

  document.getElementById("players-inc").addEventListener("click", () => {
    if (state.playerCount < MAX_PLAYERS) {
      state.playerCount += 1;
      renderSetup();
    }
  });

  document.getElementById("btn-start-game").addEventListener("click", startGame);
  document.getElementById("btn-submit-round").addEventListener("click", submitRound);
  document.getElementById("btn-new-game-round").addEventListener("click", showConfirmModal);

  document.getElementById("modal-yes").addEventListener("click", () => {
    hideConfirmModal();
    resetGame();
  });
  document.getElementById("modal-no").addEventListener("click", hideConfirmModal);
  document.getElementById("modal-confirm").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      hideConfirmModal();
    }
  });

  document.getElementById("modal-edit-save").addEventListener("click", saveEditedRound);
  document.getElementById("modal-edit-cancel").addEventListener("click", hideEditModal);
  document.getElementById("modal-edit-delete").addEventListener("click", deleteRound);
  document.getElementById("modal-edit").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      hideEditModal();
    }
  });

  document.getElementById("winner-continue").addEventListener("click", () => {
    document.getElementById("modal-winner").classList.remove("open");
  });
  document.getElementById("winner-new-game").addEventListener("click", () => {
    document.getElementById("modal-winner").classList.remove("open");
    showConfirmModal();
  });

  document.getElementById("modal-changelog-close").addEventListener("click", () => {
    document.getElementById("modal-changelog").classList.remove("open");
  });
  document.getElementById("modal-changelog").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      document.getElementById("modal-changelog").classList.remove("open");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideEditModal();
      hideConfirmModal();
      hideSettingsModal();
      hideRulesModal();
      document.getElementById("modal-winner").classList.remove("open");
      document.getElementById("modal-changelog").classList.remove("open");
    }
  });

  const themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
  const handleThemeChange = () => {
    if (settings.theme === "auto") {
      syncThemeFromSettings();
    }
  };

  themeMedia.addEventListener("change", handleThemeChange);
}

const renders = {
  setup: renderSetup,
  round: renderRound,
};

function init() {
  initTheme();
  document.getElementById("version-display").textContent = `v${VERSION}`;
  document.getElementById("version-display-round").textContent = `v${VERSION}`;
  bindEvents();

  const saved = loadSavedState();
  if (saved) {
    state = { ...defaultState(), ...saved };
    if (state.players.length >= MIN_PLAYERS) {
      state.playerCount = state.players.length;
    }
    const savedView = state.view === "standings" ? "round" : state.view || "setup";
    showView(savedView);
  } else {
    showView("setup");
  }

  checkChangelog();
  rerenderCurrentView();
  registerServiceWorker();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
