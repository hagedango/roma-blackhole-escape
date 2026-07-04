'use strict';

/* =========================================================
 * ロマ子様のブラックホール・エスケープ
 * すべてのゲームパラメータとセリフはこの冒頭部に集約する
 * ========================================================= */

// ----- 難易度別パラメータ（設計図 2-10節） -----
const DIFFICULTY_PARAMS = {
  easy: {
    PLAYER_SPEED: 220,
    PLAYER_RADIUS: 16,
    BH_INITIAL_RADIUS: 30,
    BH_GROWTH_RATE: 3,
    BH_GRAVITY_STRENGTH: 4000,
    METEOR_SPAWN_INTERVAL: 1.5,
    METEOR_SPEED: 120,
    STAR_SPAWN_INTERVAL: 3,
    STAR_MAX_COUNT: 3,
    STAR_LIFETIME: 8,
    STAR_RADIUS: 12,
    STAR_BONUS: 5,
    DASH_SPEED_MULTIPLIER: 3,
    DASH_DURATION: 0.25,
    DASH_COOLDOWN: 3,
    SURGE_INTERVAL: 12,
    SURGE_WARNING: 2,
    SURGE_DURATION: 2,
    SURGE_MULTIPLIER: 2.5,
  },
  hard: {
    PLAYER_SPEED: 200,
    PLAYER_RADIUS: 16,
    BH_INITIAL_RADIUS: 40,
    BH_GROWTH_RATE: 6,
    BH_GRAVITY_STRENGTH: 8000,
    METEOR_SPAWN_INTERVAL: 0.7,
    METEOR_SPEED: 220,
    STAR_SPAWN_INTERVAL: 2.5,
    STAR_MAX_COUNT: 3,
    STAR_LIFETIME: 6,
    STAR_RADIUS: 12,
    STAR_BONUS: 8,
    DASH_SPEED_MULTIPLIER: 3,
    DASH_DURATION: 0.25,
    DASH_COOLDOWN: 4,
    SURGE_INTERVAL: 8,
    SURGE_WARNING: 1.5,
    SURGE_DURATION: 2.5,
    SURGE_MULTIPLIER: 3,
  },
};

const METEOR_RADIUS_MIN = 10;
const METEOR_RADIUS_MAX = 18;
const DEATH_ANIM_DURATION = 1.5; // 吸い込まれ演出の長さ（秒）
const BUBBLE_DURATION = 2.0;     // 吹き出し表示時間（秒）
const DANGER_COOLDOWN = 5.0;     // 危険接近セリフの再発動制限（秒）
const DANGER_DISTANCE = 80;      // BH表面からこの距離未満で危険接近（px）

// ----- ロマ子様セリフ集（設計図 2-7節。コミュニティで自由に差し替えてOK！） -----
const QUOTES = {
  danger: [
    'ちょっ、引っ張らないでくださる!?',
    '吸わないでちょうだい！',
  ],
  collect: [
    'いただきですわ✨',
    '当然の報酬ですわね',
  ],
  dash: [
    '失礼しますわよ！',
    'ロマ子様、緊急回避！',
  ],
  surgeWarning: [
    'な、なんか嫌な予感がしますわ…',
    '来ますわよ…！',
  ],
  survive: [
    'まだまだ余裕ですわ',
    '宇宙もわたくしの前ではこの程度',
  ],
  gameover: [
    '覚えてらっしゃい…！',
    'こ、今回は引き分けですわ…',
  ],
};

/* =========================================================
 * DOM要素・キャンバス
 * ========================================================= */
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

const screens = {
  title: document.getElementById('screen-title'),
  play: document.getElementById('screen-play'),
  gameover: document.getElementById('screen-gameover'),
};

const scoreValueEl = document.getElementById('score-value');
const dashGaugeEl = document.getElementById('dash-gauge-inner');

/* =========================================================
 * 全体の状態
 * ========================================================= */
let selectedLevel = 'easy';
let P = DIFFICULTY_PARAMS.easy; // 現在の難易度パラメータ
let animFrameId = null;
let lastTime = 0;

const game = {}; // ゲーム中の状態はすべてこの中（initGameで初期化）

/* =========================================================
 * 画面切り替え
 * ========================================================= */
