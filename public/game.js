/* MINI CUP '26 — 5v5 chibi-mascot world-cup soccer.
 * Host-authoritative simulation; guest interpolates 20Hz snapshots and
 * streams inputs back. Solo mode runs the same sim with a CPU rival. */
'use strict';

/* ============================== utils ============================== */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const r1 = (n) => Math.round(n * 10) / 10;
const FONT = '"Arial Rounded MT Bold","Avenir Next","Trebuchet MS",system-ui,sans-serif';
const IS_TOUCH = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;

function rr(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

/* ============================== field ============================== */
const W = 1280, H = 800;
const F = { left: 90, right: 1190, top: 110, bottom: 690 };
F.cx = (F.left + F.right) / 2;
F.cy = (F.top + F.bottom) / 2;
F.w = F.right - F.left;
F.h = F.bottom - F.top;
const GOAL = { mouth: 170, depth: 30 };
const P_R = 16, B_R = 9;
const KICK_RANGE = 34;
const HALF_LEN = 150; // seconds per half
const STEP = 1 / 60;

/* ============================== teams ============================== */
const TEAMS = [
  { name: 'Brazil',      code: 'BRA', body: '#FFCE00', trim: '#009C3B', flag: { k: 'bra' } },
  { name: 'Argentina',   code: 'ARG', body: '#9CD3F0', trim: '#1F5FA8', flag: { k: 'h', s: ['#75AADB', '#F4F6F7', '#75AADB'] } },
  { name: 'France',      code: 'FRA', body: '#1E4FC2', trim: '#EF4135', flag: { k: 'v', s: ['#0055A4', '#F4F6F7', '#EF4135'] } },
  { name: 'Germany',     code: 'GER', body: '#F2F2F2', trim: '#1A1A1A', flag: { k: 'h', s: ['#151515', '#DD0000', '#FFCE00'] } },
  { name: 'Spain',       code: 'ESP', body: '#C8102E', trim: '#F1BF00', flag: { k: 'h', s: ['#AA151B', '#F1BF00', '#AA151B'] } },
  { name: 'England',     code: 'ENG', body: '#FAFAFA', trim: '#CE1124', flag: { k: 'eng' } },
  { name: 'Italy',       code: 'ITA', body: '#0B63C5', trim: '#F4F6F7', flag: { k: 'v', s: ['#009246', '#F4F6F7', '#CE2B37'] } },
  { name: 'Portugal',    code: 'POR', body: '#D6001C', trim: '#046A38', flag: { k: 'por' } },
  { name: 'USA',         code: 'USA', body: '#3C3B6E', trim: '#B22234', flag: { k: 'usa' } },
  { name: 'Japan',       code: 'JPN', body: '#3050C8', trim: '#E60012', flag: { k: 'jpn' } },
  { name: 'Mexico',      code: 'MEX', body: '#006847', trim: '#CE1126', flag: { k: 'v', s: ['#006847', '#F4F6F7', '#CE1126'] } },
  { name: 'Netherlands', code: 'NED', body: '#FF7A00', trim: '#21468B', flag: { k: 'h', s: ['#AE1C28', '#F4F6F7', '#21468B'] } },
];

function drawFlag(c, x, y, w, h, team) {
  const f = team.flag;
  const white = '#F4F6F7';
  c.save();
  rr(c, x, y, w, h, 3);
  c.clip();
  if (f.k === 'h') {
    f.s.forEach((col, i) => { c.fillStyle = col; c.fillRect(x, y + (h * i) / f.s.length, w, h / f.s.length + 1); });
  } else if (f.k === 'v') {
    f.s.forEach((col, i) => { c.fillStyle = col; c.fillRect(x + (w * i) / f.s.length, y, w / f.s.length + 1, h); });
  } else if (f.k === 'bra') {
    c.fillStyle = '#009C3B'; c.fillRect(x, y, w, h);
    c.fillStyle = '#FEDF00';
    c.beginPath();
    c.moveTo(x + w / 2, y + h * 0.12); c.lineTo(x + w * 0.9, y + h / 2);
    c.lineTo(x + w / 2, y + h * 0.88); c.lineTo(x + w * 0.1, y + h / 2);
    c.closePath(); c.fill();
    c.fillStyle = '#002776'; c.beginPath(); c.arc(x + w / 2, y + h / 2, h * 0.2, 0, TAU); c.fill();
  } else if (f.k === 'jpn') {
    c.fillStyle = white; c.fillRect(x, y, w, h);
    c.fillStyle = '#E60012'; c.beginPath(); c.arc(x + w / 2, y + h / 2, h * 0.26, 0, TAU); c.fill();
  } else if (f.k === 'eng') {
    c.fillStyle = white; c.fillRect(x, y, w, h);
    c.fillStyle = '#CE1124';
    c.fillRect(x, y + h / 2 - h * 0.09, w, h * 0.18);
    c.fillRect(x + w / 2 - w * 0.06, y, w * 0.12, h);
  } else if (f.k === 'por') {
    c.fillStyle = '#046A38'; c.fillRect(x, y, w * 0.4, h);
    c.fillStyle = '#DA291C'; c.fillRect(x + w * 0.4, y, w * 0.6, h);
    c.fillStyle = '#FFE900'; c.beginPath(); c.arc(x + w * 0.4, y + h / 2, h * 0.18, 0, TAU); c.fill();
  } else if (f.k === 'usa') {
    c.fillStyle = white; c.fillRect(x, y, w, h);
    c.fillStyle = '#B22234';
    for (let i = 0; i < 7; i += 2) c.fillRect(x, y + (h * i) / 7, w, h / 7 + 0.5);
    c.fillStyle = '#3C3B6E'; c.fillRect(x, y, w * 0.42, (h * 4) / 7);
    c.fillStyle = white;
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 4; col++) {
        c.beginPath();
        c.arc(x + w * 0.06 + col * w * 0.1, y + h * 0.09 + row * h * 0.16, Math.max(1, h * 0.035), 0, TAU);
        c.fill();
      }
  }
  c.restore();
  c.strokeStyle = 'rgba(0,0,0,.45)';
  c.lineWidth = 1;
  rr(c, x, y, w, h, 3);
  c.stroke();
}

/* ============================== audio ============================== */
const AudioFx = {
  ctx: null, master: null, crowdGain: null, crowdFilter: null, muted: false,
  ensure() {
    // iOS uses a non-standard 'interrupted' state after calls/Siri/lock —
    // resume from any non-running state, not just 'suspended'.
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(c.destination);
    // crowd bed: looped brown-ish noise through a lowpass
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.03 * (Math.random() * 2 - 1)) / 1.03; d[i] = last * 3; }
    const src = c.createBufferSource();
    src.buffer = buf; src.loop = true;
    this.crowdFilter = c.createBiquadFilter();
    this.crowdFilter.type = 'lowpass'; this.crowdFilter.frequency.value = 500;
    this.crowdGain = c.createGain(); this.crowdGain.gain.value = 0.05;
    src.connect(this.crowdFilter); this.crowdFilter.connect(this.crowdGain); this.crowdGain.connect(this.master);
    src.start();
  },
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 1; },
  tick(excitement) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.crowdGain.gain.setTargetAtTime(0.05 + 0.16 * excitement, t, 0.25);
    this.crowdFilter.frequency.setTargetAtTime(500 + 2200 * excitement, t, 0.25);
  },
  _osc(type, freq, t0, dur, peak = 0.2, glide) {
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },
  beep(f = 600) { if (this.ctx) this._osc('square', f, this.ctx.currentTime, 0.12, 0.1); },
  whistle(n = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < n; i++) {
      const dur = n === 1 ? 0.5 : 0.16;
      this._osc('square', 2350, t + i * 0.26, dur, 0.07);
      this._osc('square', 2960, t + i * 0.26, dur, 0.045);
    }
  },
  kick() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    this._osc('sine', 120, t, 0.09, 0.3, 50);
    const len = (c.sampleRate * 0.06) | 0;
    const b = c.createBuffer(1, len, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(); s.buffer = b;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 800;
    const g = c.createGain(); g.gain.value = 0.22;
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t);
  },
  goal() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    [220, 277, 330, 440].forEach((f, i) => this._osc('sawtooth', f, t + 0.03 * i, 1.1, 0.08));
    const len = (c.sampleRate * 1.3) | 0;
    const b = c.createBuffer(1, len, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) { const e = Math.sin((Math.PI * i) / len); d[i] = (Math.random() * 2 - 1) * e; }
    const s = c.createBufferSource(); s.buffer = b;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 900;
    const g = c.createGain(); g.gain.value = 0.14;
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t);
  },
};

