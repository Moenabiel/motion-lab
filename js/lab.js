/* Motion Lab — the exhibit engine.
   Every value below is read from the MCP payload (js/lab-data.js) or from the
   token vars in css/tokens.css. No colour literals here (zero-hex law). */

import { MCP } from './lab-data.js';

const $ = (id) => document.getElementById(id);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* colours come from the tokens file at runtime — never hardcoded */
const css = getComputedStyle(document.documentElement);
const tok = (n) => css.getPropertyValue(n).trim();
const COLORS = {
  gold: tok('--ml-gold'),
  goldSoft: tok('--ml-gold-soft'),
  goldBright: tok('--ml-gold-bright'),
};

const parseMs = (s) => parseFloat(s) || 0;
const springBezier = MCP.motion.easing.spring.replace('cubic-bezier(', '').replace(')', '').split(',').map(Number);

/* cubic-bezier(x1,y1,x2,y2) solver — Newton then bisection, standard impl */
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-5) break;
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    return sy(t);
  };
}
const springAt = bezier(...springBezier);

/* ------------------------------------------------ instruments: real payload text */
const patterns = MCP.motion.animationPatterns;
const tr = patterns.textReveal;
$('heroInstrument').textContent =
  `pattern: textReveal, ease: ${tr.ease}, ${tr.duration}, stagger: ${tr.stagger}`;
$('easingsInstrument').textContent =
  `${Object.keys(MCP.motion.easing).length} curves, from get-motion-system`;
$('morphInstrument').textContent =
  `trigger: cinematic, scrub: ${MCP.motion.scrollTriggers.cinematic.scrub}, morph: ${patterns.morph.duration} ${patterns.morph.ease}`;
$('staggerInstrument').textContent =
  `stagger.base: ${MCP.motion.stagger.base}, 12 tiles`;
const durs = MCP.motion.duration;
$('durationsInstrument').textContent =
  `instant ${durs.instant} to cinematic ${durs.cinematic}`;
$('qaInstrument').textContent =
  `${Object.keys(MCP.qa).length} gates, from get-qa-checks`;
$('barMeta').textContent = 'payload: 10 tools, 5 servers, stdio harvest 2026-10-28';

/* ------------------------------------------------ easing cards (injected) */
const easeOrder = ['expoOut', 'spring', 'bounce', 'soft', 'smooth', 'expo'];
const easeGrid = $('easeGrid');
easeOrder.forEach((name) => {
  const bez = MCP.motion.easing[name];
  const li = document.createElement('li');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ease-card';
  btn.setAttribute('aria-label', `Replay ${name} easing`);
  btn.innerHTML =
    `<span class="ease-card__info">
       <span class="ease-card__name">${name}</span>
       <span class="ease-card__bezier">${bez}</span>
     </span>
     <span class="ease-card__track" aria-hidden="true">
       <span class="ease-card__dot"></span>
     </span>`;
  li.appendChild(btn);
  easeGrid.appendChild(li);

  const dot = btn.querySelector('.ease-card__dot');
  const track = btn.querySelector('.ease-card__track');
  const drop = () => {
    if (REDUCED) return;
    const dist = track.clientHeight - 36;
    dot.animate(
      [
        { transform: 'translateY(0px)' },
        { transform: `translateY(${dist}px)` },
      ],
      { duration: parseMs(MCP.motion.duration.route), easing: bez, fill: 'none' },
    );
  };
  btn.addEventListener('click', drop);
  btn.addEventListener('pointerenter', drop);
  btn.dataset.replay = drop;
});

/* ------------------------------------------------ stagger tiles (injected) */
const tileGrid = $('tileGrid');
for (let i = 0; i < 12; i++) {
  const li = document.createElement('li');
  li.className = 'tile';
  tileGrid.appendChild(li);
}

/* ------------------------------------------------ duration ladder (injected) */
const ladder = $('ladder');
Object.entries(durs).forEach(([name, val]) => {
  const ms = parseMs(val);
  const row = document.createElement('div');
  row.className = 'ladder__row';
  row.innerHTML =
    `<dt class="ladder__name">${name}</dt>
     <dd class="ladder__track"><span class="ladder__bar" data-ms="${ms}"></span></dd>
     <dd class="ladder__ms">${val}</dd>`;
  ladder.appendChild(row);
});

