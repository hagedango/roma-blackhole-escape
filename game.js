'use strict';

/* =========================================================
 * ロマ子様のブラックホール・エスケープ v2（プレミアム版）
 * すべてのゲームパラメータとセリフはこの冒頭部に集約する
 * ========================================================= */

// ----- 難易度別パラメータ -----
const DIFFICULTY_PARAMS = {
  easy: {
    PLAYER_SPEED: 220,
    PLAYER_RADIUS: 24, // ロマ子様アイコンを大きく（視認性UP）
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
    PLAYER_RADIUS: 24, // ロマ子様アイコンを大きく
    BH_INITIAL_RADIUS: 40,
    BH_GROWTH_RATE: 6,
    BH_GRAVITY_STRENGTH: 15000, // 吸引力を超絶強化（8000 -> 15000）
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

// ----- 難易度曲線（時間経過で隕石が速く・多くなる） -----
const RAMP = {
  SPEED_MAX_MULT: 2.2,   // 隕石速度は最大でこの倍率まで上がる
  SPEED_RAMP_TIME: 75,   // この秒数かけて最大倍率へ近づく
  SPAWN_RAMP_TIME: 45,   // 出現間隔の短縮ペース
  SPAWN_MIN_RATIO: 0.3,  // 出現間隔は初期値のこの割合までしか縮まない
};

const METEOR_RADIUS_MIN = 10;
const METEOR_RADIUS_MAX = 18;
const PLAYER_DRAW_SCALE = 1.5; // ロマ子様アイコンの見た目の拡大率（当たり判定はplayer.rで別管理）

// ----- 肥育・ダイエット・ギリギリアウト（v3ゲームメカニクス） -----
const FATTEN_PER_STAR = 2;      // かけら1個で太る量（当たり判定 px）
const PLAYER_RADIUS_MAX = 40;   // 肥育の上限（これ以上は太らない）
const FAT_QUOTE_THRESHOLD = 32; // 半径がこれ以上のときは「デブ扱いセリフ」に切り替え
const DIET_PER_DASH = 3;        // ダッシュ1回で痩せる量（下限は難易度のPLAYER_RADIUS）
const GRAZE_MARGIN = 22;        // 隕石にこの距離まで近づいてから離脱で「ギリギリアウト」成立
const GRAZE_BONUS = 2;          // ギリギリアウト1回のボーナス点
const GRAZE_QUOTE_COOLDOWN = 4; // ギリギリセリフの連発防止（秒）
const DEATH_ANIM_DURATION = 1.5; // 吸い込まれ演出の長さ（秒）
const BUBBLE_DURATION = 2.0;     // 吹き出し表示時間（秒）
const DANGER_COOLDOWN = 5.0;     // 危険接近セリフの再発動制限（秒）
const DANGER_DISTANCE = 80;      // BH表面からこの距離未満で危険接近（px）

// ----- ロマ子様セリフ集（罵尻ロマ子口調。コミュニティで自由に差し替えてOK！） -----
// 口調ルール：一人称「ロマ子様」／語尾「〜だじょ！」「〜のだわわ！」／
// 相槌「へーんだ！！」「んむ！！」／ファンは「ブタ野郎」「ブタ共」「テメェら」
const QUOTES = {
  danger: [
    'ちょっ、引っ張んなだじょ！！',
    'ロマ子様を吸えると思ってんのかテメェ！！',
  ],
  collect: [
    'んむ！！当然の報酬だじょ！',
    'いただきなのだわわ！',
  ],
  dash: [
    'へーんだ！！捕まるかっつーの！',
    'ロマ子様、緊急回避だじょ！',
  ],
  surgeWarning: [
    'な、なんか嫌な予感がすんだじょ…',
    '来るぞ…！ロマ子様は慌ててねぇかんな！！',
  ],
  survive: [
    'まだまだ余裕だじょ！',
    '宇宙もロマ子様の前ではこの程度なのだわわ！',
  ],
  gameover: [
    'お、覚えてろよぉ…！',
    'こ、今回は引き分けだかんな！！',
  ],
  // 太っているとき（半径がFAT_QUOTE_THRESHOLD以上）のかけら収集セリフ
  fatCollect: [
    'だ、誰がデブだテメェ！！',
    'た、食べても太らねぇんだかんな…！',
  ],
  // ダッシュで痩せたときのセリフ（痩せなかったときは dash を使う）
  diet: [
    'ダイエットだじょ！！',
    'シェイプアップなのだわわ！！',
  ],
  // ギリギリアウト成立時のセリフ（連発防止クールダウンあり）
  graze: [
    'ギリギリアウトだじょ！！',
    '今のはプロの避けだわわ！',
    'へーんだ！！当たるかっつーの！',
  ],
};

// ----- スコア別 罵倒・ご褒美ランク（上から順に min以上で判定） -----
// 低スコア＝強い罵倒（ドS）、中間＝優しい罵倒（ツンデレ）、高スコア＝照れ隠し＆出荷宣告
const SCORE_RANKS = [
  {
    min: 150,
    name: '銀河の覇者ブタ野郎',
    messages: [
      'テメェ…本当にあのブタ野郎かだじょ!? み、認めてやんよ…おめぇは伝説なのだわわ…！',
      'ここまで来たら立派なマゾ豚だじょ！！最高品質で出荷させてやんよ！！',
    ],
  },
  {
    min: 100,
    name: '恒星級ブタ野郎',
    messages: [
      'んむ！！見事だじょ！ご褒美にロマ子様の笑顔をくれてやんよ！',
      'ブタでもやればできんだな…ちょっとは見直しただじょ！',
    ],
  },
  {
    min: 50,
    name: '彗星級ブタ野郎',
    messages: [
      'や、やるじゃねぇか…！へーんだ！！別に見直してねぇんだかんな！！',
      'まぐれにしては上出来だじょ。次も同じ点取れたら本物と認めてやんよ、ブタ野郎！',
    ],
  },
  {
    min: 20,
    name: '小惑星級ブタ野郎',
    messages: [
      '…ったく、ブタのくせに粘りやがって…悪くねぇだじょ。',
      'その程度で満足してんじゃねぇぞ？出荷にはまだまだ程遠いんだかんな！',
    ],
  },
  {
    min: 0,
    name: '宇宙の塵ブタ野郎',
    messages: [
      '話になんねぇだじょ！！ブラックホールに謝ってこいやブタ野郎！！',
      'へーんだ！！塵以下の結果を見せられたロマ子様の身にもなれっつーの！出直してこい！',
    ],
  },
];

/* =========================================================
 * サウンドエンジン（Web Audio API、全部シンセ生成・音源ファイル不要）
 * ========================================================= */
const AudioEngine = {
  ctx: null,
  master: null,
  bgmGain: null,
  seGain: null,
  echo: null,
  droneNodes: [],
  arpTimer: null,
  nextNoteTime: 0,
  arpStep: 0,
  muted: localStorage.getItem('romako_bh_muted') === '1',

  // AudioContextはユーザー操作後にしか作れないため、ボタンクリック時に呼ぶ
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();

      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.16;
      this.bgmGain.connect(this.master);

      this.seGain = this.ctx.createGain();
      this.seGain.gain.value = 0.55;
      this.seGain.connect(this.master);

      // 宇宙っぽい残響（フィードバックディレイ）
      this.echo = this.ctx.createDelay(1);
      this.echo.delayTime.value = 0.34;
      const feedback = this.ctx.createGain();
      feedback.gain.value = 0.38;
      this.echo.connect(feedback);
      feedback.connect(this.echo);
      this.echo.connect(this.bgmGain);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('romako_bh_muted', this.muted ? '1' : '0');
    this.ensure();
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.6;
    return this.muted;
  },

  // 単音ヘルパー（周波数スライド＋音量エンベロープ付き）
  tone({ freq, freqEnd = null, dur = 0.2, type = 'sine', vol = 0.3, when = 0, toEcho = false }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(toEcho ? this.echo : this.seGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  },

  // ノイズヘルパー（爆発・風切り音用）
  noise({ dur = 0.3, vol = 0.4, filterType = 'lowpass', freq = 800, freqEnd = null, when = 0 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) filter.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 10), t0 + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.seGain);
    src.start(t0);
  },

  se(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'click':
        this.tone({ freq: 660, freqEnd: 880, dur: 0.08, type: 'triangle', vol: 0.25 });
        break;
      case 'collect':
        this.tone({ freq: 880, dur: 0.09, type: 'sine', vol: 0.3 });
        this.tone({ freq: 1320, dur: 0.14, type: 'sine', vol: 0.3, when: 0.07 });
        break;
      case 'graze':
        // ギリギリアウト：ヒヤッとする高速2連ブリップ
        this.tone({ freq: 1560, dur: 0.05, type: 'triangle', vol: 0.22 });
        this.tone({ freq: 2080, dur: 0.08, type: 'triangle', vol: 0.2, when: 0.05 });
        break;
      case 'dash':
        this.noise({ dur: 0.22, vol: 0.35, filterType: 'bandpass', freq: 2400, freqEnd: 300 });
        break;
      case 'explosion':
        this.noise({ dur: 0.45, vol: 0.6, filterType: 'lowpass', freq: 2000, freqEnd: 120 });
        this.tone({ freq: 180, freqEnd: 40, dur: 0.45, type: 'sawtooth', vol: 0.35 });
        break;
      case 'alarm':
        this.tone({ freq: 523, dur: 0.13, type: 'square', vol: 0.16 });
        this.tone({ freq: 415, dur: 0.13, type: 'square', vol: 0.16, when: 0.16 });
        this.tone({ freq: 523, dur: 0.13, type: 'square', vol: 0.16, when: 0.32 });
        break;
      case 'suck':
        this.tone({ freq: 420, freqEnd: 35, dur: 1.3, type: 'sine', vol: 0.4 });
        this.noise({ dur: 1.2, vol: 0.18, filterType: 'lowpass', freq: 900, freqEnd: 60 });
        break;
      case 'record':
        this.tone({ freq: 523, dur: 0.14, type: 'triangle', vol: 0.3 });
        this.tone({ freq: 659, dur: 0.14, type: 'triangle', vol: 0.3, when: 0.13 });
        this.tone({ freq: 784, dur: 0.3, type: 'triangle', vol: 0.35, when: 0.26 });
        break;
    }
  },

  // BGM：低音ドローン＋エコー付きアルペジオ（Aマイナーペンタ系）
  startBGM() {
    this.ensure();
    if (!this.ctx || this.arpTimer) return;

    const t0 = this.ctx.currentTime;
    for (const [freq, detune] of [[55, 0], [55, 6], [110, -4]]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 220;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.05, t0 + 2);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.bgmGain);
      osc.start(t0);
      this.droneNodes.push({ osc, gain });
    }

    const NOTES = [220, 261.63, 329.63, 392, 523.25, 392, 329.63, 261.63]; // A3 C4 E4 G4 C5 …
    this.nextNoteTime = this.ctx.currentTime + 0.2;
    this.arpStep = 0;
    this.arpTimer = setInterval(() => {
      while (this.nextNoteTime < this.ctx.currentTime + 0.35) {
        const note = NOTES[this.arpStep % NOTES.length];
        const when = this.nextNoteTime - this.ctx.currentTime;
        this.tone({ freq: note, dur: 0.55, type: 'sine', vol: 0.16, when, toEcho: true });
        this.nextNoteTime += 0.62;
        this.arpStep++;
      }
    }, 120);
  },

  stopBGM() {
    if (this.arpTimer) {
      clearInterval(this.arpTimer);
      this.arpTimer = null;
    }
    if (this.ctx) {
      const t = this.ctx.currentTime;
      for (const { osc, gain } of this.droneNodes) {
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.linearRampToValueAtTime(0, t + 1);
        osc.stop(t + 1.1);
      }
    }
    this.droneNodes = [];
  },
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
const timeValueEl = document.getElementById('time-value');
const dashGaugeEl = document.getElementById('dash-gauge-inner');
const dashGaugeOuterEl = document.getElementById('dash-gauge-outer');
const dashLabelEl = document.querySelector('.dash-label');