/* ============================== input ============================== */
const Input = {
  keys: new Set(),
  passSeq: 0,
  shootSeq: 0,
  init() {
    addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT') return;
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (k === 'x' || k === 'j') pressPass();
      if (k === ' ' || k === 'k') pressShoot();
      if (k === 'm') toggleMute();
      if (k === 'enter') requestRematch();
      AudioFx.ensure();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());
  },
  axes() {
    let ax = 0, ay = 0;
    if (this.keys.has('arrowleft') || this.keys.has('a')) ax -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d')) ax += 1;
    if (this.keys.has('arrowup') || this.keys.has('w')) ay -= 1;
    if (this.keys.has('arrowdown') || this.keys.has('s')) ay += 1;
    if (ax && ay) { ax *= 0.7071; ay *= 0.7071; }
    if (Touch.ax || Touch.ay) { ax = Touch.ax; ay = Touch.ay; } // analog stick wins
    return { ax, ay, sprint: this.keys.has('shift') || Touch.sprint };
  },
};

/* Shared press actions for keyboard and touch buttons. */
function pressPass() {
  Input.passSeq++;
  AudioFx.ensure();
  if (mode === 'guest') sendGuestInput(performance.now(), true);
}
function pressShoot() {
  Input.shootSeq++;
  AudioFx.ensure();
  if (mode === 'guest') sendGuestInput(performance.now(), true);
}

/* ============================== touch controls ============================== */
/* Floating joystick on the left 55% of the screen; PASS / SHOOT / SPRINT
 * buttons bottom-right. Multi-touch: the stick tracks its own touch id, each
 * button tracks its own presses. */
const Touch = {
  ax: 0, ay: 0, sprint: false,
  stickId: null, originX: 0, originY: 0,
  init() {
    if (!IS_TOUCH) return;
    const zone = UI.el.touchZone, stick = UI.el.stick, knob = UI.el.stickKnob;
    const R = 52;
    const setStick = (dx, dy) => {
      const d = Math.hypot(dx, dy) || 1;
      const cl = Math.min(d, R);
      const ux = dx / d, uy = dy / d;
      knob.style.transform = `translate(${ux * cl}px, ${uy * cl}px)`;
      const mag = cl / R;
      const m = mag < 0.18 ? 0 : mag; // deadzone
      this.ax = ux * m;
      this.ay = uy * m;
    };
    zone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      AudioFx.ensure();
      for (const t of e.changedTouches) {
        if (this.stickId !== null) continue;
        this.stickId = t.identifier;
        this.originX = t.clientX;
        this.originY = t.clientY;
        stick.style.left = t.clientX + 'px';
        stick.style.top = t.clientY + 'px';
        stick.classList.add('on');
        setStick(0, 0);
      }
    }, { passive: false });
    zone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== this.stickId) continue;
        setStick(t.clientX - this.originX, t.clientY - this.originY);
      }
    }, { passive: false });
    const end = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== this.stickId) continue;
        this.stickId = null;
        this.ax = 0;
        this.ay = 0;
        stick.classList.remove('on');
      }
    };
    zone.addEventListener('touchend', end, { passive: false });
    zone.addEventListener('touchcancel', end, { passive: false });

    this._bind(UI.el.tbtnPass, () => pressPass());
    this._bind(UI.el.tbtnShoot, () => pressShoot());
    this._bind(UI.el.tbtnSprint, () => { this.sprint = true; }, () => { this.sprint = false; });
  },
  _bind(el, down, up) {
    // Count active touches per button: a second fingertip brushing a held
    // button must not double-fire down() or release a still-held SPRINT.
    el._active = 0;
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      AudioFx.ensure();
      const was = el._active;
      el._active += e.changedTouches.length;
      if (was === 0) {
        el.classList.add('pressed');
        down();
      }
    }, { passive: false });
    const release = (e) => {
      e.preventDefault();
      el._active = Math.max(0, el._active - e.changedTouches.length);
      if (el._active === 0) {
        el.classList.remove('pressed');
        if (up) up();
      }
    };
    el.addEventListener('touchend', release, { passive: false });
    el.addEventListener('touchcancel', release, { passive: false });
  },
  /** Clear all latched touch state — called whenever the touch UI is hidden
   * mid-gesture (opponent left, menu, end screen). */
  reset() {
    this.stickId = null;
    this.ax = 0;
    this.ay = 0;
    this.sprint = false;
    if (!UI.el.stick) return;
    UI.el.stick.classList.remove('on');
    for (const el of [UI.el.tbtnPass, UI.el.tbtnShoot, UI.el.tbtnSprint]) {
      if (el) { el._active = 0; el.classList.remove('pressed'); }
    }
  },
};

/* ============================== game state ============================== */
let mode = null;          // 'solo' | 'host' | 'guest'
let running = false;
let state = 'menu';       // menu|countdown|play|golden|goal|break|full
let stateT = 0;
let cdLen = 3.2, cdRemain = 0;
let breakKind = 'half';   // 'half' | 'golden'
let teamA = 0, teamB = 1;
let score = [0, 0], half = 1, clock = 0;
let players = [];
let ball = { x: F.cx, y: F.cy, vx: 0, vy: 0, rot: 0 };
let ctrl = [3, 8];        // global player indices under human control (A, B)
let goalSeq = 0, kickSeq = 0, whistleSeq = 0, lastScorer = 0, pendingKick = 0;
let excite = 0;
let guestInput = { ax: 0, ay: 0, sp: false, ps: 0, ss: 0 };
const seen = { a: { p: 0, s: 0 }, b: { p: 0, s: 0 } };
let net = null;
let myPick = Math.floor(rnd(TEAMS.length));
let snaps = [];           // guest snapshot buffer
let gview = { players: [], ball: { x: F.cx, y: F.cy, vx: 0, vy: 0, rot: 0 } };
let confetti = [];
let flashT = 999; // seconds since the last goal, drives the white flash on host AND guest
let joinBusy = false;
let lastT = performance.now(), acc = 0, lastSnapT = 0, lastInSend = 0;

const SPOTS = [[30, 0], [170, -125], [170, 125], [430, -85], [430, 85]]; // GK, D, D, F, F

function makePlayers() {
  const arr = [];
  const nums = [1, 4, 8, 10, 9];
  for (let t = 0; t < 2; t++)
    for (let i = 0; i < 5; i++)
      arr.push({ team: t, i, gk: i === 0, num: nums[i], x: F.cx, y: F.cy, vx: 0, vy: 0, kickCd: 0, squash: 0, step: rnd(TAU) });
  return arr;
}

function spotBase(p) {
  const dir = p.team === 0 ? 1 : -1;
  const gx = p.team === 0 ? F.left : F.right;
  return { x: gx + dir * SPOTS[p.i][0], y: F.cy + SPOTS[p.i][1] };
}

