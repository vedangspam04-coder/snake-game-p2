import {
  GRID_SIZE,
  DIRECTIONS,
  createInitialState,
  setDirection,
  tick,
  togglePause,
  restartGame
} from "./snakeLogic.js";

const gameBoard = document.querySelector("[data-game-board]");
const scoreValue = document.querySelector("[data-score]");
const statusValue = document.querySelector("[data-status]");
const pauseButton = document.querySelector("[data-pause]");
const restartButton = document.querySelector("[data-restart]");
const installButton = document.querySelector("[data-install]");

let state = createInitialState();
let deferredInstallPrompt = null;
let trailParticles = [];

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

function buildBoard() {
  gameBoard.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 1fr)`;
  gameBoard.style.gridTemplateRows = `repeat(${GRID_SIZE}, 1fr)`;

  const totalCells = GRID_SIZE * GRID_SIZE;
  for (let i = 0; i < totalCells; i += 1) {
    const cell = document.createElement("div");
    cell.className = "cell";
    gameBoard.append(cell);
  }
}

function render() {
  const cells = gameBoard.children;
  for (let i = 0; i < cells.length; i += 1) {
    cells[i].className = "cell";
  }

  for (const particle of trailParticles) {
    const index = particle.y * GRID_SIZE + particle.x;
    if (!cells[index]) continue;
    cells[index].classList.add("trail", `trail-${particle.life}`);
  }

  for (let i = 0; i < state.snake.length; i += 1) {
    const segment = state.snake[i];
    const index = segment.y * GRID_SIZE + segment.x;
    const cell = cells[index];
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

  if (state.food) {
    const index = state.food.y * GRID_SIZE + state.food.x;
    cells[index].classList.add("food");
  }

  scoreValue.textContent = String(state.score);
  if (state.gameOver) {
    statusValue.textContent = "Game over";
  } else if (state.paused) {
    statusValue.textContent = "Paused";
  } else {
    statusValue.textContent = "Running";
  }
}

function step() {
  const previousState = state;
  const nextState = tick(state);
  if (nextState !== state) {
    decayTrail();
    pushTrailFromMove(previousState, nextState);
  }
  state = nextState;
  render();
}

function handleDirectionInput(direction) {
  state = setDirection(state, direction);
}

function handleKeyDown(event) {
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", " ", "r"].includes(key)) {
    event.preventDefault();
  }

  if (key === "arrowup" || key === "w") handleDirectionInput(DIRECTIONS.up);
  if (key === "arrowdown" || key === "s") handleDirectionInput(DIRECTIONS.down);
  if (key === "arrowleft" || key === "a") handleDirectionInput(DIRECTIONS.left);
  if (key === "arrowright" || key === "d") handleDirectionInput(DIRECTIONS.right);
  if (key === " ") state = togglePause(state);
  if (key === "r") state = restartGame();

  render();
}

function handleControlClick(event) {
  const action = event.currentTarget.dataset.action;
  if (action === "up") handleDirectionInput(DIRECTIONS.up);
  if (action === "down") handleDirectionInput(DIRECTIONS.down);
  if (action === "left") handleDirectionInput(DIRECTIONS.left);
  if (action === "right") handleDirectionInput(DIRECTIONS.right);
  render();
}

document.addEventListener("keydown", handleKeyDown);
pauseButton.addEventListener("click", () => {
  state = togglePause(state);
  render();
});

restartButton.addEventListener("click", () => {
  state = restartGame();
  trailParticles = [];
  render();
});

for (const button of document.querySelectorAll("[data-action]")) {
  button.addEventListener("click", handleControlClick);
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
render();
setInterval(step, 120);
