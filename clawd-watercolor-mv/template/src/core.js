// core.js: constants, helpers, paper, paint wrapper, compositing and render hooks.
// Reused from PDoomVideo. Changes for the Clawd MVs: constants come from CONFIG (src/config.js); the P(doom) meter hooks
// are gone; lettering uses the bundled Chinese font; karaoke → whole-sentence subtitles (timeline.js);
// the dev UI moved to studio.html (window.devUI). Merged fixes from 《春风吹》《遇见》《冬天一个游》: zoom-aware ink
// weight, FILL_MIN fill downgrade, CONFIG.style ink colour/weight, steady(), subtitle band on the compositor.
const W = CONFIG.width, H = CONFIG.height;
const BPM = CONFIG.beat.bpm, BEAT = 60 / BPM, OFF = CONFIG.beat.offset, BOIL = CONFIG.boil, DUR = CONFIG.duration;
const TAU = Math.PI * 2;
const PAL = {
  paper: '#F3EBDC', ink: '#2B2233', clay: '#D97757', clayDk: '#A84D33', clayLt: '#F2A283',
  night: '#1F2550', indigo: '#2F3C7A', rose: '#E27A92', ochre: '#E8AA38', sap: '#6E9F58',
  teal: '#3A9C98', violet: '#7B5CA8', cream: '#FFF5E2', sky: '#8EC3E6'
};

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, x) => a + (b - a) * x;
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
const backOut = x => { x = clamp(x); const s = 1.9; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// Beat position. CONFIG.beat.map holds per-section tempo [t0, bpm, a beat time]; the beat index restarts per section.
const BEAT_MAP = CONFIG.beat.map || [[0, BPM, OFF]];
const bpOf = t => { let i = 0; while (i + 1 < BEAT_MAP.length && t >= BEAT_MAP[i + 1][0]) i++; const [, b, o] = BEAT_MAP[i]; return (t - o) / (60 / b); };
// Seeded by the boil frame, so linework "boils" at BOIL fps like hand-drawn animation (BOIL 0 = steady lines).
// p5.brush hooks p5's randomSeed(), so the same seed also re-rolls every watercolor fill texture 12 times a second.
const jit = a => (random() * 2 - 1) * a;
// steady(key, fn): paint fn() with a fixed seed, so its jitter and fill texture do NOT boil, then resume the boil.
// Use it for anything big, dark or UI-like whose re-texturing at BOIL fps reads as flicker (title cards, captions,
// a large dark backdrop). key: any integer that is fixed while the element should look the same.
let STEADY_N = 0;
function steady(key, fn) { randomSeed(50000 + key); fn(); randomSeed(1000 + Math.floor(T * BOIL) + 7919 * ++STEADY_N); }

// ---------- timing helpers (everything is a pure function of t; no state survives between frames) ----------
const seg = (t, a, b) => clamp((t - a) / (b - a));                 // 0..1 progress of t through [a, b]
const frac = x => x - Math.floor(x);
const beatN = t => Math.floor(bpOf(t));                            // integer beat index
const pulse = (t, k = 6) => Math.exp(-frac(bpOf(t)) * k);          // 1 exactly on each beat, decays after
const pulse2 = (t, k = 6) => Math.exp(-frac(bpOf(t) * 2) * k);     // same on eighth notes
const wob = (t, f = 1, ph = 0) => Math.sin((t * f + ph) * TAU);
const easeIn = x => Math.pow(clamp(x), 3);
const elasticOut = x => { x = clamp(x); return x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * (TAU / 3)) + 1; };
// keyframes: kf(t, [[t0, v0], [t1, v1], ...], easeFn). Values may be numbers or arrays of numbers.
function kf(t, keys, e = ease) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t < keys[i][0]) {
      const [a, va] = keys[i - 1], [b, vb] = keys[i], k = e((t - a) / (b - a));
      return Array.isArray(va) ? va.map((v, j) => lerp(v, vb[j], k)) : lerp(va, vb, k);
    }
  }
  return keys[keys.length - 1][1];
}
// hex color mix
function mixCol(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), c = i => Math.round(lerp((pa >> i) & 255, (pb >> i) & 255, clamp(k)));
  return '#' + ((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1);
}
// small deterministic camera shake, changes at 24 fps
const shakeXY = (t, amt) => { const f = Math.floor(t * 24); return [(hash(f * 1.7) - .5) * 2 * amt, (hash(f * 2.3 + 9) - .5) * 2 * amt]; };

