import {
  GRID_SIZE,
  DIRECTIONS,
  FOOD_TYPES,
  createInitialState,
  setDirection,
  tick,
  togglePause,
  restartGame
} from "./snakeLogic.js";

const GAME_PHASES = {
  setup: "setup",
  countdown: "countdown",
  playing: "playing",
  gameover: "gameover",
  stats: "stats"
};

const SPEED_CONFIG = {
  slow: { label: "Slow-mo", tickMs: 190 },
  speedy: { label: "Speedy", tickMs: 120 },
  rocket: { label: "Rocket", tickMs: 80 }
};

const CONTROL_MODES = {
  buttons: "buttons",
  swipe: "swipe"
};

const gameBoard = document.querySelector("[data-game-board]");
const scoreValue = document.querySelector("[data-score]");
const statusValue = document.querySelector("[data-status]");
const timeValue = document.querySelector("[data-time]");
const pauseButton = document.querySelector("[data-pause]");
const restartButton = document.querySelector("[data-restart]");
const installButton = document.querySelector("[data-install]");
const startButton = document.querySelector("[data-start]");
const nextButton = document.querySelector("[data-next]");
const setupSections = document.querySelectorAll("[data-setup]");
const statsPanel = document.querySelector("[data-stats]");
const timeSelect = document.querySelector("[data-time-select]");
const speedSelect = document.querySelector("[data-speed-select]");
const controlSelect = document.querySelector("[data-control-select]");
const countdownOverlay = document.querySelector("[data-countdown-overlay]");
const countdownValue = document.querySelector("[data-countdown-value]");
const statTime = document.querySelector("[data-stat-time]");
const statSpeed = document.querySelector("[data-stat-speed]");
const statSilver = document.querySelector("[data-stat-silver]");
const statGolden = document.querySelector("[data-stat-golden]");
const statScore = document.querySelector("[data-stat-score]");

let state = createInitialState();
let deferredInstallPrompt = null;
let trailParticles = [];
let phase = GAME_PHASES.setup;

let selectedDurationSeconds = Number(timeSelect?.value || 60);
let remainingTimeSeconds = selectedDurationSeconds;
let elapsedTimeSeconds = 0;
let selectedSpeedKey = speedSelect?.value || "speedy";
let selectedControlMode = controlSelect?.value || CONTROL_MODES.buttons;
let gameEndReason = "";

let movementIntervalId = null;
let timerIntervalId = null;
let countdownIntervalId = null;

let swipeStartPoint = null;
let cellElements = [];

function positionsEqual(a, b) {
  return a.x === b.x && a.y === b.y;
}

function hasNeighbor(snake, segment, dx, dy) {
  return snake.some((part) => part.x === segment.x + dx && part.y === segment.y + dy);
}

function pushTrailFromMove(prevState, nextState) {
  const prevTail = prevState.snake[prevState.snake.length - 1];
  const isTailStillOccupied = nextState.snake.some((part) => positionsEqual(part, prevTail));
  if (isTailStillOccupied) return;

  trailParticles.push({ x: prevTail.x, y: prevTail.y, life: 3 });
  if (trailParticles.length > 30) {
    trailParticles = trailParticles.slice(trailParticles.length - 30);
  }
}