/* ------------------------------------------------ QA gate rows (injected) */
const qaList = $('qaList');
Object.entries(MCP.qa).forEach(([, g]) => {
  const li = document.createElement('li');
  li.className = 'qa-row';
  li.innerHTML =
    `<span class="qa-row__name">${g.name}</span>
     <span class="qa-row__req">${g.standard} · ${g.requirement}</span>`;
  qaList.appendChild(li);
});

/* ------------------------------------------------ reveals (scrollReveal pattern) */
const revealMs = parseMs(patterns.scrollReveal.duration); // 700
const revealEase = MCP.motion.easing[patterns.scrollReveal.ease]; // expoOut
const stBase = parseMs(MCP.motion.stagger.base); // 120

const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    if (el.classList.contains('tile')) {
      const i = [...tileGrid.children].indexOf(el);
      el.style.transitionDelay = `${i * stBase}ms`;
    }
    el.classList.add('in');
    if (el.classList.contains('ladder__row')) {
      const bar = el.querySelector('.ladder__bar');
      const ms = parseFloat(bar.dataset.ms);
      const max = parseMs(durs.cinematic);
      requestAnimationFrame(() => { bar.style.transform = `scaleX(${ms / max})`; });
    }
    if (el.classList.contains('ease-card')) {
      const i = [...easeGrid.children].indexOf(el.closest('li'));
      setTimeout(() => el.dataset.replay(), i * stBase);
    }
    io.unobserve(el);
  });
}, { threshold: 0.2 });

document.querySelectorAll('.sec__head, .ease-card, .tile, .ladder__row, .qa-row').forEach((el) => {
  el.classList.add('rv');
  io.observe(el);
});

/* ------------------------------------------------ hero: textReveal, from payload */
const heroLines = document.querySelectorAll('.hero__title .line > span');
heroLines.forEach((line, i) => {
  const delay = i * parseMs(tr.stagger);
  line.style.transition =
    `opacity ${tr.duration} ${revealEase} ${delay}ms, transform ${tr.duration} ${revealEase} ${delay}ms`;
});
requestAnimationFrame(() => requestAnimationFrame(() => $('hero').classList.add('hero--in')));

/* ================================================= THE FIELD — signature */
/* N particles, 4 shapes, scroll-scrubbed morph on the payload's spring curve,
   cursor repulsion, idle drift. Composite-only: one canvas, fillRect. */

const canvas = $('field');
const ctx = canvas.getContext('2d', { alpha: true });
let W = 0, H = 0, DPR = 1, N = 0;

/* shape targets, all precomputed */
let shapes = [];        // [ {name, xs: Float32Array, ys: Float32Array} x4 ]
let tierStart = 0;      // index where "bright" tier begins

function buildShapes() {
  const vw = innerWidth, vh = innerHeight;
  N = vw < 700 ? 3800 : 9000;
  const cx = vw / 2, cy = vh / 2;
  const R = Math.min(vw, vh) * 0.42;

  const grid = new Float32Array(N * 2);
  const ring = new Float32Array(N * 2);
  const vortex = new Float32Array(N * 2);
  const burst = new Float32Array(N * 2);

  const cols = Math.ceil(Math.sqrt(N * (vw / Math.max(vh, 1))));
  const rows = Math.ceil(N / cols);
  const gx = vw / (cols + 1), gy = vh / (rows + 1);

  for (let i = 0; i < N; i++) {
    const j = i * 2;
    /* grid */
    const col = i % cols, row = (i / cols) | 0;
    grid[j] = gx * (col + 1);
    grid[j + 1] = gy * (row + 1);
    /* ring — 3 concentric bands */
    const band = i % 3;
    const a = (i / N) * Math.PI * 2 * 3;
    const rr = R * (0.55 + band * 0.22);
    ring[j] = cx + Math.cos(a) * rr;
    ring[j + 1] = cy + Math.sin(a) * rr;
    /* vortex — logarithmic spiral */
    const t = i / N;
    const ang = t * Math.PI * 7;
    const rad = 30 + t * R * 1.05;
    vortex[j] = cx + Math.cos(ang) * rad;
    vortex[j + 1] = cy + Math.sin(ang) * rad * 0.86;
    /* burst — 9 arms */
    const arm = i % 9;
    const at = (i / N) * Math.PI * 2;
    const ar = R * (0.15 + (arm / 9) * 0.95);
    burst[j] = cx + Math.cos(at) * ar;
    burst[j + 1] = cy + Math.sin(at) * ar;
  }

  shapes = [
    { name: 'grid', xs: grid, ys: grid, packed: false },
    { name: 'ring', xs: ring, ys: ring, packed: false },
    { name: 'vortex', xs: vortex, ys: vortex, packed: false },
    { name: 'burst', xs: burst, ys: burst, packed: false },
  ];
  /* pack xs/ys into interleaved single arrays for cache-friendly loops */
  shapes.forEach((s) => {
    const p = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) { p[i * 2] = s.xs[i * 2]; p[i * 2 + 1] = s.xs[i * 2 + 1]; }
    s.pts = p;
  });
  tierStart = N - Math.floor(N * 0.08); /* top 8% = bright tier */
}