// ----- 画像アセットの事前ロード -----
const imgPlayer = new Image();
imgPlayer.src = 'assets/romaco_player.png';

const imgMeteor = new Image();
imgMeteor.src = 'assets/pig_meteor.png';

// ----- 隕石ブタのバリエーション画像（assets/pigs/pig_01.png 〜 pig_14.png） -----
// 存在する分だけ使い、1枚もなければ従来の pig_meteor.png にフォールバックする
const PIG_VARIANT_COUNT = 14;
const pigImages = [];
for (let i = 1; i <= PIG_VARIANT_COUNT; i++) {
  const img = new Image();
  img.src = 'assets/pigs/pig_' + String(i).padStart(2, '0') + '.png';
  pigImages.push(img);
}

function loadedPigImages() {
  return pigImages.filter((img) => img.complete && img.naturalWidth > 0);
}

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
const pointerInput = { active: false, x: 0, y: 0 };
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

// キャンバス直接タッチ・マウスクリックドラッグによる移動
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  pointerInput.active = true;
  updatePointerPos(e);
});

canvas.addEventListener('pointermove', (e) => {
  if (pointerInput.active) {
    e.preventDefault();
    updatePointerPos(e);
  }
});

window.addEventListener('pointerup', () => {
  pointerInput.active = false;
});
window.addEventListener('pointercancel', () => {
  pointerInput.active = false;
});