function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle('hidden', key !== name);
  });
}

/* =========================================================
 * ハイスコア（localStorage、難易度別）
 * ========================================================= */
function highscoreKey(level) {
  return 'romako_bh_highscore_' + level;
}

function loadHighscore(level) {
  const v = Number(localStorage.getItem(highscoreKey(level)));
  return Number.isFinite(v) ? v : 0;
}

function saveHighscore(level, score) {
  localStorage.setItem(highscoreKey(level), String(score));
}

function refreshTitleHighscores() {
  document.getElementById('hs-easy').textContent = loadHighscore('easy');
  document.getElementById('hs-hard').textContent = loadHighscore('hard');
}

/* =========================================================
 * 入力（キーボード＋タッチ）
 * ========================================================= */
const input = { up: false, down: false, left: false, right: false };
let dashRequested = false;

const KEY_MAP = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  W: 'up', S: 'down', A: 'left', D: 'right',
};

window.addEventListener('keydown', (e) => {
  if (e.key === ' ') {
    dashRequested = true;
    e.preventDefault();
    return;
  }
  const dir = KEY_MAP[e.key];
  if (dir) {
    input[dir] = true;
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  const dir = KEY_MAP[e.key];
  if (dir) input[dir] = false;
});

// スマホ用 十字ボタン（押している間だけ移動）
document.querySelectorAll('.dpad-btn').forEach((btn) => {
  const dir = btn.dataset.dir;
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); input[dir] = true; });
  btn.addEventListener('pointerup', () => { input[dir] = false; });
  btn.addEventListener('pointerleave', () => { input[dir] = false; });
  btn.addEventListener('pointercancel', () => { input[dir] = false; });
});

document.getElementById('btn-dash-touch').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  dashRequested = true;
});

/* =========================================================
 * ユーティリティ
 * ========================================================= */
function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function pickQuote(kind) {
  const arr = QUOTES[kind];
  return arr[Math.floor(Math.random() * arr.length)];
}

/* =========================================================
 * ゲーム初期化
 * ========================================================= */
function initGame() {
  P = DIFFICULTY_PARAMS[selectedLevel];

  game.phase = 'playing'; // 'playing' | 'dying'
  game.elapsed = 0;

  game.player = {
    x: W / 2,
    y: H - 100,
    r: P.PLAYER_RADIUS,
  };

  game.bh = {
    x: W / 2 + randRange(-60, 60),
    y: H / 2 + randRange(-40, 40),
    r: P.BH_INITIAL_RADIUS,
  };

  game.meteors = [];
  game.meteorTimer = 0;

  game.stars = [];
  game.starTimer = 0;
  game.starsCollected = 0;

  game.effects = []; // かけら収集時のキラッと演出

  game.dash = {
    active: false,
    timeLeft: 0,
    cooldownLeft: 0,
    dirX: 0,
    dirY: 0,
    trail: [], // 残像
  };

  // サージ状態: 'idle' → 'warning' → 'active' → 'idle' ...
  game.surge = { state: 'idle', timer: P.SURGE_INTERVAL - P.SURGE_WARNING };

  game.bubble = null; // { text, timeLeft }
  game.dangerCooldown = 0;
  game.milestones = { 30: false, 60: false };

  game.death = null; // 吸い込まれ演出用

  dashRequested = false;
}

function startGame() {
  initGame();
  showScreen('play');
  if (animFrameId !== null) cancelAnimationFrame(animFrameId);
  lastTime = performance.now();
  animFrameId = requestAnimationFrame(gameLoop);
}

/* =========================================================
 * メインループ
 * ========================================================= */
function gameLoop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05); // タブ復帰時の暴走防止
  lastTime = now;

  if (game.phase === 'playing') {
    update(dt);
  } else if (game.phase === 'dying') {
    updateDeath(dt);
  }
  draw();

  if (game.phase !== 'done') {
    animFrameId = requestAnimationFrame(gameLoop);
  }
}

/* =========================================================
 * 更新処理
 * ========================================================= */
function update(dt) {
  game.elapsed += dt;
  updateSurge(dt);
  updateDash(dt);
  updatePlayer(dt);
  updateMeteors(dt);
  updateStars(dt);
  updateEffects(dt);
  updateBubble(dt);
  checkMilestones();

  // ブラックホール拡大
  game.bh.r += P.BH_GROWTH_RATE * dt;

  checkCollisions();
  updateHud();
}