// ---------- camera ----------
// camBegin(cx, cy, zoom, rot): world point (cx, cy) lands at screen centre. Letters queued while a camera is
// active are placed through it automatically (pass {screen:true} to opt out). One level only: always pair with camEnd().
let CAM = null;
function camBegin(cx = W / 2, cy = H / 2, zoom = 1, rot = 0) { push(); translate(W / 2, H / 2); rotate(rot); scale(zoom); translate(-cx, -cy); CAM = { cx, cy, zoom, rot }; }
function camEnd() { pop(); CAM = null; }
function toScreen(x, y) {
  if (!CAM) return [x, y];
  const c = Math.cos(CAM.rot), s = Math.sin(CAM.rot), dx = (x - CAM.cx) * CAM.zoom, dy = (y - CAM.cy) * CAM.zoom;
  return [W / 2 + dx * c - dy * s, H / 2 + dx * s + dy * c];
}

// ---------- full-frame effects (call outside a camera, in screen space) ----------
function flash(k, col = '#FFFDF6') { if (k > .01) paint(rectPts(-60, -60, W + 120, H + 120), { wash: col, washOp: 255 * clamp(k), ink: null }); }
// Paint everything OUTSIDE a star-shaped hole (irises, mouth-shaped reveals, keyholes).
function irisShape(pts, col = PAL.ink, far = 4000) {
  const n = pts.length; let cx = 0, cy = 0; for (const p of pts) { cx += p[0]; cy += p[1]; } cx /= n; cy /= n;
  const out = p => { const dx = p[0] - cx, dy = p[1] - cy, d = Math.hypot(dx, dy) || 1; return [cx + dx / d * far, cy + dy / d * far]; };
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], ex = (b[0] - a[0]) * .06, ey = (b[1] - a[1]) * .06;
    const a2 = [a[0] - ex, a[1] - ey], b2 = [b[0] + ex, b[1] + ey];
    paint([a2, b2, out(b2), out(a2)], { wash: col, washOp: 255, ink: null });
  }
}
function iris(cx, cy, r, col = PAL.ink) { if (r < 4) paint(rectPts(-60, -60, W + 120, H + 120), { wash: col, ink: null }); else irisShape(ellPts(cx, cy, r, r, 40), col); }

let T = 0, paperG = null, grainC = null, letG = null, outC = null, outX = null;
let LETTERS = [], SUBTITLE = null;

// ---------- geometry ----------
function rectPts(x, y, w, h, j = 0) {
  return [[x + jit(j), y + jit(j)], [x + w / 2 + jit(j), y + jit(j) * .5], [x + w + jit(j), y + jit(j)],
          [x + w + jit(j) * .5, y + h / 2], [x + w + jit(j), y + h + jit(j)], [x + w / 2 + jit(j), y + h + jit(j) * .5],
          [x + jit(j), y + h + jit(j)], [x + jit(j) * .5, y + h / 2]];
}
function ellPts(cx, cy, rx, ry, n = 28, j = 0, rot = 0) {
  const p = []; for (let i = 0; i < n; i++) { const a = rot + i / n * TAU; p.push([cx + Math.cos(a) * rx + jit(j), cy + Math.sin(a) * ry + jit(j)]); } return p;
}
function rrPts(x, y, w, h, r, j = 0) {
  const p = [], seg = 5, corner = (cx, cy, a0) => { for (let i = 0; i <= seg; i++) { const a = a0 + i / seg * Math.PI / 2; p.push([cx + Math.cos(a) * r + jit(j), cy + Math.sin(a) * r + jit(j)]); } };
  corner(x + w - r, y + r, -Math.PI / 2); corner(x + w - r, y + h - r, 0); corner(x + r, y + h - r, Math.PI / 2); corner(x + r, y + r, Math.PI);
  return p;
}
function starPts(cx, cy, r, inner = .38, n = 4, rot = -Math.PI / 2) {
  const p = []; for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, q = i % 2 ? r * inner : r; p.push([cx + Math.cos(a) * q, cy + Math.sin(a) * q]); } return p;
}