function decayTrail() {
  trailParticles = trailParticles
    .map((particle) => ({ ...particle, life: particle.life - 1 }))
    .filter((particle) => particle.life > 0);
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.max(0, totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function setPhase(nextPhase) {
  phase = nextPhase;
  updatePhaseVisibility();
}

function updatePhaseVisibility() {
  const isSetupPhase = phase === GAME_PHASES.setup;
  for (const section of setupSections) {
    section.classList.toggle("hidden", !isSetupPhase);
  }

  if (countdownOverlay) {
    countdownOverlay.classList.toggle("active", phase === GAME_PHASES.countdown);
  }

  if (nextButton) {
    nextButton.classList.toggle("hidden", phase !== GAME_PHASES.gameover);
  }

  if (statsPanel) {
    statsPanel.classList.toggle("hidden", phase !== GAME_PHASES.stats);
  }
}

function buildBoard() {
  gameBoard.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 1fr)`;
  gameBoard.style.gridTemplateRows = `repeat(${GRID_SIZE}, 1fr)`;

  for (const oldCell of gameBoard.querySelectorAll(".cell")) {
    oldCell.remove();
  }

  const overlay = countdownOverlay;
  const fragment = document.createDocumentFragment();
  cellElements = [];

  const totalCells = GRID_SIZE * GRID_SIZE;
  for (let i = 0; i < totalCells; i += 1) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cellElements.push(cell);
    fragment.append(cell);
  }

  if (overlay) {
    gameBoard.insertBefore(fragment, overlay);
  } else {
    gameBoard.append(fragment);
  }
}

function renderFood(cells) {
  if (!state.food) return;

  const index = state.food.y * GRID_SIZE + state.food.x;
  if (!cells[index]) return;

  cells[index].classList.add("food");
  if (state.foodType === FOOD_TYPES.silver) {
    cells[index].classList.add("food-silver");
  } else if (state.foodType === FOOD_TYPES.golden) {
    cells[index].classList.add("food-golden");
  }
}

function renderSnake(cells) {
  for (let i = 0; i < state.snake.length; i += 1) {
    const segment = state.snake[i];
    const index = segment.y * GRID_SIZE + segment.x;
    const cell = cells[index];
    if (!cell) continue;

    cell.classList.add("snake");

    const connectUp = hasNeighbor(state.snake, segment, 0, -1);
    const connectDown = hasNeighbor(state.snake, segment, 0, 1);
    const connectLeft = hasNeighbor(state.snake, segment, -1, 0);
    const connectRight = hasNeighbor(state.snake, segment, 1, 0);

    if (connectUp) cell.classList.add("snake-connect-up");
    if (connectDown) cell.classList.add("snake-connect-down");
    if (connectLeft) cell.classList.add("snake-connect-left");
    if (connectRight) cell.classList.add("snake-connect-right");

    if (i === 0) {
      cell.classList.add("snake-head");
      if (state.direction === DIRECTIONS.up) cell.classList.add("snake-head-up");
      if (state.direction === DIRECTIONS.down) cell.classList.add("snake-head-down");
      if (state.direction === DIRECTIONS.left) cell.classList.add("snake-head-left");
      if (state.direction === DIRECTIONS.right) cell.classList.add("snake-head-right");
    }

    if (i === state.snake.length - 1) {
      cell.classList.add("snake-tail");
    }
  }
}

function renderTrail(cells) {
  for (const particle of trailParticles) {
    const index = particle.y * GRID_SIZE + particle.x;
    if (!cells[index]) continue;
    cells[index].classList.add("trail", `trail-${particle.life}`);
  }
}

function getStatusText() {
  if (phase === GAME_PHASES.setup) return "Ready";
  if (phase === GAME_PHASES.countdown) return "Countdown";
  if (phase === GAME_PHASES.stats) return "Stats";
  if (phase === GAME_PHASES.gameover) {
    return gameEndReason === "timer" ? "Time up" : "Game over";
  }
  if (state.paused) return "Paused";
  return "Running";
}

function renderStats() {
  if (phase !== GAME_PHASES.stats) return;

  statTime.textContent = `${elapsedTimeSeconds}s`;
  statSpeed.textContent = SPEED_CONFIG[selectedSpeedKey].label;
  statSilver.textContent = String(state.silverCollected);
  statGolden.textContent = String(state.goldenCollected);
  statScore.textContent = String(state.score);
}

function render() {
  const cells = cellElements;
  for (let i = 0; i < cells.length; i += 1) {
    cells[i].className = "cell";
  }

  renderTrail(cells);
  renderSnake(cells);
  renderFood(cells);

  scoreValue.textContent = String(state.score);
  statusValue.textContent = getStatusText();
  timeValue.textContent = formatTime(remainingTimeSeconds);
  renderStats();
}

function stopMovementLoop() {
  if (movementIntervalId) {
    clearInterval(movementIntervalId);
    movementIntervalId = null;
  }
}

function stopTimerLoop() {
  if (timerIntervalId) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
}

function stopCountdownLoop() {
  if (countdownIntervalId) {
    clearInterval(countdownIntervalId);
    countdownIntervalId = null;
  }
}

function stopAllLoops() {
  stopMovementLoop();
  stopTimerLoop();
  stopCountdownLoop();
}

function startMovementLoop() {
  stopMovementLoop();
  movementIntervalId = setInterval(step, SPEED_CONFIG[selectedSpeedKey].tickMs);
}

function startTimerLoop() {
  stopTimerLoop();
  timerIntervalId = setInterval(() => {
    if (phase !== GAME_PHASES.playing || state.paused) return;

    remainingTimeSeconds -= 1;
    elapsedTimeSeconds += 1;

    if (remainingTimeSeconds <= 0) {
      remainingTimeSeconds = 0;
      render();
      endGame("timer");
      return;
    }

    render();
  }, 1000);
}

function startPlayingPhase() {
  setPhase(GAME_PHASES.playing);
  startMovementLoop();
  startTimerLoop();
  render();
}

function startCountdownPhase() {
  stopAllLoops();
  setPhase(GAME_PHASES.countdown);

  const steps = ["3", "2", "1", "GO"];
  let index = 0;
  countdownValue.textContent = steps[index];

  countdownIntervalId = setInterval(() => {
    index += 1;
    if (index < steps.length) {
      countdownValue.textContent = steps[index];
      return;
    }

    stopCountdownLoop();
    startPlayingPhase();
  }, 800);
}

function prepareNewRound() {
  state = restartGame();
  trailParticles = [];
  gameEndReason = "";
  elapsedTimeSeconds = 0;

  selectedDurationSeconds = Number(timeSelect?.value || 60);
  remainingTimeSeconds = selectedDurationSeconds;
  selectedSpeedKey = speedSelect?.value || "speedy";
  if (!SPEED_CONFIG[selectedSpeedKey]) selectedSpeedKey = "speedy";

  selectedControlMode = controlSelect?.value || CONTROL_MODES.buttons;
  if (!Object.values(CONTROL_MODES).includes(selectedControlMode)) {
    selectedControlMode = CONTROL_MODES.buttons;
  }
}

function showStatsScreen() {
  setPhase(GAME_PHASES.stats);
  render();
}

function endGame(reason) {
  if (phase === GAME_PHASES.gameover || phase === GAME_PHASES.stats) return;

  stopAllLoops();
  gameEndReason = reason;
  state = {
    ...state,
    gameOver: true,
    paused: false
  };
  setPhase(GAME_PHASES.gameover);
  render();
}

function resetToSetup() {
  stopAllLoops();
  prepareNewRound();
  setPhase(GAME_PHASES.setup);
  render();
}

function step() {
  if (phase !== GAME_PHASES.playing) return;

  const previousState = state;
  const nextState = tick(state);

  if (nextState !== state) {
    decayTrail();
    pushTrailFromMove(previousState, nextState);
  }

  state = nextState;

  if (state.gameOver) {
    endGame("collision");
    return;
  }

  render();
}

function handleDirectionInput(direction, source = "buttons") {
  if (phase !== GAME_PHASES.playing) return;

  if (selectedControlMode === CONTROL_MODES.swipe && source !== "swipe") return;
  if (selectedControlMode === CONTROL_MODES.buttons && source === "swipe") return;

  state = setDirection(state, direction);
}

function handleKeyDown(event) {
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", " ", "r"].includes(key)) {
    event.preventDefault();
  }

  if (key === "arrowup" || key === "w") handleDirectionInput(DIRECTIONS.up, "key");
  if (key === "arrowdown" || key === "s") handleDirectionInput(DIRECTIONS.down, "key");
  if (key === "arrowleft" || key === "a") handleDirectionInput(DIRECTIONS.left, "key");
  if (key === "arrowright" || key === "d") handleDirectionInput(DIRECTIONS.right, "key");

  if (key === " " && phase === GAME_PHASES.playing) {
    state = togglePause(state);
  }

  if (key === "r") {
    resetToSetup();
  }

  render();
}

function handleControlClick(event) {
  const action = event.currentTarget.dataset.action;
  if (action === "up") handleDirectionInput(DIRECTIONS.up, "buttons");
  if (action === "down") handleDirectionInput(DIRECTIONS.down, "buttons");
  if (action === "left") handleDirectionInput(DIRECTIONS.left, "buttons");
  if (action === "right") handleDirectionInput(DIRECTIONS.right, "buttons");
  render();
}

function beginSwipe(x, y, event) {
  if (selectedControlMode !== CONTROL_MODES.swipe) return;
  swipeStartPoint = { x, y };
  if (event) event.preventDefault();
}

function moveSwipe(event) {
  if (selectedControlMode !== CONTROL_MODES.swipe) return;
  if (swipeStartPoint && event) event.preventDefault();
}

function endSwipe(x, y, event) {
  if (selectedControlMode !== CONTROL_MODES.swipe || !swipeStartPoint) return;
  if (event) event.preventDefault();

  const deltaX = x - swipeStartPoint.x;
  const deltaY = y - swipeStartPoint.y;
  swipeStartPoint = null;

  const threshold = 24;
  if (Math.abs(deltaX) < threshold && Math.abs(deltaY) < threshold) return;

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    if (deltaX > 0) handleDirectionInput(DIRECTIONS.right, "swipe");
    else handleDirectionInput(DIRECTIONS.left, "swipe");
  } else {
    if (deltaY > 0) handleDirectionInput(DIRECTIONS.down, "swipe");
    else handleDirectionInput(DIRECTIONS.up, "swipe");
  }

  render();
}

function attachSwipeHandlers() {
  gameBoard.addEventListener(
    "touchstart",
    (event) => {
      const touch = event.touches[0];
      if (!touch) return;
      beginSwipe(touch.clientX, touch.clientY, event);
    },
    { passive: false }
  );

  gameBoard.addEventListener(
    "touchmove",
    (event) => {
      moveSwipe(event);
    },
    { passive: false }
  );

  gameBoard.addEventListener(
    "touchend",
    (event) => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      endSwipe(touch.clientX, touch.clientY, event);
    },
    { passive: false }
  );

  gameBoard.addEventListener("mousedown", (event) => {
    beginSwipe(event.clientX, event.clientY);
  });

  gameBoard.addEventListener("mouseup", (event) => {
    endSwipe(event.clientX, event.clientY);
  });
}

document.addEventListener("keydown", handleKeyDown);

pauseButton.addEventListener("click", () => {
  if (phase !== GAME_PHASES.playing) return;
  state = togglePause(state);
  render();
});

restartButton.addEventListener("click", () => {
  resetToSetup();
});

for (const button of document.querySelectorAll("[data-action]")) {
  button.addEventListener("click", handleControlClick);
}

startButton?.addEventListener("click", () => {
  prepareNewRound();
  startCountdownPhase();
  render();
});

nextButton?.addEventListener("click", () => {
  showStatsScreen();
});

if (timeSelect) {
  timeSelect.addEventListener("change", () => {
    if (phase !== GAME_PHASES.setup) return;
    selectedDurationSeconds = Number(timeSelect.value);
    remainingTimeSeconds = selectedDurationSeconds;
    render();
  });
}

if (speedSelect) {
  speedSelect.addEventListener("change", () => {
    selectedSpeedKey = speedSelect.value;
  });
}

if (controlSelect) {
  controlSelect.addEventListener("change", () => {
    selectedControlMode = controlSelect.value;
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then((registration) => {
      registration.update();
    });
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  if (installButton) installButton.hidden = false;
});

if (installButton) {
  installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installButton.hidden = true;
  });
}

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  if (installButton) installButton.hidden = true;
});

buildBoard();
attachSwipeHandlers();
resetToSetup();