function updatePointerPos(e) {
  const rect = canvas.getBoundingClientRect();
  pointerInput.x = ((e.clientX - rect.left) / rect.width) * W;
  pointerInput.y = ((e.clientY - rect.top) / rect.height) * H;
}

/* =========================================================
 * ユーティリティ
 * ========================================================= */
function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* =========================================================
 * ゲーム初期化
 * ========================================================= */
function initGame() {
  P = DIFFICULTY_PARAMS[selectedLevel];

  game.phase = 'playing'; // 'playing' | 'dying' | 'done'
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

  game.particles = [];  // 火花・キラキラ等のパーティクル
  game.floatTexts = []; // 「+5」などの浮き上がるスコア表示

  game.dash = {
    active: false,
    timeLeft: 0,
    cooldownLeft: 0,
    dirX: 0,
    dirY: 0,
    trail: [],
  };

  // サージ状態: 'idle' → 'warning' → 'active' → 'idle' ...
  game.surge = { state: 'idle', timer: P.SURGE_INTERVAL - P.SURGE_WARNING };

  game.bubble = null;
  game.dangerCooldown = 0;
  game.milestones = { 30: false, 60: false };

  game.grazeCount = 0;         // ギリギリアウト成立回数
  game.grazeQuoteCooldown = 0; // ギリギリセリフの連発防止タイマー

  game.shakeTime = 0; // 衝突時の画面シェイク
  game.shakeMag = 0;

  game.death = null;

  dashRequested = false;
}