function gravityMultiplier() {
  return game.surge.state === 'active' ? P.SURGE_MULTIPLIER : 1;
}

// 引力：force = K / max(distance, 50) を中心方向へ（設計図 2-2節）
function gravityForceAt(x, y) {
  const d = dist(x, y, game.bh.x, game.bh.y);
  const force = (P.BH_GRAVITY_STRENGTH / Math.max(d, 50)) * gravityMultiplier();
  const nx = (game.bh.x - x) / Math.max(d, 0.001);
  const ny = (game.bh.y - y) / Math.max(d, 0.001);
  return { fx: nx * force, fy: ny * force, d };
}

function updateSurge(dt) {
  const s = game.surge;
  s.timer -= dt;
  if (s.timer > 0) return;

  if (s.state === 'idle') {
    s.state = 'warning';
    s.timer = P.SURGE_WARNING;
    showBubble(pickQuote('surgeWarning'));
  } else if (s.state === 'warning') {
    s.state = 'active';
    s.timer = P.SURGE_DURATION;
  } else {
    s.state = 'idle';
    s.timer = P.SURGE_INTERVAL - P.SURGE_WARNING;
  }
}

function updateDash(dt) {
  const dash = game.dash;
  if (dash.cooldownLeft > 0) dash.cooldownLeft -= dt;

  if (dashRequested) {
    dashRequested = false;
    if (!dash.active && dash.cooldownLeft <= 0) {
      // 移動入力があればその方向、ニュートラルならBHと逆方向へ緊急脱出
      let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      if (dx === 0 && dy === 0) {
        const d = dist(game.player.x, game.player.y, game.bh.x, game.bh.y);
        dx = (game.player.x - game.bh.x) / Math.max(d, 0.001);
        dy = (game.player.y - game.bh.y) / Math.max(d, 0.001);
      } else {
        const len = Math.hypot(dx, dy);
        dx /= len;
        dy /= len;
      }
      dash.active = true;
      dash.timeLeft = P.DASH_DURATION;
      dash.cooldownLeft = P.DASH_COOLDOWN;
      dash.dirX = dx;
      dash.dirY = dy;
      showBubble(pickQuote('dash'));
    }
  }

  if (dash.active) {
    dash.timeLeft -= dt;
    dash.trail.push({ x: game.player.x, y: game.player.y, life: 0.3 });
    if (dash.timeLeft <= 0) dash.active = false;
  }
  dash.trail = dash.trail.filter((t) => (t.life -= dt) > 0);
}

function updatePlayer(dt) {
  const p = game.player;
  let vx = 0;
  let vy = 0;

  if (game.dash.active) {
    vx = game.dash.dirX * P.PLAYER_SPEED * P.DASH_SPEED_MULTIPLIER;
    vy = game.dash.dirY * P.PLAYER_SPEED * P.DASH_SPEED_MULTIPLIER;
  } else {
    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy); // 斜め移動が速くならないよう正規化
      vx = (dx / len) * P.PLAYER_SPEED;
      vy = (dy / len) * P.PLAYER_SPEED;
    }
  }

  // 引力を合成
  const g = gravityForceAt(p.x, p.y);
  p.x += (vx + g.fx) * dt;
  p.y += (vy + g.fy) * dt;

  // 画面端でクランプ
  p.x = Math.max(p.r, Math.min(W - p.r, p.x));
  p.y = Math.max(p.r, Math.min(H - p.r, p.y));

  // 危険接近セリフ（BH表面から80px未満、5秒に1回まで）
  if (game.dangerCooldown > 0) game.dangerCooldown -= dt;
  const surfaceDist = g.d - game.bh.r;
  if (surfaceDist < DANGER_DISTANCE && game.dangerCooldown <= 0) {
    showBubble(pickQuote('danger'));
    game.dangerCooldown = DANGER_COOLDOWN;
  }
}