function spotShifted(p) {
  const s = spotBase(p);
  return {
    x: clamp(s.x + (ball.x - F.cx) * 0.32, F.left + 30, F.right - 30),
    y: clamp(s.y + (ball.y - F.cy) * 0.28, F.top + 26, F.bottom - 26),
  };
}

function kickoff(kickTeam) {
  for (const p of players) {
    const s = spotBase(p);
    p.x = s.x; p.y = s.y; p.vx = 0; p.vy = 0; p.kickCd = 0;
  }
  const taker = players[kickTeam * 5 + 4];
  taker.x = F.cx - (kickTeam === 0 ? 1 : -1) * 34;
  taker.y = F.cy;
  ball.x = F.cx; ball.y = F.cy; ball.vx = 0; ball.vy = 0;
  ctrl = [3, 8];
  ctrl[kickTeam] = kickTeam * 5 + 4;
}

function setState(s) { state = s; stateT = 0; }
function startCountdown(len) { cdLen = len; cdRemain = len; setState('countdown'); }

/* ============================== simulation ============================== */
function step(dt) {
  stateT += dt;
  if (state === 'countdown') {
    cdRemain = Math.max(0, cdLen - stateT);
    if (cdRemain <= 0) { setState(half === 3 ? 'golden' : 'play'); whistleSeq++; }
  } else if (state === 'play' || state === 'golden') {
    if (state === 'play') clock += dt;
    simulate(dt);
    if (state === 'play') {
      if (half === 1 && clock >= HALF_LEN) { breakKind = 'half'; setState('break'); whistleSeq += 2; }
      else if (half === 2 && clock >= HALF_LEN * 2) {
        if (score[0] !== score[1]) endMatch();
        else { breakKind = 'golden'; setState('break'); whistleSeq += 2; }
      }
    }
    if (state === 'play' || state === 'golden') {
      autoSwitch(0);
      if (mode === 'host') autoSwitch(1);
    }
  } else if (state === 'goal') {
    if (stateT >= 3.0) {
      if (half === 3) endMatch();
      else { kickoff(pendingKick); startCountdown(2.0); }
    }
  } else if (state === 'break') {
    if (stateT >= 3.2) {
      if (breakKind === 'half') { half = 2; kickoff(1); startCountdown(2.6); }
      else { half = 3; kickoff(Math.random() < 0.5 ? 0 : 1); startCountdown(2.6); }
    }
  }
}

function simulate(dt) {
  for (const p of players) {
    p.kickCd = Math.max(0, p.kickCd - dt);
    p.squash = Math.max(0, p.squash - 3.5 * dt);
  }
  const a = Input.axes();
  applyHuman(players[ctrl[0]], { ax: a.ax, ay: a.ay, sp: a.sprint, ps: Input.passSeq, ss: Input.shootSeq }, seen.a, dt);
  if (mode === 'host') applyHuman(players[ctrl[1]], guestInput, seen.b, dt);
  teamAI(0, dt);
  teamAI(1, dt);
  for (const p of players) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = clamp(p.x, F.left + P_R * 0.6, F.right - P_R * 0.6);
    p.y = clamp(p.y, F.top + P_R * 0.6, F.bottom - P_R * 0.6);
    p.step += Math.hypot(p.vx, p.vy) * dt * 0.05;
  }
  // shoulder-to-shoulder separation
  for (let i = 0; i < players.length; i++)
    for (let j = i + 1; j < players.length; j++) {
      const p = players[i], q = players[j];
      const d = dist(p.x, p.y, q.x, q.y);
      const min = P_R * 1.7;
      if (d > 0.001 && d < min) {
        const push = (min - d) / 2, nx = (q.x - p.x) / d, ny = (q.y - p.y) / d;
        p.x -= nx * push; p.y -= ny * push;
        q.x += nx * push; q.y += ny * push;
      }
    }
  stepBall(dt);
}

function applyHuman(p, inp, seenRec, dt) {
  if (!p) return;
  const sp = inp.sp ? 335 : 255;
  const k = Math.min(1, 10 * dt);
  p.vx += (inp.ax * sp - p.vx) * k;
  p.vy += (inp.ay * sp - p.vy) * k;
  const near = dist(p.x, p.y, ball.x, ball.y) <= KICK_RANGE;
  if (inp.ps !== seenRec.p) { seenRec.p = inp.ps; if (near && p.kickCd <= 0) doPass(p, inp); }
  if (inp.ss !== seenRec.s) { seenRec.s = inp.ss; if (near && p.kickCd <= 0) doShoot(p, inp); }
}

function doPass(p, inp) {
  let ax = inp.ax, ay = inp.ay;
  if (!ax && !ay) {
    const s = Math.hypot(p.vx, p.vy);
    if (s > 30) { ax = p.vx / s; ay = p.vy / s; }
    else { ax = p.team === 0 ? 1 : -1; ay = 0; }
  }
  const al = Math.hypot(ax, ay);
  ax /= al; ay /= al;
  let best = null, bestScore = 1e9;
  for (const q of players) {
    if (q.team !== p.team || q === p) continue;
    const d = dist(p.x, p.y, q.x, q.y);
    if (d < 40 || d > 480) continue;
    const ux = (q.x - p.x) / d, uy = (q.y - p.y) / d;
    const dot = ux * ax + uy * ay;
    if (dot < 0.55) continue; // ~56° assist cone
    const s = d * (1.6 - dot);
    if (s < bestScore) { bestScore = s; best = q; }
  }
  if (best) {
    const tx = best.x + best.vx * 0.25, ty = best.y + best.vy * 0.25;
    kickBall(p, tx, ty, clamp(dist(ball.x, ball.y, tx, ty) * 1.7, 330, 660));
  } else {
    kickBall(p, ball.x + ax * 300, ball.y + ay * 300, 480);
  }
  p.kickCd = 0.3;
}

function doShoot(p, inp) {
  const gx = p.team === 0 ? F.right : F.left;
  const ty = F.cy + (inp.ay || 0) * 75 + rnd(-28, 28);
  kickBall(p, gx + (p.team === 0 ? B_R * 2 : -B_R * 2), ty, 770 + rnd(60));
  p.kickCd = 0.35;
}

function kickBall(p, tx, ty, power) {
  const d = Math.max(1, dist(ball.x, ball.y, tx, ty));
  ball.vx = ((tx - ball.x) / d) * power;
  ball.vy = ((ty - ball.y) / d) * power;
  kickSeq++;
  p.squash = 1;
  excite = Math.max(excite, 0.5);
}

function humanCtrlIdx(t) {
  if (mode === 'guest') return -1;
  if (t === 0) return ctrl[0];
  return mode === 'host' ? ctrl[1] : -1;
}

function teamAI(t, dt) {
  const base = t * 5;
  const humanIdx = humanCtrlIdx(t);
  const bfx = ball.x + ball.vx * 0.22, bfy = ball.y + ball.vy * 0.22;
  const ais = [];
  for (let i = 1; i < 5; i++) if (base + i !== humanIdx) ais.push(players[base + i]);
  ais.sort((p, q) => dist(p.x, p.y, bfx, bfy) - dist(q.x, q.y, bfx, bfy));
  const defThird = t === 0 ? ball.x < F.left + F.w / 3 : ball.x > F.right - F.w / 3;
  const nChase = defThird ? 2 : 1;
  ais.forEach((p, idx) => {
    if (idx < nChase) {
      steer(p, bfx, bfy, 262, dt);
      aiKick(p);
    } else {
      const s = spotShifted(p);
      steer(p, s.x, s.y, 225, dt);
      if (dist(p.x, p.y, ball.x, ball.y) < KICK_RANGE) aiKick(p);
    }
  });
  gkAI(players[base], dt);
}