function startGame() {
  AudioEngine.ensure();
  AudioEngine.startBGM();
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
  updateParticles(dt);
  updateBubble(dt);
  checkMilestones();

  if (game.shakeTime > 0) game.shakeTime -= dt;
  if (game.grazeQuoteCooldown > 0) game.grazeQuoteCooldown -= dt;

  // ブラックホール拡大
  game.bh.r += P.BH_GROWTH_RATE * dt;

  checkCollisions();
  updateHud();
}

// ----- 難易度曲線：経過時間に応じた隕石の速度倍率と出現間隔 -----
function meteorSpeedNow() {
  const t = Math.min(game.elapsed / RAMP.SPEED_RAMP_TIME, 1);
  return P.METEOR_SPEED * (1 + t * (RAMP.SPEED_MAX_MULT - 1));
}

function meteorIntervalNow() {
  const interval = P.METEOR_SPAWN_INTERVAL / (1 + game.elapsed / RAMP.SPAWN_RAMP_TIME);
  return Math.max(interval, P.METEOR_SPAWN_INTERVAL * RAMP.SPAWN_MIN_RATIO);
}

function gravityMultiplier() {
  return game.surge.state === 'active' ? P.SURGE_MULTIPLIER : 1;
}

// 引力：force = K / max(distance, 50) を中心方向へ
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
    showBubble(pick(QUOTES.surgeWarning));
    AudioEngine.se('alarm');
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
    if (!dash.active && dash.cooldownLeft <= 0 && game.phase === 'playing') {
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
      // ダイエットダッシュ：太っていたら少し痩せる（下限は難易度の基礎サイズ）
      const beforeR = game.player.r;
      game.player.r = Math.max(game.player.r - DIET_PER_DASH, P.PLAYER_RADIUS);
      showBubble(pick(game.player.r < beforeR ? QUOTES.diet : QUOTES.dash));
      AudioEngine.se('dash');
      spawnParticles(game.player.x, game.player.y, {
        count: 10, colors: ['#8fd8ff', '#4fc8ff', '#ffffff'],
        speedMin: 40, speedMax: 160, lifeMin: 0.2, lifeMax: 0.5, sizeMin: 1.5, sizeMax: 3,
      });
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
  } else if (pointerInput.active) {
    // タッチ・ドラッグ位置へ滑らかに追従
    const dx = pointerInput.x - p.x;
    const dy = pointerInput.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 4) { // 指の微細なブレで振動するのを防止
      vx = (dx / d) * P.PLAYER_SPEED;
      vy = (dy / d) * P.PLAYER_SPEED;
    }
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
    showBubble(pick(QUOTES.danger));
    game.dangerCooldown = DANGER_COOLDOWN;
  }
}

function updateMeteors(dt) {
  game.meteorTimer -= dt;
  if (game.meteorTimer <= 0) {
    spawnMeteor();
    game.meteorTimer = meteorIntervalNow();
  }

  for (const m of game.meteors) {
    // 引力で軌道が少し曲がる
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
  const speed = meteorSpeedNow();
  // 外周のどの辺から出すか
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0) { x = randRange(0, W); y = -r; }
  else if (side === 1) { x = randRange(0, W); y = H + r; }
  else if (side === 2) { x = -r; y = randRange(0, H); }
  else { x = W + r; y = randRange(0, H); }

  // canvas内側のランダムな点へ向かう
  const tx = randRange(W * 0.2, W * 0.8);
  const ty = randRange(H * 0.2, H * 0.8);
  const d = dist(x, y, tx, ty);

  // ロード済みのブタ画像からランダムに1種を割り当て（この隕石の生涯同じ顔）
  const pigs = loadedPigImages();
  const img = pigs.length > 0 ? pigs[Math.floor(Math.random() * pigs.length)] : null;

  game.meteors.push({
    x, y, r,
    vx: ((tx - x) / d) * speed,
    vy: ((ty - y) / d) * speed,
    img,
  });
}

