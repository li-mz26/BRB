const COLS = 16;
const ROWS = 30;
const BLOCK = 24;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold');
const holdCtx = holdCanvas.getContext('2d');

const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');
const comboEl = document.getElementById('combo');
const bombsEl = document.getElementById('bombs');
const restartBtn = document.getElementById('restart');

const palette = {
  I: '#b8b3c8',
  O: '#d6be9f',
  T: '#c7a7b8',
  S: '#b2c5b2',
  Z: '#d0a6a0',
  J: '#a7bbcf',
  L: '#c9ae95'
};

const tetrominoes = {
  I: [[1, 1, 1, 1]],
  O: [
    [1, 1],
    [1, 1]
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1]
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0]
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1]
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1]
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1]
  ]
};

const board = createBoard();
let player = null;
let nextType = randomType();
let holdType = null;
let score = 0;
let lines = 0;
let level = 1;
let combo = 0;
let bombs = 0;
let bombMilestone = 0;
let dropCounter = 0;
let dropInterval = 900;
let lastTime = 0;
let paused = false;
let gameOver = false;
let canHold = true;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function randomType() {
  const types = Object.keys(tetrominoes);
  return types[Math.floor(Math.random() * types.length)];
}

function cloneMatrix(matrix) {
  return matrix.map((row) => [...row]);
}

function createPiece(type) {
  return {
    type,
    matrix: cloneMatrix(tetrominoes[type]),
    pos: { x: Math.floor((COLS - tetrominoes[type][0].length) / 2), y: 0 }
  };
}

function spawnPiece() {
  const type = nextType;
  nextType = randomType();
  player = createPiece(type);
  canHold = true;

  if (collide(board, player)) {
    gameOver = true;
  }

  drawNext();
  drawHold();
}

function rotate(matrix) {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      rotated[x][rows - 1 - y] = matrix[y][x];
    }
  }

  return rotated;
}

function collide(arena, piece) {
  for (let y = 0; y < piece.matrix.length; y += 1) {
    for (let x = 0; x < piece.matrix[y].length; x += 1) {
      if (piece.matrix[y][x] !== 0) {
        const px = x + piece.pos.x;
        const py = y + piece.pos.y;
        if (px < 0 || px >= COLS || py >= ROWS || (py >= 0 && arena[py][px] !== 0)) {
          return true;
        }
      }
    }
  }
  return false;
}

function merge(arena, piece) {
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        arena[y + piece.pos.y][x + piece.pos.x] = piece.type;
      }
    });
  });
}

function clearLines() {
  let cleared = 0;

  outer: for (let y = ROWS - 1; y >= 0; y -= 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (board[y][x] === 0) {
        continue outer;
      }
    }

    const row = board.splice(y, 1)[0].fill(0);
    board.unshift(row);
    cleared += 1;
    y += 1;
  }

  if (cleared > 0) {
    const baseScore = [0, 120, 360, 620, 900][Math.min(cleared, 4)] * level;
    combo += 1;
    const comboBonus = combo > 1 ? combo * 40 * level : 0;
    score += baseScore + comboBonus;
    lines += cleared;
    level = Math.floor(lines / 12) + 1;
    dropInterval = Math.max(140, 900 - (level - 1) * 55);

    const newMilestone = Math.floor(lines / 5);
    if (newMilestone > bombMilestone) {
      bombs += newMilestone - bombMilestone;
      bombMilestone = newMilestone;
    }
  } else {
    combo = 0;
  }

  updateStats();
}

function lockPiece() {
  merge(board, player);
  clearLines();
  spawnPiece();
}

function playerMove(dir) {
  if (paused || gameOver) return;
  player.pos.x += dir;
  if (collide(board, player)) {
    player.pos.x -= dir;
  }
}

function playerDrop() {
  if (paused || gameOver) return;
  player.pos.y += 1;
  if (collide(board, player)) {
    player.pos.y -= 1;
    lockPiece();
  }
  dropCounter = 0;
}

function hardDrop() {
  if (paused || gameOver) return;
  while (!collide(board, player)) {
    player.pos.y += 1;
  }
  player.pos.y -= 1;
  lockPiece();
  dropCounter = 0;
}

function playerRotate() {
  if (paused || gameOver) return;
  const oldMatrix = player.matrix;
  const rotated = rotate(player.matrix);
  player.matrix = rotated;

  const offsets = [0, -1, 1, -2, 2];
  for (const offset of offsets) {
    player.pos.x += offset;
    if (!collide(board, player)) {
      return;
    }
    player.pos.x -= offset;
  }

  player.matrix = oldMatrix;
}

function holdPiece() {
  if (paused || gameOver || !canHold) return;

  const currentType = player.type;
  if (holdType === null) {
    holdType = currentType;
    spawnPiece();
  } else {
    const swapType = holdType;
    holdType = currentType;
    player = createPiece(swapType);
    if (collide(board, player)) {
      gameOver = true;
    }
    drawHold();
  }

  canHold = false;
}