function updateMeteors(dt) {
  game.meteorTimer -= dt;
  if (game.meteorTimer <= 0) {
    spawnMeteor();
    game.meteorTimer = P.METEOR_SPAWN_INTERVAL;
  }

  for (const m of game.meteors) {
    // 引力で軌道が少し曲がる（設計図 2-3節の任意実装）
    const g = gravityForceAt(m.x, m.y);
    m.vx += g.fx * 0.5 * dt;
    m.vy += g.fy * 0.5 * dt;
    m.x += m.vx * dt;
    m.y += m.vy * dt;
  }

  // 画面外に完全に出た隕石とBHに飲まれた隕石を除去
  game.meteors = game.meteors.filter((m) => {
    if (m.x < -60 || m.x > W + 60 || m.y < -60 || m.y > H + 60) return false;
    if (dist(m.x, m.y, game.bh.x, game.bh.y) < game.bh.r) return false;
    return true;
  });
}

function spawnMeteor() {
  const r = randRange(METEOR_RADIUS_MIN, METEOR_RADIUS_MAX);
  // 外周のどの辺から出すか
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0) { x = randRange(0, W); y = -r; }        // 上
  else if (side === 1) { x = randRange(0, W); y = H + r; } // 下
  else if (side === 2) { x = -r; y = randRange(0, H); }    // 左
  else { x = W + r; y = randRange(0, H); }                 // 右

  // canvas内側のランダムな点へ向かう
  const tx = randRange(W * 0.2, W * 0.8);
  const ty = randRange(H * 0.2, H * 0.8);
  const d = dist(x, y, tx, ty);
  game.meteors.push({
    x, y, r,
    vx: ((tx - x) / d) * P.METEOR_SPEED,
    vy: ((ty - y) / d) * P.METEOR_SPEED,
  });
}

function updateStars(dt) {
  game.starTimer -= dt;
  if (game.starTimer <= 0) {
    if (game.stars.length < P.STAR_MAX_COUNT) spawnStar();
    game.starTimer = P.STAR_SPAWN_INTERVAL;
  }

  for (const s of game.stars) s.life -= dt;

  // 寿命切れ・BHに飲まれたかけらを除去
  game.stars = game.stars.filter((s) => {
    if (s.life <= 0) return false;
    if (dist(s.x, s.y, game.bh.x, game.bh.y) < game.bh.r) return false;
    return true;
  });
}

// BH表面から60〜200pxのドーナツ状範囲に出現（設計図 2-5節）
function spawnStar() {
  const margin = 20;
  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const d = game.bh.r + randRange(60, 200);
    const x = game.bh.x + Math.cos(angle) * d;
    const y = game.bh.y + Math.sin(angle) * d;
    if (x > margin && x < W - margin && y > margin && y < H - margin) {
      game.stars.push({ x, y, r: P.STAR_RADIUS, life: P.STAR_LIFETIME });
      return;
    }
  }
  // 20回試してcanvas内に収まらなければ今回は出現なし
}

function updateEffects(dt) {
  for (const e of game.effects) e.life -= dt;
  game.effects = game.effects.filter((e) => e.life > 0);
}

function updateBubble(dt) {
  if (game.bubble) {
    game.bubble.timeLeft -= dt;
    if (game.bubble.timeLeft <= 0) game.bubble = null;
  }
}

function showBubble(text) {
  game.bubble = { text, timeLeft: BUBBLE_DURATION }; // 新イベントで上書き
}

function checkMilestones() {
  for (const sec of [30, 60]) {
    if (!game.milestones[sec] && game.elapsed >= sec) {
      game.milestones[sec] = true;
      showBubble(pickQuote('survive'));
    }
  }
}

function currentScore() {
  return Math.floor(game.elapsed) + game.starsCollected * P.STAR_BONUS;
}

function checkCollisions() {
  const p = game.player;

  // かけら収集（円判定）
  for (let i = game.stars.length - 1; i >= 0; i--) {
    const s = game.stars[i];
    if (dist(p.x, p.y, s.x, s.y) < p.r + s.r) {
      game.stars.splice(i, 1);
      game.starsCollected++;
      game.effects.push({ x: s.x, y: s.y, life: 0.4, maxLife: 0.4 });
      showBubble(pickQuote('collect'));
    }
  }

  // ブラックホールに吸い込まれた
  if (dist(p.x, p.y, game.bh.x, game.bh.y) < p.r + game.bh.r) {
    beginDeath();
    return;
  }

  // 隕石に衝突
  for (const m of game.meteors) {
    if (dist(p.x, p.y, m.x, m.y) < p.r + m.r) {
      beginDeath();
      return;
    }
  }
}