function updateStars(dt) {
  game.starTimer -= dt;
  if (game.starTimer <= 0) {
    if (game.stars.length < P.STAR_MAX_COUNT) spawnStar();
    game.starTimer = P.STAR_SPAWN_INTERVAL;
  }

  for (const s of game.stars) s.life -= dt;

  game.stars = game.stars.filter((s) => {
    if (s.life <= 0) return false;
    if (dist(s.x, s.y, game.bh.x, game.bh.y) < game.bh.r) return false;
    return true;
  });
}

// BH表面から60〜200pxのドーナツ状範囲に出現
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
}

/* =========================================================
 * パーティクル＆浮き上がりテキスト
 * ========================================================= */
function spawnParticles(x, y, opts) {
  const {
    count = 12, colors = ['#fff'],
    speedMin = 60, speedMax = 300,
    lifeMin = 0.4, lifeMax = 0.9,
    sizeMin = 1.5, sizeMax = 4,
    drag = 2.2,
  } = opts;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randRange(speedMin, speedMax);
    const life = randRange(lifeMin, lifeMax);
    game.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life, maxLife: life,
      size: randRange(sizeMin, sizeMax),
      color: pick(colors),
      drag,
    });
  }
}

function spawnFloatText(x, y, text) {
  game.floatTexts.push({ x, y, text, life: 0.9, maxLife: 0.9 });
}

function updateParticles(dt) {
  for (const pt of game.particles) {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    const damp = Math.max(1 - pt.drag * dt, 0);
    pt.vx *= damp;
    pt.vy *= damp;
  }
  game.particles = game.particles.filter((pt) => pt.life > 0);

  for (const ft of game.floatTexts) {
    ft.life -= dt;
    ft.y -= 44 * dt;
  }
  game.floatTexts = game.floatTexts.filter((ft) => ft.life > 0);
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
      showBubble(pick(QUOTES.survive));
    }
  }
}

function currentScore() {
  return Math.floor(game.elapsed)
    + game.starsCollected * P.STAR_BONUS
    + game.grazeCount * GRAZE_BONUS;
}

function checkCollisions() {
  const p = game.player;

  // かけら収集（円判定）→ 食べると太る（肥育システム）
  for (let i = game.stars.length - 1; i >= 0; i--) {
    const s = game.stars[i];
    if (dist(p.x, p.y, s.x, s.y) < p.r + s.r) {
      game.stars.splice(i, 1);
      game.starsCollected++;
      p.r = Math.min(p.r + FATTEN_PER_STAR, PLAYER_RADIUS_MAX);
      showBubble(pick(p.r >= FAT_QUOTE_THRESHOLD ? QUOTES.fatCollect : QUOTES.collect));
      AudioEngine.se('collect');
      spawnFloatText(s.x, s.y - 14, '+' + P.STAR_BONUS);
      spawnParticles(s.x, s.y, {
        count: 14, colors: ['#ffe27a', '#fff3c0', '#ffffff'],
        speedMin: 40, speedMax: 220, lifeMin: 0.3, lifeMax: 0.7, sizeMin: 1.5, sizeMax: 3.5,
      });
    }
  }

  // ブラックホールに吸い込まれた
  if (dist(p.x, p.y, game.bh.x, game.bh.y) < p.r + game.bh.r) {
    beginDeath('bh');
    return;
  }

  // 隕石：衝突判定＋ギリギリアウト判定
  for (const m of game.meteors) {
    const d = dist(p.x, p.y, m.x, m.y);
    if (d < p.r + m.r) {
      beginDeath('meteor');
      return;
    }
    // ギリギリアウト：危険圏に入ってから当たらずに離脱できたら成立（隕石ごとに1回）
    const grazeZone = p.r + m.r + GRAZE_MARGIN;
    if (d < grazeZone) {
      m.wasClose = true;
    } else if (m.wasClose && !m.grazed) {
      m.grazed = true;
      game.grazeCount++;
      AudioEngine.se('graze');
      spawnFloatText((p.x + m.x) / 2, (p.y + m.y) / 2 - 10, '+' + GRAZE_BONUS + ' ギリギリアウト!!');
      spawnParticles((p.x + m.x) / 2, (p.y + m.y) / 2, {
        count: 6, colors: ['#c8f4ff', '#ffffff', '#ff8fc8'],
        speedMin: 30, speedMax: 140, lifeMin: 0.2, lifeMax: 0.5, sizeMin: 1, sizeMax: 2.5,
      });
      if (game.grazeQuoteCooldown <= 0) {
        showBubble(pick(QUOTES.graze));
        game.grazeQuoteCooldown = GRAZE_QUOTE_COOLDOWN;
      }
    }
  }
}