function activateBomb() {
  if (paused || gameOver || bombs <= 0) return;

  bombs -= 1;
  const centerX = player.pos.x + Math.floor(player.matrix[0].length / 2);
  const centerY = player.pos.y + Math.floor(player.matrix.length / 2);
  let removed = 0;

  for (let y = centerY - 2; y <= centerY + 2; y += 1) {
    for (let x = centerX - 2; x <= centerX + 2; x += 1) {
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS && board[y][x] !== 0) {
        board[y][x] = 0;
        removed += 1;
      }
    }
  }

  score += removed * 25 * level;
  combo = 0;
  updateStats();
}

function drawCell(context, x, y, color, size) {
  const px = x * size;
  const py = y * size;

  context.fillStyle = color;
  context.fillRect(px, py, size, size);

  context.strokeStyle = 'rgba(84, 62, 70, 0.22)';
  context.strokeRect(px, py, size, size);

  context.fillStyle = 'rgba(255, 255, 255, 0.35)';
  context.fillRect(px + 2, py + 2, size - 4, 4);
  context.fillRect(px + 2, py + 2, 4, size - 4);

  context.fillStyle = 'rgba(70, 46, 56, 0.2)';
  context.fillRect(px + size - 4, py + 4, 2, size - 6);
  context.fillRect(px + 4, py + size - 4, size - 6, 2);

  context.fillStyle = 'rgba(255, 255, 255, 0.13)';
  context.fillRect(px + 6, py + 6, size - 12, size - 12);
}

function drawMatrix(context, matrix, offset, color, size, alpha = 1) {
  context.save();
  context.globalAlpha = alpha;
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        drawCell(context, x + offset.x, y + offset.y, color, size);
      }
    });
  });
  context.restore();
}

function drawBoardBackdrop() {
  const grid = BLOCK;
  ctx.fillStyle = '#f9e9eb';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(153, 98, 117, 0.12)';
  ctx.lineWidth = 1;

  for (let x = 0; x <= canvas.width; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= canvas.height; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(canvas.width, y + 0.5);
    ctx.stroke();
  }
}

function getGhostPosition() {
  const ghost = {
    matrix: player.matrix,
    pos: { x: player.pos.x, y: player.pos.y }
  };

  while (!collide(board, ghost)) {
    ghost.pos.y += 1;
  }
  ghost.pos.y -= 1;
  return ghost.pos;
}

function drawBoard() {
  drawBoardBackdrop();

  board.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        drawCell(ctx, x, y, palette[value], BLOCK);
      }
    });
  });

  if (!gameOver && player) {
    const ghostPos = getGhostPosition();
    drawMatrix(ctx, player.matrix, ghostPos, palette[player.type], BLOCK, 0.28);
    drawMatrix(ctx, player.matrix, player.pos, palette[player.type], BLOCK);
  }

  if (paused || gameOver) {
    ctx.fillStyle = 'rgba(64, 40, 50, 0.45)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(gameOver ? '游戏结束' : '已暂停', canvas.width / 2, canvas.height / 2);
  }
}

function drawPreview(canvasCtx, targetType) {
  const size = 24;
  canvasCtx.clearRect(0, 0, 120, 120);
  canvasCtx.fillStyle = '#f9e9eb';
  canvasCtx.fillRect(0, 0, 120, 120);

  if (!targetType) return;

  const matrix = tetrominoes[targetType];
  const offsetX = Math.floor((120 / size - matrix[0].length) / 2);
  const offsetY = Math.floor((120 / size - matrix.length) / 2);
  drawMatrix(canvasCtx, matrix, { x: offsetX, y: offsetY }, palette[targetType], size);
}

function drawNext() {
  drawPreview(nextCtx, nextType);
}

function drawHold() {
  drawPreview(holdCtx, holdType);
}

function updateStats() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  linesEl.textContent = lines;
  comboEl.textContent = combo;
  bombsEl.textContent = bombs;
}

function resetGame() {
  for (let y = 0; y < ROWS; y += 1) {
    board[y].fill(0);
  }

  score = 0;
  lines = 0;
  level = 1;
  combo = 0;
  bombs = 0;
  bombMilestone = 0;
  dropInterval = 900;
  dropCounter = 0;
  paused = false;
  gameOver = false;
  holdType = null;
  nextType = randomType();
  updateStats();
  drawHold();
  spawnPiece();
}

function update(time = 0) {
  const delta = time - lastTime;
  lastTime = time;

  if (!paused && !gameOver) {
    dropCounter += delta;
    if (dropCounter > dropInterval) {
      playerDrop();
    }
  }

  drawBoard();
  requestAnimationFrame(update);
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') playerMove(-1);
  if (event.key === 'ArrowRight') playerMove(1);
  if (event.key === 'ArrowDown') playerDrop();
  if (event.key === 'ArrowUp') playerRotate();
  if (event.code === 'Space') {
    event.preventDefault();
    hardDrop();
  }
  if (event.key.toLowerCase() === 'c') holdPiece();
  if (event.key.toLowerCase() === 'x') activateBomb();
  if (event.key.toLowerCase() === 'p' && !gameOver) {
    paused = !paused;
  }

  if (gameOver && event.key === 'Enter') {
    resetGame();
  }
});

restartBtn.addEventListener('click', resetGame);

resetGame();
requestAnimationFrame(update);