function resize() {
  DPR = Math.min(devicePixelRatio || 1, 1.5);
  W = innerWidth; H = innerHeight;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  buildShapes();
  if (REDUCED) drawStatic();
}

/* ------------------------------------------------ input */
const mouse = { x: -9999, y: -9999 };
addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
addEventListener('pointerleave', () => { mouse.x = -9999; mouse.y = -9999; });

/* ------------------------------------------------ render */
let scrollP = 0;
const readScroll = () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  scrollP = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
};
addEventListener('scroll', readScroll, { passive: true });

const STATE_EL = $('fieldState');
let lastState = '';

function draw(now) {
  ctx.clearRect(0, 0, W, H);
  const f = scrollP * 3;                 // 3 transitions across 4 shapes
  const i0 = Math.min(3, Math.floor(f));
  const i1 = Math.min(3, i0 + 1);
  const tt = springAt(f - i0);           // payload spring curve drives the morph
  const A = shapes[i0].pts, B = shapes[i1].pts;
  const tSec = now * 0.001;
  const mx = mouse.x, my = mouse.y;
  const REP = 110, REP2 = REP * REP;

  for (let i = 0; i < N; i++) {
    const j = i * 2;
    let x = A[j] + (B[j] - A[j]) * tt;
    let y = A[j + 1] + (B[j + 1] - A[j + 1]) * tt;
    /* idle breath */
    if (!REDUCED) {
      x += Math.sin(tSec * 0.7 + i * 0.61) * 5;
      y += Math.cos(tSec * 0.6 + i * 0.83) * 5;
    }
    /* cursor repulsion */
    const dx = x - mx, dy = y - my;
    const d2 = dx * dx + dy * dy;
    if (d2 < REP2 && d2 > 0.01) {
      const d = Math.sqrt(d2);
      const push = ((REP - d) / REP) * 34;
      x += (dx / d) * push;
      y += (dy / d) * push;
    }
    if (i >= tierStart) {
      ctx.fillStyle = COLORS.goldBright;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(x, y, 2.4, 2.4);
    } else if (i % 7 === 0) {
      ctx.fillStyle = COLORS.goldSoft;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(x, y, 1.8, 1.8);
    } else {
      ctx.fillStyle = COLORS.gold;
      ctx.globalAlpha = 0.34;
      ctx.fillRect(x, y, 1.5, 1.5);
    }
  }
  ctx.globalAlpha = 1;

  const nm = shapes[i1].name;
  const state = `${nm} · phase ${String(i0 * 25 + Math.round(25 * (f - i0))).padStart(3, '0')}%`;
  if (state !== lastState) { STATE_EL.textContent = state; lastState = state; }
}

function drawStatic() {
  ctx.clearRect(0, 0, W, H);
  const pts = shapes[0].pts;
  for (let i = 0; i < N; i++) {
    const j = i * 2;
    if (i >= tierStart) {
      ctx.fillStyle = COLORS.goldBright; ctx.globalAlpha = 0.9; ctx.fillRect(pts[j], pts[j + 1], 2.4, 2.4);
    } else if (i % 7 === 0) {
      ctx.fillStyle = COLORS.goldSoft; ctx.globalAlpha = 0.6; ctx.fillRect(pts[j], pts[j + 1], 1.8, 1.8);
    } else {
      ctx.fillStyle = COLORS.gold; ctx.globalAlpha = 0.34; ctx.fillRect(pts[j], pts[j + 1], 1.5, 1.5);
    }
  }
  ctx.globalAlpha = 1;
  STATE_EL.textContent = 'static frame · reduced motion honoured';
}

let rafId = 0;
function loop(now) {
  draw(now);
  rafId = requestAnimationFrame(loop);
}

document.addEventListener('visibilitychange', () => {
  if (REDUCED) return;
  if (document.hidden) cancelAnimationFrame(rafId);
  else rafId = requestAnimationFrame(loop);
});

let rzT = 0;
addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(resize, 180); });

readScroll();
resize();
if (!REDUCED) rafId = requestAnimationFrame(loop);