/* =========================================================
 * 吸い込まれ演出（衝突→火花→螺旋吸い込み）
 * ========================================================= */
function beginDeath(cause) {
  const p = game.player;
  const d = dist(p.x, p.y, game.bh.x, game.bh.y);
  game.phase = 'dying';
  game.death = {
    t: 0,
    startDist: Math.max(d, 1),
    startAngle: Math.atan2(p.y - game.bh.y, p.x - game.bh.x),
    scale: 1,
  };

  if (cause === 'meteor') {
    // 美しい火花エフェクト＋爆発音＋画面シェイク
    spawnParticles(p.x, p.y, {
      count: 32, colors: ['#ffd27a', '#ff9f5a', '#ff6b9a', '#ffffff'],
      speedMin: 80, speedMax: 420, lifeMin: 0.4, lifeMax: 1.0, sizeMin: 1.5, sizeMax: 4.5,
    });
    AudioEngine.se('explosion');
    game.shakeTime = 0.35;
    game.shakeMag = 9;
  }
  AudioEngine.se('suck');
}

function updateDeath(dt) {
  const dth = game.death;
  dth.t += dt;
  const progress = Math.min(dth.t / DEATH_ANIM_DURATION, 1);

  // 螺旋を描きながらBH中心へ（半径縮小＋回転）
  const r = dth.startDist * (1 - progress);
  const angle = dth.startAngle + progress * Math.PI * 4;
  game.player.x = game.bh.x + Math.cos(angle) * r;
  game.player.y = game.bh.y + Math.sin(angle) * r;
  dth.scale = 1 - progress;

  // 吸い込まれながら紫の粒子を撒き散らす
  if (Math.random() < 0.7) {
    spawnParticles(game.player.x, game.player.y, {
      count: 2, colors: ['#c86bff', '#ff8fc8', '#8fd8ff'],
      speedMin: 20, speedMax: 120, lifeMin: 0.3, lifeMax: 0.7, sizeMin: 1, sizeMax: 3,
    });
  }

  updateParticles(dt);
  if (game.shakeTime > 0) game.shakeTime -= dt;

  if (progress >= 1) {
    game.phase = 'done';
    finishGame();
  }
}

// スコアに応じたランクを返す
function rankForScore(score) {
  for (const rank of SCORE_RANKS) {
    if (score >= rank.min) return rank;
  }
  return SCORE_RANKS[SCORE_RANKS.length - 1];
}

function finishGame() {
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  AudioEngine.stopBGM();

  const score = currentScore();
  const prevHigh = loadHighscore(selectedLevel);
  const isNewRecord = score > prevHigh;
  if (isNewRecord) {
    saveHighscore(selectedLevel, score);
    AudioEngine.se('record');
  }

  const rank = rankForScore(score);
  document.getElementById('rank-name').textContent = rank.name;
  document.getElementById('rank-message').textContent = pick(rank.messages);

  document.getElementById('gameover-quote').textContent = pick(QUOTES.gameover);
  document.getElementById('final-score').textContent = score;
  document.getElementById('final-time').textContent = game.elapsed.toFixed(1);
  document.getElementById('final-stars').textContent = game.starsCollected;
  document.getElementById('final-graze').textContent = game.grazeCount;
  document.getElementById('final-highscore').textContent = Math.max(score, prevHigh);
  document.getElementById('new-record').classList.toggle('hidden', !isNewRecord);

  prepareResultMeters();
  showScreen('gameover');
  playResultMeters();
  spawnRecordSparkles(isNewRecord);
}

// ----- リザルトメーター演出（表示後にスーッと満ちる） -----
const METER_TIME_FULL = 120;  // 生存120秒でTIMEメーターが満タン
const METER_STAR_FULL = 20;   // かけら20個でSTARメーターが満タン
const METER_GRAZE_FULL = 15;  // ギリギリアウト15回でGIRIメーターが満タン

function prepareResultMeters() {
  for (const id of ['meter-time', 'meter-stars', 'meter-graze']) {
    const el = document.getElementById(id);
    el.style.transition = 'none';
    el.style.width = '0%';
    void el.offsetWidth; // リセットを即時反映してからtransitionを戻す
    el.style.transition = '';
  }
}

