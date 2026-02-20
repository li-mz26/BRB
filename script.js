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
const shieldsEl = document.getElementById('shields');
const relicListEl = document.getElementById('relic-list');
const relicModalEl = document.getElementById('relic-modal');
const relicOptionsEl = document.getElementById('relic-options');
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

const relicPool = [
  {
    id: 'amber_score',
    name: '琥珀计分器',
    desc: '总得分倍率 +15%。',
    apply(state) {
      state.scoreMultiplier += 0.15;
    }
  },
  {
    id: 'mist_clock',
    name: '慢时粉雾',
    desc: '下落速度减慢（每级额外 +60ms）。',
    apply(state) {
      state.speedOffset += 60;
    }
  },
  {
    id: 'echo_combo',
    name: '回响连击',
    desc: '连击每层额外 +15 分。',
    apply(state) {
      state.comboBonusBase += 15;
    }
  },
  {
    id: 'bomb_core',
    name: '炸弹核心',
    desc: '立刻获得 1 炸弹，并扩大爆炸半径。',
    apply(state) {
      state.bombs += 1;
      state.bombRadius = Math.min(4, state.bombRadius + 1);
    }
  },
  {
    id: 'hold_ribbon',
    name: '双持丝带',
    desc: '每回合可使用暂存次数 +1。',
    apply(state) {
      state.holdLimit += 1;
    }
  },
  {
    id: 'woven_shield',
    name: '织雾护符',
    desc: '获得 1 层护盾，抵消一次失败。',
    apply(state) {
      state.shields += 1;
    }
  }
];

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
let holdUsesThisTurn = 0;
let holdLimit = 1;
let shields = 0;

let scoreMultiplier = 1;
let speedOffset = 0;
let comboBonusBase = 40;
let bombRadius = 2;

let relicChoices = [];
let inRelicSelection = false;
let relicPickMilestone = 0;
let acquiredRelics = [];

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

function calcDropInterval() {
  return Math.max(120, 900 - (level - 1) * 55 + speedOffset);
}