function steer(p, tx, ty, speed, dt) {
  const d = dist(p.x, p.y, tx, ty);
  const k = Math.min(1, 8 * dt);
  if (d < 4) {
    p.vx -= p.vx * k;
    p.vy -= p.vy * k;
    return;
  }
  const sp = Math.min(speed, d * 4);
  p.vx += ((tx - p.x) / d * sp - p.vx) * k;
  p.vy += ((ty - p.y) / d * sp - p.vy) * k;
}

function aiKick(p) {
  if (p.kickCd > 0 || dist(p.x, p.y, ball.x, ball.y) > KICK_RANGE) return;
  const gx = p.team === 0 ? F.right : F.left;
  const dGoal = dist(p.x, p.y, gx, F.cy);
  if (dGoal < 350) {
    kickBall(p, gx + (p.team === 0 ? 18 : -18), F.cy + rnd(-58, 58), 730 + rnd(70));
    p.kickCd = 0.9;
    return;
  }
  const fwd = p.team === 0 ? 1 : -1;
  let best = null, bd = 1e9;
  for (const q of players) {
    if (q.team !== p.team || q === p || q.gk) continue;
    if ((q.x - p.x) * fwd < 30) continue;
    const d = dist(p.x, p.y, q.x, q.y);
    if (d < 110 || d > 430) continue;
    if (d < bd) { bd = d; best = q; }
  }
  if (best && Math.random() < 0.8) {
    kickBall(p, best.x + best.vx * 0.25, best.y + best.vy * 0.25, clamp(bd * 1.6, 330, 620));
    p.kickCd = 0.8;
  } else {
    kickBall(p, p.x + fwd * 180, p.y + rnd(-60, 60), 300);
    p.kickCd = 0.55;
  }
}

function gkAI(gk, dt) {
  const t = gk.team;
  const gx = t === 0 ? F.left : F.right;
  const dir = t === 0 ? 1 : -1;
  const homeX = gx + dir * 24;
  let tx = homeX;
  let ty = clamp(ball.y, F.cy - GOAL.mouth / 2 + 10, F.cy + GOAL.mouth / 2 - 10);
  const dGoalBall = dist(ball.x, ball.y, gx, F.cy);
  const coming = t === 0 ? ball.vx < -60 : ball.vx > 60;
  if (dGoalBall < 260) {
    if (coming && Math.abs(ball.vx) > 1) {
      const tt = (homeX - ball.x) / ball.vx;
      if (tt > 0 && tt < 2) ty = clamp(ball.y + ball.vy * tt, F.cy - GOAL.mouth / 2 - 16, F.cy + GOAL.mouth / 2 + 16);
    }
    if (dist(gk.x, gk.y, ball.x, ball.y) < 115) { tx = ball.x; ty = ball.y; }
  }
  tx = t === 0 ? clamp(tx, F.left + 12, F.left + 130) : clamp(tx, F.right - 130, F.right - 12);
  steer(gk, tx, ty, dGoalBall < 260 ? 345 : 235, dt);
  if (dist(gk.x, gk.y, ball.x, ball.y) < KICK_RANGE && gk.kickCd <= 0) {
    kickBall(gk, F.cx + dir * 220, F.cy + rnd(-210, 210), 690);
    gk.kickCd = 0.9;
  }
}

function stepBall(dt) {
  // dribble / deflection contact
  for (const p of players) {
    const d = dist(p.x, p.y, ball.x, ball.y);
    const min = P_R + B_R - 2;
    if (d < min) {
      const nx = d > 0.001 ? (ball.x - p.x) / d : 1;
      const ny = d > 0.001 ? (ball.y - p.y) / d : 0;
      ball.x = p.x + nx * min;
      ball.y = p.y + ny * min;
      const pv = Math.hypot(p.vx, p.vy);
      const bv = Math.hypot(ball.vx, ball.vy);
      if (bv < pv * 1.4 + 40) {
        ball.vx = p.vx * 1.08 + nx * (26 + pv * 0.18);
        ball.vy = p.vy * 1.08 + ny * (26 + pv * 0.18);
      } else {
        ball.vx = ball.vx * 0.5 + nx * bv * 0.5;
        ball.vy = ball.vy * 0.5 + ny * bv * 0.5;
      }
    }
  }
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  const f = Math.pow(0.55, dt);
  ball.vx *= f;
  ball.vy *= f;
  if (Math.hypot(ball.vx, ball.vy) < 3) { ball.vx = 0; ball.vy = 0; }
  ball.rot += (Math.hypot(ball.vx, ball.vy) * dt) / B_R;

  const inMouth = Math.abs(ball.y - F.cy) < GOAL.mouth / 2;
  if (ball.y < F.top + B_R) { ball.y = F.top + B_R; ball.vy = Math.abs(ball.vy) * 0.66; }
  if (ball.y > F.bottom - B_R) { ball.y = F.bottom - B_R; ball.vy = -Math.abs(ball.vy) * 0.66; }
  if (ball.x < F.left + B_R) {
    if (inMouth) {
      if (ball.x < F.left - 6) return goalScored(1);
      const backX = F.left - GOAL.depth + B_R;
      if (ball.x < backX) { ball.x = backX; ball.vx = Math.abs(ball.vx) * 0.3; }
    } else {
      ball.x = F.left + B_R;
      ball.vx = Math.abs(ball.vx) * 0.66;
    }
  }
  if (ball.x > F.right - B_R) {
    if (inMouth) {
      if (ball.x > F.right + 6) return goalScored(0);
      const backX = F.right + GOAL.depth - B_R;
      if (ball.x > backX) { ball.x = backX; ball.vx = -Math.abs(ball.vx) * 0.3; }
    } else {
      ball.x = F.right - B_R;
      ball.vx = -Math.abs(ball.vx) * 0.66;
    }
  }
  if (Math.abs(ball.x - F.left) < 210 || Math.abs(ball.x - F.right) < 210) excite = Math.max(excite, 0.32);
}

function goalScored(t) {
  score[t]++;
  lastScorer = t;
  goalSeq++;
  pendingKick = 1 - t;
  excite = 1;
  setState('goal');
}

function autoSwitch(t) {
  const bfx = ball.x + ball.vx * 0.25, bfy = ball.y + ball.vy * 0.25;
  let bi = -1, bd = 1e9;
  for (let i = 1; i < 5; i++) {
    const p = players[t * 5 + i];
    const d = dist(p.x, p.y, bfx, bfy);
    if (d < bd) { bd = d; bi = t * 5 + i; }
  }
  const cur = players[ctrl[t]];
  const cd = dist(cur.x, cur.y, bfx, bfy);
  if (bi !== ctrl[t] && bd < cd * 0.8 - 14) ctrl[t] = bi;
}

function endMatch() {
  setState('full');
  whistleSeq += 3;
}

/* ============================== match flow ============================== */
function beginMatch() {
  UI.hideMenu();
  players = makePlayers();
  score = [0, 0]; half = 1; clock = 0; excite = 0;
  confetti.length = 0;
  flashT = 999;
  goalSeq = 0; kickSeq = 0; whistleSeq = 0;
  seen.a = { p: Input.passSeq, s: Input.shootSeq };
  seen.b = { p: guestInput.ps, s: guestInput.ss };
  kickoff(0);
  startCountdown(3.2);
  Fx.sync();
  snaps = [];
  running = true;
  UI.showTouchUI(true);
}

function beginMatchGuest() {
  UI.hideMenu();
  gview = { players: makePlayers(), ball: { x: F.cx, y: F.cy, vx: 0, vy: 0, rot: 0 } };
  score = [0, 0]; half = 1; clock = 0; excite = 0;
  confetti.length = 0;
  flashT = 999;
  goalSeq = 0; kickSeq = 0; whistleSeq = 0;
  state = 'countdown'; cdRemain = 3;
  Fx.sync();
  snaps = [];
  running = true;
  UI.showTouchUI(true);
}