function playResultMeters() {
  const timeRatio = Math.min(game.elapsed / METER_TIME_FULL, 1);
  const starRatio = Math.min(game.starsCollected / METER_STAR_FULL, 1);
  const grazeRatio = Math.min(game.grazeCount / METER_GRAZE_FULL, 1);
  // 画面表示（display切替）の反映後に幅をセットしないとtransitionが効かない
  setTimeout(() => {
    document.getElementById('meter-time').style.width = (timeRatio * 100).toFixed(0) + '%';
    document.getElementById('meter-stars').style.width = (starRatio * 100).toFixed(0) + '%';
    document.getElementById('meter-graze').style.width = (grazeRatio * 100).toFixed(0) + '%';
  }, 80);
}

// ----- NEW RECORD用の金色スパークル（DOMパーティクル） -----
function spawnRecordSparkles(isNewRecord) {
  const wrap = document.getElementById('record-wrap');
  wrap.querySelectorAll('.gold-sparkle').forEach((el) => el.remove());
  if (!isNewRecord) return;
  for (let i = 0; i < 16; i++) {
    const sp = document.createElement('span');
    sp.className = 'gold-sparkle';
    sp.style.left = (4 + Math.random() * 92) + '%';
    sp.style.top = (Math.random() * 90) + '%';
    sp.style.animationDelay = (Math.random() * 1.6).toFixed(2) + 's';
    sp.style.animationDuration = (1.2 + Math.random() * 1.2).toFixed(2) + 's';
    wrap.appendChild(sp);
  }
}

/* =========================================================
 * 描画処理
 * ========================================================= */
function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();

  // サージ予兆・発動中と衝突時は画面を揺らす
  let shakeX = 0;
  let shakeY = 0;
  if (game.surge.state === 'warning' || game.surge.state === 'active') {
    shakeX += randRange(-3, 3);
    shakeY += randRange(-3, 3);
  }
  if (game.shakeTime > 0) {
    const mag = game.shakeMag * (game.shakeTime / 0.35);
    shakeX += randRange(-mag, mag);
    shakeY += randRange(-mag, mag);
  }
  ctx.translate(shakeX, shakeY);

  drawStarsBackground();
  drawBlackHole();
  drawStarsItems();
  drawMeteors();
  drawDashTrail();
  drawPlayer();
  drawParticles();
  drawFloatTexts();
  drawBubble();

  ctx.restore();
}

// 背景の小さな星（ゆっくり明滅）
const bgStars = Array.from({ length: 60 }, () => ({
  x: Math.random() * W,
  y: Math.random() * H,
  r: Math.random() * 1.5 + 0.5,
  phase: Math.random() * Math.PI * 2,
}));