// ---------- paint wrapper ----------
// One call = one painted shape: optional flat wash, optional watercolor fill, optional hatch, optional ink outline.
// Ink weight compensation under a zoomed camera: strokes scale with the camera, so close-ups would get blobby,
// over-heavy outlines. Above zoom 1.3 the weight is eased back (zoom^-0.6 relative to 1.3).
// SCALE_K: extra scale of a nested set (e.g. the room painted inside a window), so the compensation sees the true zoom.
let SCALE_K = 1;
const zsw = sw => { const z = (CAM ? CAM.zoom : 1) * SCALE_K; return z > 1.3 ? sw * Math.pow(1.3 / z, .6) : sw; };
// Speed: a p5.brush watercolor fill has a large fixed cost per call. On shapes smaller than FILL_MIN px on screen the
// texture is invisible anyway, so the fill becomes a flat wash (fill-only shapes become a translucent wash).
const FILL_MIN = 40;
// CONFIG.style: soften the outlines (an ink colour instead of near-black, a weight multiplier). Texture brushes
// (paint / bristle / stipple) are not affected.
const STY = CONFIG.style || { ink: 1, inkCol: null };
const inkCol = c => (c === PAL.ink && STY.inkCol) ? STY.inkCol : c;
const inkW = (br, sw) => (br === 'ink' || br === 'inkfine') ? sw * (STY.ink ?? 1) : sw;
function paint(pts, o = {}) {
  if (o.fill && !o.keepFill) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    if (Math.max(x1 - x0, y1 - y0) * (CAM ? CAM.zoom : 1) * SCALE_K < FILL_MIN) o = o.wash ? { ...o, fill: null } : { ...o, wash: o.fill, washOp: (o.fillOp ?? 170) * .45, fill: null };
  }
  if (o.wash || o.fill || o.hatch) {
    if (o.wash) brush.wash(o.wash, o.washOp ?? 255); else brush.noWash();
    if (o.fill) { brush.fill(o.fill, o.fillOp ?? 170); brush.fillBleed(o.bleed ?? .1); brush.fillTexture(o.tex ?? .4, o.border ?? .35); } else brush.noFill();
    if (o.hatch) { brush.hatch(o.hatch.d, o.hatch.a, o.hatch.o || { rand: .15 }); brush.hatchStyle(o.hatch.b || 'HB', o.hatch.c || PAL.ink, o.hatch.w || 1); } else brush.noHatch();
    brush.noStroke();
    if (o.curv) { brush.beginShape(o.curv); for (const p of pts) brush.vertex(p[0], p[1]); brush.endShape(true); }
    else brush.polygon(pts);
  }
  // the outline is one continuous tapered stroke, not a stroke per side
  if (o.ink !== null) {
    brush.noWash(); brush.noFill(); brush.noHatch(); brush.set(o.br || 'ink', inkCol(o.ink || PAL.ink), zsw(inkW(o.br || 'ink', o.sw ?? 1)));
    brush.beginShape(o.curv || 0); for (const p of pts) brush.vertex(p[0], p[1]); brush.endShape(true);
  }
}
function inkLine(pts, sw = 1, col = PAL.ink, br = 'ink', curv = .5) {
  brush.noFill(); brush.noWash(); brush.noHatch(); brush.set(br, inkCol(col), zsw(inkW(br, sw))); brush.spline(pts.length === 2 ? [pts[0], [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2], pts[1]] : pts, curv);
}

