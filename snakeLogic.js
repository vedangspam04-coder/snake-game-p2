export const GRID_SIZE = 16;

export const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

export const FOOD_TYPES = {
  normal: "normal",
  silver: "silver",
  golden: "golden"
};

export function createInitialState(randomFn = Math.random) {
  const snake = [
    { x: 8, y: 8 },
    { x: 7, y: 8 },
    { x: 6, y: 8 }
  ];

  return {
    gridSize: GRID_SIZE,
    snake,
    direction: DIRECTIONS.right,
    nextDirection: DIRECTIONS.right,
    food: placeFood(GRID_SIZE, snake, randomFn),
    foodType: FOOD_TYPES.normal,
    score: 0,
    normalFoodEatenCount: 0,
    silverCollected: 0,
    goldenCollected: 0,
    gameOver: false,
    paused: false
  };
}

export function setDirection(state, direction) {
  if (state.gameOver) return state;
  if (isOppositeDirection(state.direction, direction)) return state;
  return {
    ...state,
    nextDirection: direction
  };
}

export function togglePause(state) {
  if (state.gameOver) return state;
  return {
    ...state,
    paused: !state.paused
  };
}

export function restartGame(randomFn = Math.random) {
  return createInitialState(randomFn);
}

export function tick(state, randomFn = Math.random) {
  if (state.gameOver || state.paused) return state;

  const direction = state.nextDirection;
  const currentHead = state.snake[0];
  const rawNewHead = {
    x: currentHead.x + direction.x,
    y: currentHead.y + direction.y
  };
  const newHead = wrapPosition(rawNewHead, state.gridSize);

  const isEating = positionsEqual(newHead, state.food);
  const grownSnake = [newHead, ...state.snake];
  const nextSnake = isEating ? grownSnake : grownSnake.slice(0, -1);

  if (hasSelfCollision(nextSnake)) {
    return {
      ...state,
      direction,
      snake: nextSnake,
      gameOver: true
    };
  }

  let nextFood = state.food;
  let nextFoodType = state.foodType;
  let nextScore = state.score;
  let nextNormalFoodEatenCount = state.normalFoodEatenCount;
  let nextSilverCollected = state.silverCollected;
  let nextGoldenCollected = state.goldenCollected;
  let nextGameOver = false;

  if (isEating) {
    if (state.foodType === FOOD_TYPES.normal) {
      nextScore += 1;
      nextNormalFoodEatenCount += 1;
      nextFoodType = getNextFoodType(nextNormalFoodEatenCount);
    } else if (state.foodType === FOOD_TYPES.silver) {
      nextScore += 5;
      nextSilverCollected += 1;
      nextFoodType = FOOD_TYPES.normal;
    } else if (state.foodType === FOOD_TYPES.golden) {
      nextScore += 10;
      nextGoldenCollected += 1;
      nextFoodType = FOOD_TYPES.normal;
    }
    nextFood = placeFood(state.gridSize, nextSnake, randomFn);
    if (nextFood === null) {
      nextGameOver = true;
    }
  }

  return {
    ...state,
    direction,
    snake: nextSnake,
    food: nextFood,
    foodType: nextFoodType,
    score: nextScore,
    normalFoodEatenCount: nextNormalFoodEatenCount,
    silverCollected: nextSilverCollected,
    goldenCollected: nextGoldenCollected,
    gameOver: nextGameOver
  };
}

export function placeFood(gridSize, snake, randomFn = Math.random) {
  const occupied = new Set(snake.map((segment) => `${segment.x},${segment.y}`));
  const freeCells = [];

  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      const key = `${x},${y}`;
      if (!occupied.has(key)) freeCells.push({ x, y });
    }
  }

  if (freeCells.length === 0) return null;
  const index = Math.floor(randomFn() * freeCells.length);
  return freeCells[index];
}

function hasSelfCollision(snake) {
  const [head, ...body] = snake;
  return body.some((segment) => positionsEqual(head, segment));
}

function wrapPosition(position, gridSize) {
  return {
    x: (position.x + gridSize) % gridSize,
    y: (position.y + gridSize) % gridSize
  };
}

function getNextFoodType(normalFoodEatenCount) {
  if (normalFoodEatenCount > 0 && normalFoodEatenCount % 10 === 0) {
    return FOOD_TYPES.golden;
  }

  if (normalFoodEatenCount > 0 && normalFoodEatenCount % 5 === 0) {
    return FOOD_TYPES.silver;
  }

  return FOOD_TYPES.normal;
}

function isOppositeDirection(a, b) {
  return a.x + b.x === 0 && a.y + b.y === 0;
}

export function positionsEqual(a, b) {
  return a.x === b.x && a.y === b.y;
}