function drawStarsBackground() {
  const t = performance.now() / 1000;
  for (const s of bgStars) {
    const alpha = 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(t * 1.5 + s.phase));
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
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

  // 降着円盤ふうの回転リング
  const t = performance.now() / 1000;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 0.6);
  ctx.strokeStyle = surging ? 'rgba(255,150,190,0.5)' : 'rgba(180,130,255,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.35, r * 1.08, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // サージ中は吸い込み線を描く
  if (surging) {
    ctx.strokeStyle = 'rgba(255,120,180,0.35)';
    ctx.lineWidth = 2;
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
    ctx.strokeStyle = 'rgba(255,226,122,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s.r * 1.4, 0); ctx.lineTo(s.r * 1.4, 0);
    ctx.moveTo(0, -s.r * 1.4); ctx.lineTo(0, s.r * 1.4);
    ctx.stroke();
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
    ctx.save();
    ctx.translate(m.x, m.y);
    // 隕石（ブタ）をゆっくり自転させる
    const t = performance.now() / 1000;
    ctx.rotate(t * 0.5 + m.r);

    // バリエーション画像 → 共通ブタ画像 → ベクター描画 の順にフォールバック
    if (m.img && m.img.complete && m.img.naturalWidth !== 0) {
      // 縦横比を保ったまま、長辺が当たり判定円の直径に収まるよう描画（非正方形画像対応）
      const iw = m.img.naturalWidth;
      const ih = m.img.naturalHeight;
      const s = (m.r * 2) / Math.max(iw, ih);
      ctx.drawImage(m.img, -(iw * s) / 2, -(ih * s) / 2, iw * s, ih * s);
    } else if (imgMeteor.complete && imgMeteor.naturalWidth !== 0) {
      ctx.drawImage(imgMeteor, -m.r, -m.r, m.r * 2, m.r * 2);
    } else {
      // 従来のベクター描画フォールバック
      ctx.beginPath();
      ctx.arc(0, 0, m.r, 0, Math.PI * 2);
      ctx.fillStyle = '#9a8f85';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-m.r * 0.25, -m.r * 0.25, m.r * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = '#b8ada0';
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawParticles() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter'; // 加算合成で光って見せる
  for (const pt of game.particles) {
    const alpha = Math.max(pt.life / pt.maxLife, 0);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fillStyle = pt.color;
    ctx.fill();
  }
  ctx.restore();
}

function drawFloatTexts() {
  ctx.save();
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  for (const ft of game.floatTexts) {
    ctx.globalAlpha = Math.max(ft.life / ft.maxLife, 0);
    ctx.fillStyle = '#ffe27a';
    ctx.shadowColor = '#ffe27a';
    ctx.shadowBlur = 8;
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.restore();
}

function drawDashTrail() {
  for (const t of game.dash.trail) {
    ctx.beginPath();
    ctx.arc(t.x, t.y, game.player.r * PLAYER_DRAW_SCALE * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(143,216,255,${t.life})`;
    ctx.fill();
  }
}

// プレイヤー描画は画像差し替えを想定して専用関数に分離
function drawPlayer() {
  const p = game.player;
  const scale = game.phase === 'dying' ? Math.max(game.death.scale ?? 1, 0) : 1;
  const r = p.r * PLAYER_DRAW_SCALE * scale;
  if (r <= 0.5) return;

  ctx.save();
  ctx.translate(p.x, p.y);
  
  // 螺旋吸い込まれ時は回転を加える
  if (game.phase === 'dying') {
    const progress = game.death.t / DEATH_ANIM_DURATION;
    ctx.rotate(progress * Math.PI * 6);
  }

  if (imgPlayer.complete && imgPlayer.naturalWidth !== 0) {
    // 画像オブジェクトで描画
    ctx.drawImage(imgPlayer, -r, -r, r * 2, r * 2);
  } else {
    // 従来のベクター描画フォールバック
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ff8fc8';
    ctx.shadowColor = '#ff8fc8';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffd9ec';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (scale > 0.4) {
      ctx.fillStyle = '#5a2040';
      ctx.beginPath();
      ctx.arc(-r * 0.3, -r * 0.15, r * 0.12, 0, Math.PI * 2);
      ctx.arc(r * 0.3, -r * 0.15, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, r * 0.2, r * 0.25, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.strokeStyle = '#5a2040';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
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
  let by = p.y - p.r * PLAYER_DRAW_SCALE - bh - 14;
  bx = Math.max(4, Math.min(W - bw - 4, bx));
  by = Math.max(4, by);

  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 10);
  ctx.fill();
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
let dashWasReady = false; // READYになった瞬間のフラッシュ検出用

function updateHud() {
  scoreValueEl.textContent = currentScore();
  timeValueEl.textContent = game.elapsed.toFixed(1);

  const dash = game.dash;
  const ratio = dash.cooldownLeft > 0 ? 1 - dash.cooldownLeft / P.DASH_COOLDOWN : 1;
  const ready = ratio >= 1;
  dashGaugeEl.style.width = (ratio * 100).toFixed(0) + '%';
  dashGaugeEl.classList.toggle('ready', ready);

  // READYの立ち上がりで「パッ」と光るフラッシュを一度だけ再生
  if (ready && !dashWasReady) {
    dashGaugeOuterEl.classList.remove('flash');
    void dashGaugeOuterEl.offsetWidth; // アニメーション再トリガーのためのリフロー
    dashGaugeOuterEl.classList.add('flash');
  }
  dashWasReady = ready;

  dashLabelEl.textContent = ready ? 'READY' : 'DASH';
  dashLabelEl.classList.toggle('ready', ready);
}

/* =========================================================
 * UIイベント（難易度選択・画面遷移・ミュート）
 * ========================================================= */
document.querySelectorAll('.difficulty-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedLevel = btn.dataset.level;
    document.querySelectorAll('.difficulty-btn').forEach((b) => {
      b.classList.toggle('selected', b === btn);
    });
    AudioEngine.ensure();
    AudioEngine.se('click');
  });
});

document.getElementById('btn-start').addEventListener('click', () => {
  AudioEngine.ensure();
  AudioEngine.se('click');
  startGame();
});

document.getElementById('btn-retry').addEventListener('click', () => {
  AudioEngine.ensure();
  AudioEngine.se('click');
  startGame();
});

document.getElementById('btn-title').addEventListener('click', () => {
  AudioEngine.ensure();
  AudioEngine.se('click');
  refreshTitleHighscores();
  showScreen('title');
});

const muteBtn = document.getElementById('btn-mute');

function refreshMuteIcon() {
  muteBtn.textContent = AudioEngine.muted ? '🔇' : '🔊';
}

muteBtn.addEventListener('click', () => {
  AudioEngine.toggleMute();
  refreshMuteIcon();
});

// 初期表示
refreshMuteIcon();
refreshTitleHighscores();
showScreen('title');