// ---------- lettering (drawn on the 2D compositor, under the paper grain) ----------
function letter(txt, x, y, size, color, o = {}) {
  if (CAM && !o.screen) { [x, y] = toScreen(x, y); size *= CAM.zoom; o = { ...o, rot: (o.rot || 0) + CAM.rot }; if (o.font) o.font = o.font.replace(/(\d+(\.\d+)?)px/, (m, v) => (v * CAM.zoom) + 'px'); }
  LETTERS.push({ txt, x, y, size, color, ...o });
}
// Comic sound effect: pops in at age 0, wobbles, fades by `life` seconds.
function sfx(txt, x, y, size, color, age, o = {}) {
  const life = o.life ?? 1.2; if (age < 0 || age > life) return;
  letter(txt, x, y, size, color, { pop: age * 5, rot: (o.rot ?? -.08) + Math.sin(age * 20) * .03 * (1 - age / life), alpha: 1 - seg(age, life - .25, life), ...o });
}
function drawLetters(c) {
  for (const L of LETTERS) {
    const k = L.pop != null ? backOut(L.pop) : 1; if (k <= .01) continue;
    c.save(); c.translate(L.x, L.y); c.rotate(L.rot || 0); c.scale(k, k); c.globalAlpha = L.alpha ?? 1;
    c.font = L.font || `${L.size}px ${CONFIG.fonts.zh}`;
    c.textAlign = L.align || 'center'; c.textBaseline = 'middle';
    if (L.stroke) { c.lineJoin = 'round'; c.lineWidth = L.size * .12; c.strokeStyle = L.stroke; c.strokeText(L.txt, 0, 0); }
    if (L.ink !== false) { c.fillStyle = PAL.ink; c.fillText(L.txt, L.size * .045, L.size * .055); }
    c.fillStyle = L.color; c.fillText(L.txt, 0, 0);
    c.restore();
  }
}

// Paint the queued lettering into the scene itself, so later layers (wipes) cover it.
function flushLetters() {
  if (!LETTERS.length) return;
  letG.clear(); drawLetters(letG.drawingContext); LETTERS = [];
  // p5.brush defers washes and strokes into a mask layer; a (tiny, off-screen) watercolor fill forces it to composite
  // now, so everything painted before this call really lands under the letters.
  // Letters are already in screen space, so composite them with the base transform even inside camBegin().
  push(); resetMatrix(); translate(-W / 2, -H / 2);
  brush.noStroke(); brush.noHatch(); brush.noWash(); brush.fill('#000000', 1); brush.fillBleed(0); brush.fillTexture(0, 0);
  brush.polygon([[-50, -50], [-40, -50], [-40, -40]]); brush.noFill();
  image(letG, 0, 0); pop();
}

// ---------- paper ----------
function lcg(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function makePaper() {
  const g = createGraphics(W, H); g.pixelDensity(1); const c = g.drawingContext, rnd = lcg(11);
  c.fillStyle = PAL.paper; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) { const x = rnd() * W, y = rnd() * H, r = 120 + rnd() * 380, gr = c.createRadialGradient(x, y, 0, x, y, r), a = .045 * rnd(); gr.addColorStop(0, `rgba(160,125,80,${a})`); gr.addColorStop(1, 'rgba(160,125,80,0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, 2 * r, 2 * r); }
  c.lineWidth = 1;
  for (let i = 0; i < 1400; i++) { const x = rnd() * W, y = rnd() * H, l = 6 + rnd() * 26, a = rnd() * TAU; c.strokeStyle = `rgba(110,88,60,${.035 + rnd() * .06})`; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a + .6) * l * .5, y + Math.sin(a + .6) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
  return g;
}
// Static grain + vignette, multiplied over the painted frame so pigment sits "in" the paper.
function makeGrain() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'), rnd = lcg(5);
  const id = c.createImageData(W, H), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const v = 255 - (rnd() < .55 ? rnd() * rnd() * 34 : 0); d[i] = v; d[i + 1] = v - 1; d[i + 2] = v - 3; d[i + 3] = 255; }
  c.putImageData(id, 0, 0);
  const g = c.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * 1.05); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(120,95,70,.35)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  return cv;
}