/* =========================================================
 * 吸い込まれ演出（設計図 2-8節）
 * ========================================================= */
function beginDeath() {
  const p = game.player;
  const d = dist(p.x, p.y, game.bh.x, game.bh.y);
  game.phase = 'dying';
  game.death = {
    t: 0,
    startDist: Math.max(d, 1),
    startAngle: Math.atan2(p.y - game.bh.y, p.x - game.bh.x),
  };
}

function updateDeath(dt) {
  const dth = game.death;
  dth.t += dt;
  const progress = Math.min(dth.t / DEATH_ANIM_DURATION, 1);

  // 螺旋を描きながらBH中心へ（半径縮小＋回転）
  const r = dth.startDist * (1 - progress);
  const angle = dth.startAngle + progress * Math.PI * 4; // 2回転
  game.player.x = game.bh.x + Math.cos(angle) * r;
  game.player.y = game.bh.y + Math.sin(angle) * r;
  game.death.scale = 1 - progress;

  if (progress >= 1) {
    game.phase = 'done';
    finishGame();
  }
}

function finishGame() {
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  const score = currentScore();
  const prevHigh = loadHighscore(selectedLevel);
  const isNewRecord = score > prevHigh;
  if (isNewRecord) saveHighscore(selectedLevel, score);

  document.getElementById('gameover-quote').textContent = pickQuote('gameover');
  document.getElementById('final-score').textContent = score;
  document.getElementById('final-time').textContent = game.elapsed.toFixed(1);
  document.getElementById('final-stars').textContent = game.starsCollected;
  document.getElementById('final-highscore').textContent = Math.max(score, prevHigh);
  document.getElementById('new-record').classList.toggle('hidden', !isNewRecord);

  showScreen('gameover');
}

/* =========================================================
 * 描画処理
 * ========================================================= */
function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();

  // サージ予兆・発動中は画面を揺らす
  if (game.surge.state === 'warning' || game.surge.state === 'active') {
    ctx.translate(randRange(-3, 3), randRange(-3, 3));
  }

  drawStarsBackground();
  drawBlackHole();
  drawStarsItems();
  drawMeteors();
  drawEffects();
  drawDashTrail();
  drawPlayer();
  drawBubble();

  ctx.restore();
}

// 背景の小さな星（固定シードの簡易スターフィールド）
const bgStars = Array.from({ length: 60 }, () => ({
  x: Math.random() * W,
  y: Math.random() * H,
  r: Math.random() * 1.5 + 0.5,
}));

function drawStarsBackground() {
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  for (const s of bgStars) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBlackHole() {
  const { x, y, r } = game.bh;
  const surging = game.surge.state === 'active';
  const warning = game.surge.state === 'warning';

  // 外周グロー
  const glowR = r * 1.8;
  const grad = ctx.createRadialGradient(x, y, r * 0.6, x, y, glowR);
  if (surging) {
    grad.addColorStop(0, 'rgba(255,60,120,0.9)');
    grad.addColorStop(1, 'rgba(255,60,120,0)');
  } else if (warning) {
    grad.addColorStop(0, 'rgba(220,80,200,0.8)');
    grad.addColorStop(1, 'rgba(220,80,200,0)');
  } else {
    grad.addColorStop(0, 'rgba(140,80,255,0.6)');
    grad.addColorStop(1, 'rgba(140,80,255,0)');
  }
  ctx.beginPath();
  ctx.arc(x, y, glowR, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // サージ中は吸い込み線を描く
  if (surging) {
    ctx.strokeStyle = 'rgba(255,120,180,0.35)';
    ctx.lineWidth = 2;
    const t = performance.now() / 1000;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + t * 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * (r + 60), y + Math.sin(a) * (r + 60));
      ctx.lineTo(x + Math.cos(a + 0.4) * (r + 8), y + Math.sin(a + 0.4) * (r + 8));
      ctx.stroke();
    }
  }

  // 本体（黒円）
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#000';
  ctx.fill();
}