function doRematch() {
  score = [0, 0]; half = 1; clock = 0; excite = 0;
  confetti.length = 0;
  // Discard pass/shoot presses queued on the end screen — the kickoff taker
  // spawns exactly at kick range, so a stale seq fires a ghost shot.
  seen.a = { p: Input.passSeq, s: Input.shootSeq };
  seen.b = { p: guestInput.ps, s: guestInput.ss };
  kickoff(0);
  startCountdown(3.0);
}

function requestRematch() {
  if (state !== 'full' || !running) return;
  if (mode === 'guest') {
    if (net) net.send({ t: 'rm' });
    UI.el.endNote.textContent = 'Rematch requested — waiting for the host…';
  } else {
    doRematch();
  }
}

function startSolo() {
  mode = 'solo';
  if (net) net.leave();
  teamA = myPick;
  do { teamB = Math.floor(rnd(TEAMS.length)); } while (teamB === teamA);
  UI.setBadge('SOLO');
  beginMatch();
}

function toMenu() {
  running = false;
  state = 'menu';
  mode = null;
  joinBusy = false;
  if (net) net.leave();
  UI.setBadge('');
  UI.showTouchUI(false);
  UI.showMenu();
}

function toMenuSoon() { setTimeout(toMenu, 1800); }

/* ============================== networking glue ============================== */
function getNet() {
  if (net) return net;
  net = new Net();
  net.onHosted = (code) => {
    UI.el.roomCode.textContent = code.split('').join(' ');
    UI.el.hostStatus.textContent = 'Share this code with your rival. Waiting…';
  };
  net.onJoined = () => { UI.el.joinStatus.textContent = 'Room found! Connecting to host…'; };
  net.onPeer = () => { UI.el.hostStatus.textContent = 'Rival found! Establishing link…'; };
  net.onReady = (transport) => {
    UI.setBadge(transport === 'p2p' ? '🟢 P2P' : '🟠 RELAY');
    net.send({ t: 'hello', pick: myPick });
  };
  net.onMsg = onNetMsg;
  net.onPeerLeft = (msg) => {
    joinBusy = false;
    if (running) {
      running = false;
      UI.toast(msg || 'Your opponent left the match');
      toMenuSoon();
    } else if (mode === 'host' && net.role === 'host') {
      // Guest backed out before kickoff — room and code are still alive.
      UI.setBadge('');
      UI.el.hostStatus.textContent = 'Rival left — waiting for a new challenger…';
      UI.showPanel('hostPanel');
      UI.el.menu.classList.remove('hidden');
      UI.toast(msg || 'Rival disconnected');
    } else {
      mode = null;
      UI.toast(msg || 'Peer disconnected');
      UI.showPanel('homePanel');
    }
  };
  net.onErr = (msg) => {
    joinBusy = false;
    UI.el.joinStatus.textContent = msg;
    UI.toast(msg);
  };
  return net;
}

function onNetMsg(m) {
  if (!m || typeof m.t !== 'string') return;
  switch (m.t) {
    case 'hello':
      if (mode === 'host') {
        const peerPick = Number.isInteger(m.pick) ? clamp(m.pick, 0, TEAMS.length - 1) : 0;
        teamA = myPick;
        teamB = peerPick === myPick ? (peerPick + 1) % TEAMS.length : peerPick;
        net.send({ t: 'setup', a: teamA, b: teamB });
        beginMatch();
      }
      break;
    case 'setup':
      if (mode === 'guest') { teamA = m.a; teamB = m.b; beginMatchGuest(); }
      break;
    case 'sn':
      if (mode === 'guest') onSnap(m);
      break;
    case 'in':
      if (mode === 'host') guestInput = m;
      break;
    case 'rm':
      if (mode === 'host' && state === 'full') doRematch();
      break;
  }
}

async function startHost() {
  mode = 'host';
  UI.showPanel('hostPanel');
  UI.el.roomCode.textContent = '· · · ·';
  UI.el.hostStatus.textContent = 'Creating room…';
  try {
    const n = getNet();
    await n.connect();
    n.host();
  } catch (e) {
    UI.toast('Could not reach the server');
    UI.showPanel('homePanel');
    mode = null;
  }
}

async function doJoin() {
  if (joinBusy) return; // double-click / Enter+click guard
  const code = UI.el.joinInput.value.trim().toUpperCase();
  if (code.length < 4) { UI.el.joinStatus.textContent = 'Enter the 4-letter code.'; return; }
  joinBusy = true;
  mode = 'guest';
  UI.el.joinStatus.textContent = 'Connecting…';
  try {
    const n = getNet();
    await n.connect();
    n.join(code);
  } catch (e) {
    UI.el.joinStatus.textContent = 'Could not reach the server.';
    mode = null;
    joinBusy = false;
  }
}

/* ---------- snapshots ---------- */
function makeSnap() {
  const p = new Array(40);
  for (let i = 0; i < 10; i++) {
    const q = players[i];
    p[i * 4] = r1(q.x); p[i * 4 + 1] = r1(q.y);
    p[i * 4 + 2] = r1(q.vx); p[i * 4 + 3] = r1(q.vy);
  }
  return {
    t: 'sn', st: state, hf: half, ck: r1(clock), cd: r1(cdRemain), bk: breakKind,
    sa: score[0], sb: score[1], gs: goalSeq, ks: kickSeq, ws: whistleSeq, ls: lastScorer,
    ca: ctrl[0], cb: ctrl[1],
    b: [r1(ball.x), r1(ball.y), r1(ball.vx), r1(ball.vy)], p,
  };
}

function onSnap(s) {
  snaps.push({ at: performance.now(), s });
  if (snaps.length > 30) snaps.shift();
}

function guestUpdate(now) {
  if (!snaps.length) return;
  const newest = snaps[snaps.length - 1].s;
  state = newest.st; half = newest.hf; clock = newest.ck;
  cdRemain = newest.cd; breakKind = newest.bk || 'half';
  score = [newest.sa, newest.sb];
  goalSeq = newest.gs; kickSeq = newest.ks; whistleSeq = newest.ws;
  lastScorer = newest.ls; ctrl = [newest.ca, newest.cb];

  const rt = now - 120; // render slightly in the past, between two snapshots
  while (snaps.length > 2 && snaps[1].at <= rt) snaps.shift();
  const A = snaps[0], B = snaps[1] || snaps[0];
  const span = Math.max(1, B.at - A.at);
  const k = clamp((rt - A.at) / span, 0, 1);
  if (!gview.players.length) gview.players = makePlayers();
  for (let i = 0; i < 10; i++) {
    const gp = gview.players[i];
    gp.x = lerp(A.s.p[i * 4], B.s.p[i * 4], k);
    gp.y = lerp(A.s.p[i * 4 + 1], B.s.p[i * 4 + 1], k);
    gp.vx = lerp(A.s.p[i * 4 + 2], B.s.p[i * 4 + 2], k);
    gp.vy = lerp(A.s.p[i * 4 + 3], B.s.p[i * 4 + 3], k);
    gp.step += Math.hypot(gp.vx, gp.vy) * STEP * 0.05;
  }
  gview.ball.x = lerp(A.s.b[0], B.s.b[0], k);
  gview.ball.y = lerp(A.s.b[1], B.s.b[1], k);
  gview.ball.vx = lerp(A.s.b[2], B.s.b[2], k);
  gview.ball.vy = lerp(A.s.b[3], B.s.b[3], k);
  gview.ball.rot += (Math.hypot(gview.ball.vx, gview.ball.vy) * STEP) / B_R;
}

function sendGuestInput(now, force) {
  if (!net || !net.ready) return;
  if (!force && now - lastInSend < 33) return;
  lastInSend = now;
  const a = Input.axes();
  net.send({ t: 'in', ax: a.ax, ay: a.ay, sp: a.sprint, ps: Input.passSeq, ss: Input.shootSeq });
}