// ---------- custom brushes ----------
function defineBrushes() {
  brush.add('ink', { type: 'default', weight: 5, scatter: .25, sharpness: .8, grain: 40, opacity: 235, spacing: .2, pressure: [1.15, .75], rotate: 'natural', noise: .15 });
  brush.add('inkfine', { type: 'default', weight: 2.6, scatter: .15, sharpness: .85, grain: 40, opacity: 230, spacing: .2, pressure: [1.1, .8], rotate: 'natural', noise: .1 });
  brush.add('dry', { type: 'default', weight: 14, scatter: 3, sharpness: .3, grain: 6, opacity: 90, spacing: .6, pressure: [1, .6], rotate: 'natural', noise: .4 });
}

// ---------- frame ----------
async function setup() {
  createCanvas(W, H, WEBGL); pixelDensity(1); noLoop();
  brush.scaleBrushes(5); defineBrushes(); if (window.defineMoreBrushes) window.defineMoreBrushes();
  paperG = makePaper(); grainC = makeGrain(); letG = createGraphics(W, H); letG.pixelDensity(1);
  outC = document.getElementById('out'); outX = outC.getContext('2d');
  if (CONFIG.fonts.face) {
    const ff = new FontFace(CONFIG.fonts.face.family, `url(${CONFIG.fonts.face.url})`);
    try { document.fonts.add(await ff.load()); } catch (e) { console.warn('bundled font failed, using system CJK font', e.message); }
  }
  for (const [k, f] of Object.entries(CONFIG.fonts)) if (typeof f === 'string') await document.fonts.load(`bold 50px ${f}`, k === 'zh' ? CONFIG.title : 'あア字');
  window.ready = true;
  if (!location.search.includes('render') && window.devUI) window.devUI();
}
function draw() {
  if (!window.ready) return;
  LETTERS = []; SUBTITLE = null; CAM = null; STEADY_N = 0;
  push(); translate(-W / 2, -H / 2);
  randomSeed(1000 + Math.floor(T * BOIL)); noiseSeed(77);
  image(paperG, 0, 0);
  drawWorld(T);
  pop();
}
function composite(t) {
  const c = outX;
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  c.drawImage(drawingContext.canvas, 0, 0, W, H);
  drawSubtitleBand(c);                                  // under the paper grain, so the band sits in the paper
  drawLetters(c);
  c.globalCompositeOperation = 'multiply'; c.drawImage(grainC, 0, 0);
  c.globalCompositeOperation = 'source-over';
  drawSubtitleText(c);
}
window.renderAt = async (t, type = 'image/png', q = .92) => { T = t; await redraw(); composite(t); return outC.toDataURL(type, q); };
// Contact sheet of several times, for quick visual checks: returns { url, ms[] }.
window.renderSheet = async (times, cols = 3, w = 640) => {
  const h = Math.round(w * 9 / 16), rows = Math.ceil(times.length / cols), sc = document.createElement('canvas');
  sc.width = cols * w; sc.height = rows * h; const c = sc.getContext('2d'), ms = [];
  for (let i = 0; i < times.length; i++) {
    const t0 = performance.now(); T = times[i]; await redraw(); composite(times[i]); ms.push(Math.round(performance.now() - t0));
    const x = (i % cols) * w, y = Math.floor(i / cols) * h;
    c.drawImage(outC, x, y, w, h);
    const lab = window.frameLabel ? window.frameLabel(times[i]) : times[i].toFixed(2) + 's';
    c.font = `16px ${CONFIG.fonts.zh}`; const lw = c.measureText(lab).width + 12;
    c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(x, y, lw, 26); c.fillStyle = '#fff'; c.fillText(lab, x + 6, y + 18);
  }
  return { url: sc.toDataURL('image/jpeg', .88), ms };
};
window.gpuInfo = () => { const gl = drawingContext, e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); };