function drawStarsItems() {
  for (const s of game.stars) {
    // 残り2秒で点滅
    if (s.life < 2 && Math.floor(s.life * 6) % 2 === 0) continue;
    ctx.save();
    ctx.translate(s.x, s.y);
    // 光条（十字）
    ctx.strokeStyle = 'rgba(255,226,122,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s.r * 1.4, 0); ctx.lineTo(s.r * 1.4, 0);
    ctx.moveTo(0, -s.r * 1.4); ctx.lineTo(0, s.r * 1.4);
    ctx.stroke();
    // 本体
    ctx.beginPath();
    ctx.arc(0, 0, s.r * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe27a';
    ctx.shadowColor = '#ffe27a';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.restore();
  }
}

function drawMeteors() {
  for (const m of game.meteors) {
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    ctx.fillStyle = '#9a8f85';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(m.x - m.r * 0.25, m.y - m.r * 0.25, m.r * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = '#b8ada0';
    ctx.fill();
  }
}

function drawEffects() {
  for (const e of game.effects) {
    const progress = 1 - e.life / e.maxLife;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 10 + progress * 30, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,226,122,${1 - progress})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function drawDashTrail() {
  for (const t of game.dash.trail) {
    ctx.beginPath();
    ctx.arc(t.x, t.y, game.player.r * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(143,216,255,${t.life})`;
    ctx.fill();
  }
}

// プレイヤー描画は画像差し替えを想定して専用関数に分離（設計図 3章）
function drawPlayer() {
  const p = game.player;
  const scale = game.phase === 'dying' ? Math.max(game.death.scale ?? 1, 0) : 1;
  const r = p.r * scale;
  if (r <= 0.5) return;

  ctx.save();
  // 本体（ピンクの円＝ロマ子様プレースホルダー）
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#ff8fc8';
  ctx.shadowColor = '#ff8fc8';
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffd9ec';
  ctx.lineWidth = 2;
  ctx.stroke();
  // 簡易お顔
  if (scale > 0.4) {
    ctx.fillStyle = '#5a2040';
    ctx.beginPath();
    ctx.arc(p.x - r * 0.3, p.y - r * 0.15, r * 0.12, 0, Math.PI * 2);
    ctx.arc(p.x + r * 0.3, p.y - r * 0.15, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y + r * 0.2, r * 0.25, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.strokeStyle = '#5a2040';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

function drawBubble() {
  if (!game.bubble || game.phase === 'dying') return;
  const p = game.player;
  const text = game.bubble.text;

  ctx.save();
  ctx.font = '14px sans-serif';
  const tw = ctx.measureText(text).width;
  const bw = tw + 20;
  const bh = 28;
  let bx = p.x - bw / 2;
  let by = p.y - p.r - bh - 14;
  // 画面内に収める
  bx = Math.max(4, Math.min(W - bw - 4, bx));
  by = Math.max(4, by);

  // 吹き出し本体
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 10);
  ctx.fill();
  // しっぽ
  ctx.beginPath();
  ctx.moveTo(p.x - 5, by + bh);
  ctx.lineTo(p.x + 5, by + bh);
  ctx.lineTo(p.x, by + bh + 8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#33224a';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + 10, by + bh / 2 + 1);
  ctx.restore();
}

/* =========================================================
 * HUD更新
 * ========================================================= */
function updateHud() {
  scoreValueEl.textContent = currentScore();

  const dash = game.dash;
  const ratio = dash.cooldownLeft > 0 ? 1 - dash.cooldownLeft / P.DASH_COOLDOWN : 1;
  dashGaugeEl.style.width = (ratio * 100).toFixed(0) + '%';
  dashGaugeEl.classList.toggle('ready', ratio >= 1);
}

/* =========================================================
 * UIイベント（難易度選択・画面遷移）
 * ========================================================= */
document.querySelectorAll('.difficulty-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedLevel = btn.dataset.level;
    document.querySelectorAll('.difficulty-btn').forEach((b) => {
      b.classList.toggle('selected', b === btn);
    });
  });
});

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-retry').addEventListener('click', startGame);
document.getElementById('btn-title').addEventListener('click', () => {
  refreshTitleHighscores();
  showScreen('title');
});

// 初期表示
refreshTitleHighscores();
showScreen('title');