/* ============================== fx watcher ============================== */
/* Both roles trigger sound/confetti purely off sequence counters, so the host
 * and guest share one code path. */
const Fx = {
  g: 0, k: 0, w: 0, cd: -1,
  sync() { this.g = goalSeq; this.k = kickSeq; this.w = whistleSeq; this.cd = -1; },
  check() {
    if (goalSeq !== this.g) { this.g = goalSeq; onGoalFx(); }
    if (kickSeq !== this.k) { this.k = kickSeq; AudioFx.kick(); }
    if (whistleSeq !== this.w) {
      const n = Math.min(3, whistleSeq - this.w);
      this.w = whistleSeq;
      AudioFx.whistle(Math.max(1, n));
    }
    if (state === 'countdown') {
      const n = Math.ceil(cdRemain);
      if (n !== this.cd) { this.cd = n; if (n > 0) AudioFx.beep(n === 1 ? 830 : 600); }
    }
  },
};

function onGoalFx() {
  AudioFx.goal();
  spawnConfetti();
  excite = 1;
  flashT = 0;
  UI.goalBanner(TEAMS[lastScorer === 0 ? teamA : teamB].name.toUpperCase());
}

function spawnConfetti() {
  const cols = ['#FFD75E', '#FF6B6B', '#6BCB77', '#4D96FF', '#FFFFFF', '#FF9F1C'];
  for (let i = 0; i < 140; i++) {
    confetti.push({
      x: rnd(W), y: rnd(-H * 0.3, 0),
      vx: rnd(-40, 40), vy: rnd(120, 260),
      rot: rnd(TAU), vr: rnd(-6, 6),
      c: cols[i % cols.length], w: rnd(5, 9), h: rnd(3, 6), life: rnd(2.5, 4),
    });
  }
}

function stepConfetti(dt) {
  for (const c of confetti) {
    c.x += c.vx * dt + Math.sin(c.rot * 2) * 0.6;
    c.y += c.vy * dt;
    c.rot += c.vr * dt;
    c.life -= dt;
  }
  confetti = confetti.filter((c) => c.life > 0 && c.y < H + 20);
}

/* ============================== rendering ============================== */
const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');
(function setupCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cvs.width = W * dpr;
  cvs.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
})();

const crowd = [];
(function buildCrowd() {
  // Fewer animated crowd dots on touch devices — fill-rate is the scarce
  // resource on phones.
  const K = IS_TOUCH ? 0.45 : 1;
  const cols = ['#e8c39e', '#d9a066', '#8d5524', '#f1d4af', '#ffd75e', '#ff6b6b', '#4d96ff', '#6bcb77', '#ffffff', '#c8b6ff'];
  function band(x0, x1, y0, y1, n) {
    for (let i = 0; i < Math.round(n * K); i++)
      crowd.push({ x: rnd(x0, x1), y: rnd(y0, y1), c: cols[Math.floor(rnd(cols.length))], ph: rnd(TAU), r: rnd(2.5, 4) });
  }
  band(20, W - 20, 16, 84, 320);
  band(20, W - 20, H - 84, H - 16, 320);
  band(10, 72, 120, H - 120, 130);
  band(W - 72, W - 10, 120, H - 120, 130);
})();

const ADS = ["MINI CUP '26", 'TINY COLA', "GOAL-O's", 'BANANA AIR', 'KICKR BOOTS', 'TURF & CO'];

// The stadium (background, stands, ad boards, pitch, goals) is static — render
// it once to an offscreen canvas and blit per frame. Big win on mobile GPUs.
const bgCanvas = document.createElement('canvas');
(function buildBg() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  bgCanvas.width = W * dpr;
  bgCanvas.height = H * dpr;
  const c = bgCanvas.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = '#0c1410';
  c.fillRect(0, 0, W, H);
  c.fillStyle = '#141f19';
  c.fillRect(0, 0, W, 100);
  c.fillRect(0, H - 100, W, 100);
  c.fillRect(0, 0, 84, H);
  c.fillRect(W - 84, 0, 84, H);
  drawAds(c);
  drawPitch(c);
})();

function render(now) {
  const t = now / 1000;
  ctx.drawImage(bgCanvas, 0, 0, W, H);
  drawCrowd(t);
  const v = mode === 'guest' ? gview : { players, ball };
  if (state !== 'menu' && v.players.length) {
    drawEntities(v, t);
    drawHUD();
  }
  drawConfettiLayer();
  drawBanners();
}

function drawCrowd(t) {
  const amp = 1.2 + excite * 4;
  ctx.globalAlpha = 0.85;
  for (const c of crowd) {
    const dy = Math.abs(Math.sin(t * 2.1 + c.ph)) * amp;
    ctx.fillStyle = c.c;
    ctx.fillRect(c.x, c.y - dy, c.r, c.r);
  }
  ctx.globalAlpha = 1;
}

function drawAds(c) {
  const bw = 176, bh = 20;
  c.font = 'bold 12px ' + FONT;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  let k = 0;
  for (let x = F.left; x + bw <= F.right + 2; x += bw + 4) {
    for (const y of [F.top - 26, F.bottom + 8]) {
      c.fillStyle = k % 2 ? '#20302a' : '#ffd75e';
      rr(c, x, y, bw, bh, 3);
      c.fill();
      c.fillStyle = k % 2 ? '#ffd75e' : '#20302a';
      c.fillText(ADS[k % ADS.length], x + bw / 2, y + bh / 2 + 1);
      k++;
    }
  }
}

function drawPitch(c) {
  const n = 10, bw = F.w / n;
  for (let i = 0; i < n; i++) {
    c.fillStyle = i % 2 ? '#2c8a43' : '#31954a';
    c.fillRect(F.left + i * bw, F.top, bw + 1, F.h);
  }
  c.strokeStyle = 'rgba(245,250,245,.85)';
  c.fillStyle = 'rgba(245,250,245,.85)';
  c.lineWidth = 3;
  c.strokeRect(F.left, F.top, F.w, F.h);
  c.beginPath(); c.moveTo(F.cx, F.top); c.lineTo(F.cx, F.bottom); c.stroke();
  c.beginPath(); c.arc(F.cx, F.cy, 72, 0, TAU); c.stroke();
  c.beginPath(); c.arc(F.cx, F.cy, 4, 0, TAU); c.fill();

  for (const side of [0, 1]) {
    const gx = side ? F.right : F.left;
    const dir = side ? -1 : 1;
    c.strokeRect(side ? gx - 140 : gx, F.cy - 150, 140, 300);
    c.strokeRect(side ? gx - 56 : gx, F.cy - 85, 56, 170);
    c.beginPath(); c.arc(gx + dir * 100, F.cy, 3.5, 0, TAU); c.fill();
    c.beginPath();
    if (side) c.arc(gx + dir * 100, F.cy, 62, Math.PI - 0.93, Math.PI + 0.93);
    else c.arc(gx + dir * 100, F.cy, 62, -0.93, 0.93);
    c.stroke();

    // goal + net
    const nx0 = side ? F.right : F.left - GOAL.depth;
    c.fillStyle = 'rgba(240,240,240,.13)';
    c.fillRect(nx0, F.cy - GOAL.mouth / 2, GOAL.depth, GOAL.mouth);
    c.save();
    c.strokeStyle = 'rgba(250,250,250,.4)';
    c.lineWidth = 1;
    for (let gxl = nx0 + 5; gxl < nx0 + GOAL.depth; gxl += 7) {
      c.beginPath(); c.moveTo(gxl, F.cy - GOAL.mouth / 2); c.lineTo(gxl, F.cy + GOAL.mouth / 2); c.stroke();
    }
    for (let gyl = F.cy - GOAL.mouth / 2 + 6; gyl < F.cy + GOAL.mouth / 2; gyl += 10) {
      c.beginPath(); c.moveTo(nx0, gyl); c.lineTo(nx0 + GOAL.depth, gyl); c.stroke();
    }
    c.restore();
    c.fillStyle = '#f8f8f8';
    c.fillRect(gx - 3, F.cy - GOAL.mouth / 2 - 7, 6, 7);
    c.fillRect(gx - 3, F.cy + GOAL.mouth / 2, 6, 7);
    c.fillStyle = 'rgba(245,250,245,.85)';
  }
}

