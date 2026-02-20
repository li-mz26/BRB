const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');

const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');
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
let score = 0;
let lines = 0;
let level = 1;
let dropCounter = 0;
let dropInterval = 900;
let lastTime = 0;
let paused = false;
let gameOver = false;

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

function spawnPiece() {
  const type = nextType;
  nextType = randomType();

  player = {
    type,
    matrix: cloneMatrix(tetrominoes[type]),
    pos: { x: Math.floor(COLS / 2) - 1, y: 0 }
  };

  player.pos.x = Math.floor((COLS - player.matrix[0].length) / 2);

  if (collide(board, player)) {
    gameOver = true;
  }

  drawNext();
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
    const lineScore = [0, 100, 300, 500, 800][cleared] * level;
    score += lineScore;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(180, 900 - (level - 1) * 70);
    updateStats();
  }
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
    merge(board, player);
    clearLines();
    spawnPiece();
  }
  dropCounter = 0;
}

function hardDrop() {
  if (paused || gameOver) return;
  while (!collide(board, player)) {
    player.pos.y += 1;
  }
  player.pos.y -= 1;
  merge(board, player);
  clearLines();
  spawnPiece();
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

function drawCell(context, x, y, color, size) {
  context.fillStyle = color;
  context.fillRect(x * size, y * size, size, size);
  context.strokeStyle = 'rgba(84, 62, 70, 0.25)';
  context.strokeRect(x * size, y * size, size, size);

  context.fillStyle = 'rgba(255, 255, 255, 0.25)';
  context.fillRect(x * size + 2, y * size + 2, size - 4, 6);
}

function drawBoard() {
  ctx.fillStyle = '#f9e9eb';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  board.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        drawCell(ctx, x, y, palette[value], BLOCK);
      }
    });
  });

  if (!gameOver && player) {
    player.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          drawCell(ctx, x + player.pos.x, y + player.pos.y, palette[player.type], BLOCK);
        }
      });
    });
  }

  if (paused || gameOver) {
    ctx.fillStyle = 'rgba(64, 40, 50, 0.45)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(gameOver ? '游戏结束' : '已暂停', canvas.width / 2, canvas.height / 2);
  }
}

function drawNext() {
  const size = 24;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  nextCtx.fillStyle = '#f9e9eb';
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  const matrix = tetrominoes[nextType];
  const offsetX = Math.floor((nextCanvas.width / size - matrix[0].length) / 2);
  const offsetY = Math.floor((nextCanvas.height / size - matrix.length) / 2);

  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        drawCell(nextCtx, x + offsetX, y + offsetY, palette[nextType], size);
      }
    });
  });
}

function updateStats() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  linesEl.textContent = lines;
}

function resetGame() {
  for (let y = 0; y < ROWS; y += 1) {
    board[y].fill(0);
  }

  score = 0;
  lines = 0;
  level = 1;
  dropInterval = 900;
  dropCounter = 0;
  paused = false;
  gameOver = false;
  nextType = randomType();
  updateStats();
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