function spawnPiece() {
  const type = nextType;
  nextType = randomType();
  player = createPiece(type);
  holdUsesThisTurn = 0;

  if (collide(board, player)) {
    if (shields > 0) {
      shields -= 1;
      for (let y = 0; y < 4; y += 1) {
        board[y].fill(0);
      }
    } else {
      gameOver = true;
    }
  }

  drawNext();
  drawHold();
  updateStats();
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

function rollRelicChoices() {
  const shuffled = [...relicPool].sort(() => Math.random() - 0.5);
  relicChoices = shuffled.slice(0, 3);

  relicOptionsEl.innerHTML = '';
  relicChoices.forEach((relic, i) => {
    const item = document.createElement('article');
    item.className = 'relic-option';
    item.innerHTML = `<b>${i + 1}. ${relic.name}</b><span>${relic.desc}</span>`;
    relicOptionsEl.appendChild(item);
  });

  inRelicSelection = true;
  relicModalEl.classList.remove('hidden');
}

function applyRelicByIndex(index) {
  if (!inRelicSelection) return;
  const relic = relicChoices[index];
  if (!relic) return;

  const state = {
    bombs,
    bombRadius,
    comboBonusBase,
    holdLimit,
    scoreMultiplier,
    shields,
    speedOffset
  };
  relic.apply(state);
  bombs = state.bombs;
  bombRadius = state.bombRadius;
  comboBonusBase = state.comboBonusBase;
  holdLimit = state.holdLimit;
  scoreMultiplier = state.scoreMultiplier;
  shields = state.shields;
  speedOffset = state.speedOffset;
  dropInterval = calcDropInterval();

  acquiredRelics.push(relic.name);
  renderRelics();
  inRelicSelection = false;
  relicModalEl.classList.add('hidden');
  updateStats();
}

function maybeTriggerRelicChoice() {
  const milestone = Math.floor(level / 3);
  if (milestone > relicPickMilestone && !gameOver) {
    relicPickMilestone = milestone;
    rollRelicChoices();
  }
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
    const comboBonus = combo > 1 ? combo * comboBonusBase * level : 0;
    score += Math.floor((baseScore + comboBonus) * scoreMultiplier);
    lines += cleared;

    const oldLevel = level;
    level = Math.floor(lines / 12) + 1;
    if (level !== oldLevel) {
      maybeTriggerRelicChoice();
    }

    dropInterval = calcDropInterval();

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
  if (paused || gameOver || inRelicSelection) return;
  player.pos.x += dir;
  if (collide(board, player)) {
    player.pos.x -= dir;
  }
}

function playerDrop() {
  if (paused || gameOver || inRelicSelection) return;
  player.pos.y += 1;
  if (collide(board, player)) {
    player.pos.y -= 1;
    lockPiece();
  }
  dropCounter = 0;
}

function hardDrop() {
  if (paused || gameOver || inRelicSelection) return;
  while (!collide(board, player)) {
    player.pos.y += 1;
  }
  player.pos.y -= 1;
  lockPiece();
  dropCounter = 0;
}

function playerRotate() {
  if (paused || gameOver || inRelicSelection) return;
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
  if (paused || gameOver || inRelicSelection || holdUsesThisTurn >= holdLimit) return;

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

  holdUsesThisTurn += 1;
}

function activateBomb() {
  if (paused || gameOver || inRelicSelection || bombs <= 0) return;

  bombs -= 1;
  const centerX = player.pos.x + Math.floor(player.matrix[0].length / 2);
  const centerY = player.pos.y + Math.floor(player.matrix.length / 2);
  let removed = 0;

  for (let y = centerY - bombRadius; y <= centerY + bombRadius; y += 1) {
    for (let x = centerX - bombRadius; x <= centerX + bombRadius; x += 1) {
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS && board[y][x] !== 0) {
        board[y][x] = 0;
        removed += 1;
      }
    }
  }

  score += Math.floor(removed * 25 * level * scoreMultiplier);
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
  ctx.fillStyle = '#f9e9eb';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(153, 98, 117, 0.12)';
  ctx.lineWidth = 1;

  for (let x = 0; x <= canvas.width; x += BLOCK) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= canvas.height; y += BLOCK) {
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

  if (paused || gameOver || inRelicSelection) {
    ctx.fillStyle = 'rgba(64, 40, 50, 0.45)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    const text = gameOver ? '游戏结束' : inRelicSelection ? '选择遗物中' : '已暂停';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
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

function renderRelics() {
  relicListEl.innerHTML = '';
  if (acquiredRelics.length === 0) {
    relicListEl.innerHTML = '<li>暂无（3级开始出现抉择）</li>';
    return;
  }

  acquiredRelics.slice(-6).forEach((name) => {
    const li = document.createElement('li');
    li.textContent = name;
    relicListEl.appendChild(li);
  });
}

function updateStats() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  linesEl.textContent = lines;
  comboEl.textContent = combo;
  bombsEl.textContent = bombs;
  shieldsEl.textContent = shields;
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
  dropCounter = 0;
  paused = false;
  gameOver = false;
  holdType = null;
  holdUsesThisTurn = 0;
  holdLimit = 1;
  shields = 0;

  scoreMultiplier = 1;
  speedOffset = 0;
  comboBonusBase = 40;
  bombRadius = 2;

  relicChoices = [];
  inRelicSelection = false;
  relicPickMilestone = 0;
  acquiredRelics = [];
  relicModalEl.classList.add('hidden');

  nextType = randomType();
  dropInterval = calcDropInterval();
  updateStats();
  renderRelics();
  drawHold();
  spawnPiece();
}

function update(time = 0) {
  const delta = time - lastTime;
  lastTime = time;

  if (!paused && !gameOver && !inRelicSelection) {
    dropCounter += delta;
    if (dropCounter > dropInterval) {
      playerDrop();
    }
  }

  drawBoard();
  requestAnimationFrame(update);
}

document.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();

  if (inRelicSelection) {
    if (['1', '2', '3'].includes(key)) {
      applyRelicByIndex(Number(key) - 1);
    }
    return;
  }

  if (event.key === 'ArrowLeft') playerMove(-1);
  if (event.key === 'ArrowRight') playerMove(1);
  if (event.key === 'ArrowDown') playerDrop();
  if (event.key === 'ArrowUp') playerRotate();
  if (event.code === 'Space') {
    event.preventDefault();
    hardDrop();
  }
  if (key === 'c') holdPiece();
  if (key === 'x') activateBomb();
  if (key === 'p' && !gameOver) {
    paused = !paused;
  }

  if (gameOver && event.key === 'Enter') {
    resetGame();
  }
});

restartBtn.addEventListener('click', resetGame);

resetGame();
requestAnimationFrame(update);