function drawEntities(v, t) {
  const myCtrl = mode === 'guest' ? ctrl[1] : ctrl[0];
  const order = v.players.map((p, i) => ({ p, i })).sort((a, b) => a.p.y - b.p.y);
  for (const { p, i } of order) drawKicker(p, v.ball, i === myCtrl, t);
  drawBall(v.ball);
}

function drawKicker(p, b, isCtrl, t) {
  const tm = TEAMS[p.team === 0 ? teamA : teamB];
  const body = p.gk ? '#39404e' : tm.body;
  const trim = p.gk ? '#ffd75e' : tm.trim;
  const sp = Math.hypot(p.vx, p.vy);
  let fx, fy;
  if (sp > 25) { fx = p.vx / sp; fy = p.vy / sp; }
  else {
    const d = Math.max(1, dist(p.x, p.y, b.x, b.y));
    fx = (b.x - p.x) / d; fy = (b.y - p.y) / d;
  }

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.ellipse(p.x + 2, p.y + 13, 14, 6, 0, 0, TAU); ctx.fill();

  if (isCtrl) {
    ctx.strokeStyle = '#ffd75e';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 12, 18, 8, 0, 0, TAU); ctx.stroke();
    const bob = Math.sin(t * 5) * 3;
    ctx.fillStyle = '#ffd75e';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 38 + bob);
    ctx.lineTo(p.x - 7, p.y - 48 + bob);
    ctx.lineTo(p.x + 7, p.y - 48 + bob);
    ctx.closePath(); ctx.fill();
  }

  // feet
  const lift = Math.sin(p.step * 8) * (sp > 20 ? 3.5 : 0.6);
  ctx.fillStyle = '#26221c';
  ctx.beginPath(); ctx.ellipse(p.x - 6, p.y + 12 - Math.max(0, lift), 5, 3.4, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(p.x + 6, p.y + 12 - Math.max(0, -lift), 5, 3.4, 0, 0, TAU); ctx.fill();

  ctx.save();
  ctx.translate(p.x, p.y);
  const sy = 1 - p.squash * 0.16, sx = 1 + p.squash * 0.1;
  ctx.scale(sx, sy);

  // round body
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(0, -2, P_R, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // belly band + number
  ctx.fillStyle = trim;
  rr(ctx, -12, 2, 24, 11, 5.5);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = 'rgba(0,0,0,.55)';
  ctx.lineWidth = 2.5;
  ctx.font = '900 10px ' + FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(String(p.num), 0, 8);
  ctx.fillText(String(p.num), 0, 8);

  // headband
  ctx.strokeStyle = trim;
  ctx.lineWidth = 4.5;
  ctx.beginPath(); ctx.arc(0, -4, 13.5, Math.PI * 1.16, Math.PI * 1.84); ctx.stroke();

  // eyes track the ball
  const ex = fx * 2, ey = fy * 1.6;
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(side * 5 + ex, -8 + ey, 4.4, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#1c1c22';
    ctx.beginPath(); ctx.arc(side * 5 + ex + fx * 1.7, -8 + ey + fy * 1.7, 2.1, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath(); ctx.arc(side * 5 + ex + fx * 1.7 - 0.7, -8.7 + ey + fy * 1.7, 0.7, 0, TAU); ctx.fill();
  }

  // smile
  ctx.strokeStyle = 'rgba(30,20,10,.75)';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(ex * 0.6, -3.4 + ey * 0.5, 3.6, 0.35, Math.PI - 0.35); ctx.stroke();

  ctx.restore();
}

function drawBall(b) {
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(b.x + 3, b.y + 5, B_R * 0.9, B_R * 0.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fdfdfd';
  ctx.beginPath(); ctx.arc(b.x, b.y, B_R, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#23252a';
  for (let i = 0; i < 3; i++) {
    const a = b.rot + (i * TAU) / 3;
    ctx.beginPath();
    ctx.arc(b.x + Math.cos(a) * 4.5, b.y + Math.sin(a) * 4.5, 2.3, 0, TAU);
    ctx.fill();
  }
}

function drawHUD() {
  const cw = 340, ch = 56, x0 = W / 2 - cw / 2, y0 = 10;
  ctx.fillStyle = 'rgba(10,16,13,.84)';
  rr(ctx, x0, y0, cw, ch, 13); ctx.fill();
  ctx.strokeStyle = 'rgba(255,215,94,.5)';
  ctx.lineWidth = 1.5;
  rr(ctx, x0, y0, cw, ch, 13); ctx.stroke();
  drawFlag(ctx, x0 + 12, y0 + 12, 44, 30, TEAMS[teamA]);
  drawFlag(ctx, x0 + cw - 56, y0 + 12, 44, 30, TEAMS[teamB]);
  ctx.fillStyle = '#fff';
  ctx.font = '900 24px ' + FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${TEAMS[teamA].code} ${score[0]} - ${score[1]} ${TEAMS[teamB].code}`, W / 2, y0 + 30);
  ctx.font = '700 13px ' + FONT;
  ctx.fillStyle = '#ffd75e';
  const tag = half === 3 ? '⚡ NEXT GOAL WINS ⚡' : `${half === 1 ? '1ST' : '2ND'} HALF · ${fmtTime(clock)}`;
  ctx.fillText(tag, W / 2, y0 + 49);
  if (!IS_TOUCH) {
    ctx.font = '600 12px ' + FONT;
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.fillText('WASD / ARROWS move · X pass · SPACE shoot · SHIFT sprint · M mute', W / 2, H - 6);
  }
}

function drawBanners() {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (state === 'countdown' && cdRemain > 0.02) {
    const n = Math.ceil(cdRemain);
    const frac = 1 - (n - cdRemain);
    const sc = 1 + 0.25 * (1 - frac);
    ctx.save();
    ctx.translate(F.cx, F.cy - 40);
    ctx.scale(sc, sc);
    ctx.font = '900 110px ' + FONT;
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(12,20,15,.9)';
    ctx.strokeText(String(n), 0, 0);
    ctx.fillStyle = '#ffd75e';
    ctx.fillText(String(n), 0, 0);
    ctx.restore();
  }
  if (state === 'break') {
    const title = breakKind === 'half' ? 'HALF-TIME' : 'GOLDEN GOAL';
    const sub = breakKind === 'half' ? `${score[0]} - ${score[1]} — all to play for!` : 'Next goal wins the cup!';
    ctx.font = '900 72px ' + FONT;
    ctx.lineWidth = 9;
    ctx.strokeStyle = 'rgba(12,20,15,.9)';
    ctx.strokeText(title, F.cx, F.cy - 46);
    ctx.fillStyle = '#ffd75e';
    ctx.fillText(title, F.cx, F.cy - 46);
    ctx.font = '800 26px ' + FONT;
    ctx.lineWidth = 6;
    ctx.strokeText(sub, F.cx, F.cy + 16);
    ctx.fillStyle = '#fff';
    ctx.fillText(sub, F.cx, F.cy + 16);
  }
  const flashA = Math.max(0, 0.3 - flashT * 0.22);
  if (flashA > 0) { ctx.fillStyle = `rgba(255,255,255,${flashA})`; ctx.fillRect(0, 0, W, H); }
  ctx.textBaseline = 'alphabetic';
}

function drawConfettiLayer() {
  for (const c of confetti) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    ctx.fillStyle = c.c;
    ctx.globalAlpha = clamp(c.life, 0, 1);
    ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/* ============================== UI ============================== */
const UI = {
  el: {},
  _uiKey: '',
  _toastT: null,
  init() {
    const ids = ['menu', 'homePanel', 'hostPanel', 'joinPanel', 'teamGrid', 'btnSolo', 'btnHost', 'btnJoin',
      'roomCode', 'hostStatus', 'btnCancelHost', 'joinInput', 'btnDoJoin', 'joinStatus', 'btnCancelJoin',
      'goalBanner', 'goalText', 'endPanel', 'endTitle', 'endScore', 'endNote', 'btnRematch', 'btnMenu',
      'toast', 'badge', 'muteBtn', 'touchUI', 'touchZone', 'stick', 'stickKnob', 'tbtnPass', 'tbtnShoot', 'tbtnSprint'];
    for (const id of ids) this.el[id] = document.getElementById(id);

    TEAMS.forEach((tm, i) => {
      const cell = document.createElement('div');
      cell.className = 'team-cell' + (i === myPick ? ' sel' : '');
      cell.title = tm.name;
      const fc = document.createElement('canvas');
      fc.width = 66; fc.height = 44;
      drawFlag(fc.getContext('2d'), 1, 1, 64, 42, tm);
      const label = document.createElement('span');
      label.textContent = tm.code;
      cell.append(fc, label);
      cell.onclick = () => {
        myPick = i;
        [...this.el.teamGrid.children].forEach((e, j) => e.classList.toggle('sel', j === i));
        AudioFx.ensure();
      };
      this.el.teamGrid.appendChild(cell);
    });

    this.el.btnSolo.onclick = () => { AudioFx.ensure(); startSolo(); };
    this.el.btnHost.onclick = () => { AudioFx.ensure(); startHost(); };
    this.el.btnJoin.onclick = () => { AudioFx.ensure(); this.showPanel('joinPanel'); this.el.joinStatus.textContent = ''; this.el.joinInput.value = ''; this.el.joinInput.focus(); };
    this.el.btnDoJoin.onclick = () => doJoin();
    this.el.btnCancelHost.onclick = () => { if (net) net.leave(); mode = null; this.showPanel('homePanel'); };
    this.el.btnCancelJoin.onclick = () => { if (net) net.leave(); mode = null; joinBusy = false; this.showPanel('homePanel'); };
    this.el.btnRematch.onclick = () => requestRematch();
    this.el.btnMenu.onclick = () => toMenu();
    this.el.muteBtn.onclick = () => { AudioFx.ensure(); toggleMute(); };
    this.el.joinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doJoin(); });
    this.el.joinInput.addEventListener('input', () => {
      this.el.joinInput.value = this.el.joinInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });

    document.body.classList.toggle('touch', IS_TOUCH);
    if (IS_TOUCH) {
      document.querySelector('#homePanel .hint').textContent =
        'Left thumb: drag anywhere to move · Right thumb: PASS / SHOOT / SPRINT';
    }
  },
  showTouchUI(show) {
    const on = show && IS_TOUCH;
    const wasHidden = this.el.touchUI.classList.contains('hidden');
    this.el.touchUI.classList.toggle('hidden', !on);
    if (!on && !wasHidden) Touch.reset();
  },
  showPanel(name) {
    for (const p of ['homePanel', 'hostPanel', 'joinPanel']) this.el[p].classList.toggle('hidden', p !== name);
  },
  showMenu() {
    this.el.menu.classList.remove('hidden');
    this.showPanel('homePanel');
    this.el.endPanel.classList.add('hidden');
    this.el.goalBanner.classList.remove('show');
    this._uiKey = '';
  },
  hideMenu() { this.el.menu.classList.add('hidden'); },
  setBadge(txt) {
    this.el.badge.textContent = txt;
    this.el.badge.classList.toggle('hidden', !txt);
  },
  toast(msg, ms = 2800) {
    this.el.toast.textContent = msg;
    this.el.toast.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.el.toast.classList.remove('show'), ms);
  },
  goalBanner(teamName) {
    this.el.goalText.textContent = `GOOOOAL! ${teamName}!`;
    const b = this.el.goalBanner;
    b.classList.remove('show');
    void b.offsetWidth; // restart the CSS animation
    b.classList.add('show');
  },
  sync() {
    const key = `${state}|${mode}|${score[0]},${score[1]}`;
    if (key === this._uiKey) return;
    this._uiKey = key;
    if (state === 'full' && running) {
      const winner = score[0] === score[1] ? -1 : score[0] > score[1] ? 0 : 1;
      const tm = winner < 0 ? null : TEAMS[winner === 0 ? teamA : teamB];
      this.el.endTitle.textContent = tm ? `${tm.name.toUpperCase()} WINS THE MINI CUP!` : "IT'S A DRAW!";
      this.el.endScore.textContent = `${TEAMS[teamA].code} ${score[0]} — ${score[1]} ${TEAMS[teamB].code}`;
      this.el.btnRematch.textContent = mode === 'guest' ? 'REQUEST REMATCH' : 'REMATCH';
      this.el.endNote.textContent = mode === 'guest' ? 'The host controls the rematch' : '';
      this.el.endPanel.classList.remove('hidden');
      this.showTouchUI(false); // buttons in the viewport gutter outlive the stage overlay
    } else {
      this.el.endPanel.classList.add('hidden');
      if (running) this.showTouchUI(true);
    }
  },
};

function toggleMute() {
  AudioFx.setMuted(!AudioFx.muted);
  UI.el.muteBtn.textContent = AudioFx.muted ? '🔇' : '🔊';
}

/* ============================== main loop ============================== */
function tick(now) {
  // Hidden tabs get their timers clamped to >=1s by the browser; a generous dt
  // cap lets a hidden host catch the sim up in fixed steps instead of running
  // the match in slow motion for both players.
  const dt = Math.min(2.5, (now - lastT) / 1000);
  lastT = now;
  if (!running) return;
  flashT += dt;
  if (mode === 'guest') {
    guestUpdate(now);
    sendGuestInput(now, false);
  } else {
    acc = Math.min(acc + dt, 2.5);
    while (acc >= STEP) { step(STEP); acc -= STEP; }
    if (mode === 'host' && net && net.ready && now - lastSnapT >= 48) {
      net.send(makeSnap());
      lastSnapT = now;
    }
  }
  Fx.check();
  stepConfetti(dt);
  excite = Math.max(0, excite - dt * 0.5);
  AudioFx.tick(excite);
  UI.sync();
}

function frame(now) {
  tick(now);
  render(now);
  requestAnimationFrame(frame);
}

UI.init();
Input.init();
Touch.init();
requestAnimationFrame(frame);
// Keep the host simulating (and guest inputs flowing) when the tab is hidden —
// rAF pauses in background tabs, which would freeze the match for the peer.
// (iOS Safari suspends JS entirely when backgrounded; recovery below.)
setInterval(() => { if (document.hidden) tick(performance.now()); }, 50);

// iOS Safari suspends the page on app-switch/lock. On return: kick the audio
// session back to life, don't let dt spike, and drop stale guest snapshots so
// interpolation doesn't scrub across the gap. Dead sockets surface via
// ws.onclose → the normal peer-left flow.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (AudioFx.ctx && AudioFx.ctx.state !== 'running') AudioFx.ctx.resume();
  lastT = performance.now();
  if (mode === 'guest' && snaps.length > 1) snaps = [snaps[snaps.length - 1]];
});

// Safari's back-forward cache can restore this page with a dead WebSocket and
// stale match state — a fresh load is the only honest recovery.
window.addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });
