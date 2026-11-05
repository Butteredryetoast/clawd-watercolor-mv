// kit.js: reusable, song-independent helpers collected from the Clawd MVs (mostly 《冬天一个游》). Loaded after texture.js
// and before the film's own cast / props / world files. Everything is a pure function of its arguments and t.
//
//   viewRect / vis / clipRect / bg      camera culling: skip what the camera cannot see, clip big backgrounds to the view
//   nest(x, y, k, fn)                   paint a whole set inside a rectangle at scale k (a window view, a TV, a photo)
//   glowDot / softGlow                  light without a hard watercolor rim (stacked low-opacity washes)
//   lightString(pts, t, o)              a sagging wire of twinkling bulbs
//   moon / stars / roofRow / bareTree   night-city pieces
//   snowLine(pts, h, col, o)            snow lying along a roof edge / branch (stays thin under a zoomed camera)
//   snowfall(t, o)                      three layers of falling snow (screen space)
//   ribbonPts / curlPath / sagPath / cord   ribbons, smoke curls, a sagging string, a two-tone cord (the red yarn)
//   hand / clawdArmTip / armAngleTo / armTo    put a Clawd hand exactly on a prop, or aim it
//   speechBubble / lensVignette / swirlVortex  a bubble, looking through glass, a vortex that swallows the frame
//   splitHalf / paperDivider            split screen (two scenes side by side, each in local 960×1080)
//   warmGlow / spotBeam / confettiFall   a wide warm light pool, a swinging spotlight, falling confetti (《电动少女》)
//   integ(a, t, rate)                   ∫ rate: a variable-speed spin that is still a pure function of t
//   nestView(cx, cy, z, R, outer, inner) push a camera into a nested set; paints the inner set directly once inside
//   humanHand / humanHandTip            a giant human hand with a suit sleeve; put its fingertip exactly on a prop
//   airGuitar(x, y, u, o, strum)        a Clawd holding a stick-like prop as a guitar: arm angles + the prop line H→T (《丸之內虐待狂》)
const KIT_NIGHT = { snow: '#E4E8F1', snowDk: '#A9B3CC', glow: '#FFE3A0', win: '#F6D78E' };

// ---------- camera culling ----------
// Big off-screen watercolor fills are the slowest thing to paint, and they are invisible. Sets test vis() before
// painting a building / room / prop group, and paint large backgrounds with bg() (clipped to the view).
let VIEW_OVERRIDE = null;                                    // set by nest(): the visible rect in the nested set's coords
function viewRect(pad = 120) {
  if (!CAM) return [-pad, -pad, W + pad, H + pad];
  const hw = W / 2 / CAM.zoom, hh = H / 2 / CAM.zoom, r = Math.abs(CAM.rot) > .01 ? Math.hypot(hw, hh) : 0;
  const ex = r ? r : hw, ey = r ? r : hh, p = pad / CAM.zoom;
  return [CAM.cx - ex - p, CAM.cy - ey - p, CAM.cx + ex + p, CAM.cy + ey + p];
}
function vis(x0, y0, x1, y1) { const v = VIEW_OVERRIDE || viewRect(); return x1 >= v[0] && x0 <= v[2] && y1 >= v[1] && y0 <= v[3]; }
function clipRect(x, y, w, h, pad = 160) {
  const v = VIEW_OVERRIDE || viewRect(pad), x0 = Math.max(x, v[0]), y0 = Math.max(y, v[1]), x1 = Math.min(x + w, v[2]), y1 = Math.min(y + h, v[3]);
  return x1 > x0 && y1 > y0 ? rectPts(x0, y0, x1 - x0, y1 - y0) : null;
}
function bg(x, y, w, h, o) { const r = clipRect(x, y, w, h); if (r) paint(r, o); }

// ---------- nested sets ----------
// Paint fn() (a full-frame set in its own 1920×1080 coordinates) into the rectangle at (x, y) scaled by k. Ink weights
// see the true scale through SCALE_K; vis() inside sees the nested frame. A camera that pushes into the rectangle until
// zoom = 1/k can cut seamlessly to the same set painted full-frame (the window → city move in 《冬天一个游》).
function nest(x, y, k, fn, view = [-200, -200, W + 200, H + 200]) {
  const keep = SCALE_K, kv = VIEW_OVERRIDE;
  push(); translate(x, y); scale(k); SCALE_K = keep * k; VIEW_OVERRIDE = view;
  fn();
  VIEW_OVERRIDE = kv; SCALE_K = keep; pop();
}

// ---------- light ----------
function glowDot(x, y, r, col, k = 1) { if (k > .02) { paint(ellPts(x, y, r, r, 14), { wash: col, washOp: 34 * k, ink: null }); paint(ellPts(x, y, r * .55, r * .55, 12), { wash: col, washOp: 46 * k, ink: null }); } }
function softGlow(x, y, rx, ry, col, k = 1) { if (k < .02) return; for (let i = 0; i < 4; i++) { const f = 1 - i * .22; paint(ellPts(x, y, rx * f, ry * f, 24), { wash: col, washOp: Math.min(255, 15 * k), ink: null }); } }
function lightString(pts, t, o = {}) {
  const on = o.on ?? 1, cols = o.cols || ['#F6D27A', '#EE6F5E', '#9AD0A0', '#F6E6B4'], gap = o.gap || 48, r = o.r || 5;
  inkLine(pts, o.sw ?? .7, o.wire || '#2E2A38', 'inkfine', .5);
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], d = Math.hypot(bx - ax, by - ay);
    for (let s = (gap - acc % gap) % gap; s < d; s += gap) {
      const k = s / d, x = lerp(ax, bx, k), y = lerp(ay, by, k) + r * .6, j = Math.round((acc + s) / gap) + (o.seed || 0);
      const tw = on * (.65 + .35 * Math.sin(t * 3 + j * 1.7)), c = cols[j % cols.length];
      if (tw > .1) glowDot(x, y, r * 3.2, c, tw * (o.glow ?? 1));
      paint(ellPts(x, y, r * .7, r, 8), { wash: mixCol('#5A5468', c, clamp(tw * 1.2)), ink: null });
    }
    acc += d;
  }
}

// ---------- night city ----------
function moon(x, y, r, o = {}) {
  softGlow(x, y, r * 2.6, r * 2.6, '#E8E4C8', 1.3 * (o.glow ?? 1));
  paint(ellPts(x, y, r, r, 22), { wash: '#F4EED6', fill: '#D8D0B0', fillOp: 50, tex: .6, ink: null });
  paint(ellPts(x - r * .3, y - r * .2, r * .22, r * .18, 10), { fill: '#C8C0A0', fillOp: 70, ink: null });
}
function stars(x0, y0, w, h, n, t, o = {}) {
  for (let i = 0; i < n; i++) {
    const x = x0 + hash(i * 4.7 + (o.seed || 0)) * w, y = y0 + hash(i * 8.3 + (o.seed || 0)) * h, tw = .5 + .5 * Math.sin(t * 2 + i);
    paint(ellPts(x, y, 1.6 + tw, 1.6 + tw, 6), { wash: '#F4F0DC', washOp: 160 + 90 * tw, ink: null });
  }
}
// A row of rooftops from x0 to x1 standing on y, heights h0..h1. Only LIT windows are painted (dark ones are just the
// wall colour: painting them cost half the frame time). o: col, dk, lit (0..1), winCol, snow (false = none), snowCol,
// snowW, ink (false = no outline), seed, wMin, wVar, gap.
function roofRow(x0, x1, y, h0, h1, o = {}) {
  const seed = o.seed || 1, col = o.col || '#3A4270', dk = o.dk || '#262C4E';
  let x = x0, i = 0;
  while (x < x1) {
    const w = (o.wMin || 140) + hash(seed * 3.3 + i) * (o.wVar || 160), hh = lerp(h0, h1, hash(seed * 5.7 + i)), type = Math.floor(hash(seed * 9.1 + i) * 3);
    if (vis(x, y - hh - 120, x + w, y + 10)) {
      const top = y - hh, pts = type === 0 ? [[x, y], [x, top], [x + w / 2, top - w * .28], [x + w, top], [x + w, y]] : type === 1 ? [[x, y], [x, top], [x + w, top], [x + w, y]] : [[x, y], [x, top + 20], [x + w * .6, top - 20], [x + w, top + 10], [x + w, y]];
      paint(pts, { wash: col, fill: dk, fillOp: 60, tex: .5, ink: o.ink === false ? null : PAL.ink, sw: o.sw ?? .8 });
      if (o.snow !== false) { const sn = pts.slice(1, -1); if (sn.length >= 2) snowLine(sn.map(([px, py]) => [px, py + 2]), (o.snowW || 6) * 1.6, o.snowCol || KIT_NIGHT.snow, { seed: i }); }
      const nwx = Math.max(1, Math.floor(w / 46)), nwy = Math.max(1, Math.floor(hh / 60));
      for (let a = 0; a < nwx; a++) for (let b = 0; b < nwy; b++) {
        const wx = x + 16 + a * (w - 32) / nwx, wy = top + 26 + b * 54;
        if (wy > y - 30 || hash(seed * 11 + i * 7 + a * 3 + b * 13) >= (o.lit ?? .4)) continue;
        paint(rectPts(wx, wy, 18, 24), { wash: o.winCol || KIT_NIGHT.win, ink: null });
      }
    }
    x += w + (o.gap || 0); i++;
  }
}
function bareTree(x, y, h, seed = 0, o = {}) {
  const col = o.col || '#3A3448';
  inkLine([[x, y], [x + 4, y - h * .5], [x - 2, y - h * .75]], 5, col, 'paint', .4);
  for (let i = 0; i < 6; i++) {
    const by = y - h * (.35 + .1 * i), d = i % 2 ? 1 : -1, L = h * (.32 - .03 * i), ex = x + d * L, ey = by - L * .5;
    inkLine([[x, by], [x + d * L * .5, by - L * .15], [ex, ey]], 2.2, col, 'ink', .5);
    if (o.snow !== false) snowLine([[x + d * L * .2, by - L * .05], [x + d * L * .55, by - L * .2], [ex, ey]], 5, KIT_NIGHT.snow, { seed: seed + i });
  }
}

// ---------- snow ----------
// Snow lying along a polyline: a thin painted band, mounded in the middle, tapered at the ends; h = thickness (world px).
// Do NOT draw snow caps as thick 'paint' strokes: under a zoomed camera they balloon into grey capsules.
function snowLine(pts, h, col = KIT_NIGHT.snow, o = {}) {
  if (pts.length < 2) return;
  const path = []; for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < 4; k++) path.push([lerp(pts[i][0], pts[i + 1][0], k / 4), lerp(pts[i][1], pts[i + 1][1], k / 4)]);
  path.push(pts[pts.length - 1]);
  const n = path.length, up = [], dn = [];
  for (let i = 0; i < n; i++) { const s = i / (n - 1), tp = Math.min(1, Math.sin(s * Math.PI) * 2.4), bump = 1 + .3 * Math.sin(i * 1.7 + (o.seed || 0)); up.push([path[i][0], path[i][1] - h * .6 * tp * bump]); dn.push([path[i][0], path[i][1] + h * .3 * tp]); }
  paint(up.concat(dn.slice().reverse()), { wash: col, ink: null, curv: .5 });
  inkLine(up, o.sw ?? .45, o.edge || mixCol(col, '#5A6488', .45), 'inkfine', .5);
}
// Falling snow in screen space (call outside camBegin): o.k density 0..1, o.wind drift px/s, o.col, o.near false = no big flakes.
function snowfall(t, o = {}) {
  const k = o.k ?? 1, wind = o.wind ?? 30, col = o.col || '#EEF1F7';
  if (k < .02) return;
  const layers = [[70, 2.2, 38, .55], [46, 3.6, 70, .8], [o.near === false ? 0 : 16, 6.5, 120, 1]];
  layers.forEach(([n, r, sp, op], L) => {
    for (let i = 0; i < Math.round(n * k); i++) {
      const s = i + L * 100, fall = sp * (.8 + .4 * hash(s * 1.9));
      const x = frac(hash(s * 3.1) + (wind * t * (L + 1) * .5 + Math.sin(t * .8 + s) * 14) / (W + 200)) * (W + 200) - 100;
      const y = frac(hash(s * 7.7) + fall * t / (H + 120)) * (H + 120) - 60;
      const rr = r * (.7 + .6 * hash(s * 5.3));
      paint(ellPts(x, y, rr, rr, 7), { wash: col, washOp: 255 * op, ink: null });
    }
  });
}

// ---------- paths: ribbons, curls, strings ----------
// Polygon of a ribbon following a path, width tapering from w0 to w1 (scarves, smoke, arms, banners).
function ribbonPts(path, w0, w1 = w0) {
  const L = [], R = [], n = path.length;
  for (let i = 0; i < n; i++) {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    const w = lerp(w0, w1, i / (n - 1)) / 2, nx = -dy / d * w, ny = dx / d * w;
    L.push([path[i][0] + nx, path[i][1] + ny]); R.push([path[i][0] - nx, path[i][1] - ny]);
  }
  return L.concat(R.reverse());
}
// A path from (x, y) heading at angle a0 that curls and wobbles over time (smoke, steam, a scarf end). len in px.
function curlPath(x, y, a0, len, curl, wobK, seed, n = 9) {
  const p = [[x, y]]; let a = a0, px = x, py = y;
  for (let i = 1; i < n; i++) {
    const s = i / (n - 1);
    a += curl / n + Math.sin(T * 3.1 + seed + s * 4) * wobK * s;
    px += Math.cos(a) * len / (n - 1); py += Math.sin(a) * len / (n - 1); p.push([px, py]);
  }
  return p;
}
const angLerp = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
// Points from p0 to p1 sagging by `sag` px mid-way (+ = down). o.vib = pluck amplitude decaying with o.vibAge (s),
// o.wave = slow wind sway, o.n = segments. With cord() this is the "red thread" that links scenes.
function sagPath(p0, p1, sag = 40, o = {}) {
  const n = o.n ?? 14, pts = [], dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const vib = (o.vib || 0) * Math.exp(-(o.vibAge || 0) * 5) * Math.sin((o.vibAge || 0) * 70);
  for (let i = 0; i <= n; i++) {
    const s = i / n, bell = 4 * s * (1 - s), w = (o.wave || 0) * Math.sin(T * 1.7 + s * 5) * bell + vib * Math.sin(s * Math.PI);
    pts.push([p0[0] + dx * s + nx * w, p0[1] + dy * s + sag * bell + ny * w]);
  }
  return pts;
}
// A thin cord that reads on any background: a dark under-stroke plus the coloured strand.
function cord(pts, sw = 1.3, col = '#D23A35', under = '#962421') { if (pts.length < 2) return; inkLine(pts, sw * 1.5, under, 'inkfine', .5); inkLine(pts, sw, col, 'ink', .5); }

// ---------- Clawd hands on props ----------
// A Clawd faces the viewer: its LEFT hand is the screen-right arm (aR), its RIGHT hand the screen-left arm (aL).
function hand(x, y, u, o = {}) {
  paint(rrPts(x - .65 * u, y - .55 * u, 1.3 * u, 1.1 * u, .35 * u), { wash: o.col || PAL.clay, fill: o.dk || PAL.clayDk, fillOp: 50, ink: PAL.ink, sw: clamp(u / 15, .45, 2.4) * .7 });
}
// World position of a Clawd arm tip, mirroring clawd()'s transforms. o = the same options passed to clawd(); side -1 = aL, 1 = aR.
function clawdArmTip(x, y, u, o, side) {
  const sq = (o.sq || 0) + (o.take || 0), fx = (o.flip ? -1 : 1) * (o.sx ?? 1) * (1 + sq * .6), fy = (o.sy ?? 1) * (1 - sq);
  const a = side < 0 ? (o.aL ?? .2) : -(o.aR ?? .2);
  const lx = side * 4.9 * u + Math.cos(a) * side * 2.2 * u, ly = -4.5 * u + Math.sin(a) * side * 2.2 * u;
  const bx = lx * fx, by = ly * fy, r = o.rot || 0;
  return [x + bx * Math.cos(r) - by * Math.sin(r), y + (o.dy || 0) * u + bx * Math.sin(r) + by * Math.cos(r)];
}
// Inverse: the arm angle (aR for side 1 / aL for side -1; unflipped, unrotated body) that points the arm at (tx, ty).
function armAngleTo(x, y, u, tx, ty, side, o = {}) {
  const fl = o.flip ? -1 : 1, px = x + fl * side * 4.9 * u, py = y + (o.dy || 0) * u - 4.5 * u;
  return -Math.atan2(ty - py, (tx - px) * fl * side);
}
// A straight clay arm from (x0, y0) to (x1, y1) for close-ups where the 2.2u arms cannot reach. Keep it SHORT
// (≤ ~4u): a long thin arm reads as a stick; prefer moving the whole character into frame instead.
function armTo(x0, y0, x1, y1, u, o = {}) {
  paint(ribbonPts([[x0, y0], [(x0 + x1) / 2, (y0 + y1) / 2], [x1, y1]], u, u * .95), { wash: o.col || PAL.clay, fill: o.dk || PAL.clayDk, fillOp: 60, tex: .5, ink: PAL.ink, sw: clamp(u / 15, .45, 2.4) * .8 });
  if (o.tip) o.tip(x1, y1, Math.atan2(y1 - y0, x1 - x0)); else hand(x1, y1, u * 1.05, o);
}

// ---------- bubbles, glass, vortex ----------
function speechBubble(x, y, s, o = {}) {
  const k = backOut(clamp(o.pop ?? 1)); if (k < .02) return;
  const cx = x + s * .8, cy = y - s * 1.3, r = s * k;
  paint(ellPts(cx, cy, r * 1.25, r, 22, 2), { wash: '#FBF8F0', fill: '#D8D0C0', fillOp: 30, ink: PAL.ink, sw: 1.1 });
  paint([[x, y], [cx - r * .3, cy + r * .6], [cx + r * .05, cy + r * .9]], { wash: '#FBF8F0', ink: PAL.ink, sw: 1, curv: .2 });
  if (o.heart) paint(heartPts(cx, cy + r * .05, r * .55 * backOut(o.heart)), { wash: o.heartCol || '#D23A35', fill: '#962421', fillOp: 60, ink: PAL.ink, sw: .8 });
  else if (o.dots) for (let i = 0; i < 3; i++) paint(ellPts(cx - r * .4 + i * r * .4, cy, r * .07, r * .07, 6), { wash: '#B8B0A0', ink: null });
}
// Looking out through round glass (a snow globe, a porthole, a lens): dark rim outside an ellipse + highlights. Screen space.
function lensVignette(k = 1, o = {}) {
  if (k < .02) return;
  const rx = W * (o.rx ?? .6), ry = H * (o.ry ?? .74), col = o.col || '#2A2230';
  irisShape(ellPts(W / 2, H / 2, rx, ry, 44), col);
  paint(ellPts(W / 2, H / 2, rx, ry, 44), { fill: col, fillOp: 110 * k, bleed: .5, tex: .3, border: 1, ink: '#5A4E58', sw: 3 });
  inkLine(ellPts(W / 2 - 40, H / 2 - 30, rx * .9, ry * .88, 24, 0, Math.PI * 1.05).slice(0, 6), 5, o.hi || '#F6EEDC', 'paint', .6);
  inkLine(ellPts(W / 2 + 40, H / 2 + 30, rx * .92, ry * .9, 24, 0, Math.PI * .02).slice(0, 4), 3, o.hi || '#F6EEDC', 'paint', .6);
}
// A vortex round (cx, cy) that grows until it fills the frame (k 0 → 1, ends in a flash of cols[0]); run k 1 → 0 at the
// start of the next shot to unwind out of the new scene. A motivated transition: dive into a globe / a cup / a drain.
function swirlVortex(k, cx = W / 2, cy = H / 2, t = T, o = {}) {
  if (k < .01) return;
  const R = lerp(60, 1500, easeIn(k)), cols = o.cols || ['#E8ECF4', '#C8D2E6', '#F4F6FA', '#AEBAD4'];
  paint(ellPts(cx, cy, R * .9, R * .8, 30, 10), { wash: cols[0], washOp: 255 * clamp(k * 1.6 - .5), fill: cols[1], fillOp: 80 * k, bleed: .3, tex: .4, ink: null });
  swirlStrokes(cx, cy, R * .15, R, { n: 46, rot: t * 4, cols, sw: 2 + 4 * k, br: 'paint', seed: 3, flat: .85 });
  swirlStrokes(cx, cy, R * .1, R * .7, { n: 24, rot: -t * 3, cols: [cols[3], cols[0]], sw: 1.4 + 2 * k, br: 'bristle', seed: 9, flat: .85 });
  for (let i = 0; i < 40; i++) { const a = hash(i * 3.1) * TAU + t * (2 + hash(i) * 3), r = R * (.2 + .8 * hash(i * 5.7)); paint(ellPts(cx + Math.cos(a) * r, cy + Math.sin(a) * r * .85, 5 + 6 * hash(i), 5 + 6 * hash(i), 7), { wash: cols[2], ink: null }); }
  if (k > .85) flash(clamp((k - .85) / .15), cols[0]);
}

// ---------- split screen ----------
// splitHalf(side, z, off, bgCol, draw): side -1 = left, 1 = right. draw() paints in the half's own 960×1080 coordinates
// (x 0..960), scaled by z about the half's centre and slid outward by off px. Draw the divider last.
function splitHalf(side, z, off, bgCol, draw) {
  const ox = side < 0 ? 0 : 960;
  paint(rectPts(ox + off * side - (side < 0 ? 60 : 0), -60, 960 + 60, H + 120), { wash: bgCol, ink: null });
  push(); translate(ox + 480 + off * side, 540); scale(z); translate(-480, -540);
  draw();
  pop();
}
// A torn paper strip down the middle; o.cord true threads a cord down it (the link between the two halves).
function paperDivider(t, k = 1, o = {}) {
  if (k < .02) return;
  const pts = [], w = 18 * k; for (let i = 0; i <= 12; i++) pts.push([960 - w + (hash(i * 3) - .5) * 6, -40 + i * (H + 80) / 12]);
  for (let i = 12; i >= 0; i--) pts.push([960 + w + (hash(i * 5) - .5) * 6, -40 + i * (H + 80) / 12]);
  paint(pts, { wash: PAL.paper, ink: '#B8A88E', sw: .7 });
  if (o.cord) { const y = []; for (let i = 0; i <= 10; i++) y.push([960 + Math.sin(t * 1.5 + i) * 3 * k, -40 + i * (H + 80) / 10]); cord(y, 2.2 * k, o.col, o.under); }
}

// ---------- from 《电动少女》 ----------
// A wide, warm pool of light: seven faint layers, so the rim does not band on a dark wall (softGlow has four).
function warmGlow(x, y, rx, ry, col, k = 1) { if (k < .02) return; for (let i = 0; i < 7; i++) { const f = 1 - i * .13; paint(ellPts(x, y, rx * f, ry * f, 28), { wash: col, washOp: Math.min(255, 11 * k), ink: null }); } }
// ∫ rate(s) ds from a to t (midpoint rule). A spin whose speed follows a keyframed knob stays a pure function of t.
function integ(a, t, rate, n = 40) { if (t <= a) return 0; const h = (t - a) / n; let s = 0; for (let i = 0; i < n; i++) s += rate(a + (i + .5) * h); return s * h; }
// A spotlight beam from (x0, y0) at angle ang (0 = straight down): a translucent cone and a soft pool at its end.
function spotBeam(x0, y0, ang, len, w, col, k = 1) {
  if (k < .02) return;
  const dx = Math.sin(ang), dy = Math.cos(ang), ex = x0 + dx * len, ey = y0 + dy * len, nx = dy, ny = -dx;
  paint([[x0 - nx * 20, y0 - ny * 20], [x0 + nx * 20, y0 + ny * 20], [ex + nx * w, ey + ny * w], [ex - nx * w, ey - ny * w]], { wash: col, washOp: 46 * k, ink: null });
  softGlow(ex, ey, w * 1.1, w * .35, col, .8 * k);
}
// Confetti drifting down over the frame (frame coords); k 0..1 density.
function confettiFall(t, k, n = 90, cols = ['#E8FF7A', '#FF6AD0', '#7AF0FF', '#FFD23A', '#B07AFF']) {
  if (k < .01) return;
  for (let i = 0; i < n; i++) {
    const x = frac(hash(i * 3.3) + Math.sin(t * .7 + i) * .02) * W, y = frac(hash(i * 5.9) + t * (.12 + .1 * hash(i))) * (H + 100) - 50, a = t * 3 + i;
    paint([[x + Math.cos(a) * 9, y + Math.sin(a) * 4], [x - Math.sin(a) * 6, y + Math.cos(a) * 9], [x - Math.cos(a) * 9, y - Math.sin(a) * 4]], { wash: cols[i % cols.length], washOp: 230 * k, ink: null });
  }
}
// Camera on an outer set that nests an inner full-frame set in the opening R = [ox, oy, ow, oh] (scale k = ow / W).
// While the view is not inside the opening: camBegin on the outer set; outerFn(paintInner) must nest paintInner at R.
// Once the view lies wholly inside the opening, the inner set is painted directly in its own coords at zoom z·k —
// the same picture, no nested overflow, and much cheaper. innerFn(lite) gets lite = true when it is painted tiny.
function nestView(cx, cy, z, R, outerFn, innerFn) {
  const [ox, oy, ow, oh] = R, k = ow / W, hw = W / 2 / z, hh = H / 2 / z;
  if (cx - hw >= ox && cx + hw <= ox + ow && cy - hh >= oy && cy + hh <= oy + oh) { camBegin((cx - ox) / k, (cy - oy) / k, z * k); innerFn(false); camEnd(); return; }
  camBegin(cx, cy, z); outerFn(() => innerFn(z * k < .3)); camEnd();
}
// A human hand (a giant next to dolls / Clawds): palm, four two-joint fingers, thumb, a suit sleeve with a cufflink.
// (x, y) = wrist, s = palm width px, o.ang = finger direction, o.curl 0..1, o.pinch 0..1 (thumb to index), o.mirror = the
// other hand, o.noSleeve, o.sleeve length (×s), o.cols { skin, skinDk, sleeve, sleeveDk, cuff, link }.
function humanHand(x, y, s, o = {}) {
  const C = { skin: '#E2BEA4', skinDk: '#C09478', sleeve: '#6E7078', sleeveDk: '#4E5058', cuff: '#ECE6DA', link: '#D4A84A', ...o.cols };
  const curl = o.curl || 0, pinch = o.pinch || 0, sw = clamp(s / 40, .6, 3);
  push(); translate(x, y); rotate(o.ang || 0); if (o.mirror) scale(1, -1);
  const P = (pts, op) => paint(pts.map(q => [q[0] * s, q[1] * s]), { ink: PAL.ink, sw, ...op });
  if (!o.noSleeve) {
    const L = o.sleeve ?? 4;
    P([[-L, -.62], [-.32, -.5], [-.32, .5], [-L, .62]], { wash: C.sleeve, fill: C.sleeveDk, fillOp: 60, tex: .5 });
    P([[-.42, -.52], [-.12, -.46], [-.12, .46], [-.42, .52]], { wash: C.cuff });
    P(ellPts(-.27, .2, .08, .08, 10), { wash: C.link, fill: '#9A7428', fillOp: 70 });
  }
  P([[-.16, -.4], [.82, -.46], [.9, .4], [-.16, .4]], { wash: C.skin, fill: C.skinDk, fillOp: 40, tex: .4, curv: .25 });
  [[-.34, .95], [-.12, 1.05], [.1, 1.0], [.31, .78]].forEach(([fy, len], i) => {
    const c = clamp(curl + (i === 0 ? pinch * .5 : 0)), a1 = c * 1.1, a2 = a1 + c * 1.3;
    const p0 = [.82, fy], p1 = [p0[0] + Math.cos(a1) * len * .5, p0[1] + Math.sin(a1) * len * .5], p2 = [p1[0] + Math.cos(a2) * len * .45, p1[1] + Math.sin(a2) * len * .45];
    P(ribbonPts([p0, p1, p2], .21, .18), { wash: C.skin, fill: C.skinDk, fillOp: 40, curv: .3 });
    P(ellPts(p2[0] - Math.cos(a2) * .05, p2[1] - Math.sin(a2) * .05, .06, .05, 8), { wash: '#F2D6C4', ink: null });
  });
  const ta = lerp(-.95, -.15, pinch), t0 = [.15, -.38], t1 = [t0[0] + Math.cos(ta) * .45, t0[1] + Math.sin(ta) * .45], ta2 = ta + .4 + pinch * .5, t2 = [t1[0] + Math.cos(ta2) * .38, t1[1] + Math.sin(ta2) * .38];
  P(ribbonPts([t0, t1, t2], .26, .2), { wash: C.skin, fill: C.skinDk, fillOp: 40, curv: .3 });
  pop();
}
// World position of the index fingertip of humanHand(x, y, s, o). To put a fingertip ON a knob / plug: compute
// tip = humanHandTip(0, 0, s, o) and paint the hand at (target − tip) — never guess the wrist.
function humanHandTip(x, y, s, o = {}) {
  const c = clamp((o.curl || 0) + (o.pinch || 0) * .5), a1 = c * 1.1, a2 = a1 + c * 1.3, len = .95;
  let lx = .82 + Math.cos(a1) * len * .5 + Math.cos(a2) * len * .45, ly = -.34 + Math.sin(a1) * len * .5 + Math.sin(a2) * len * .45;
  if (o.mirror) ly = -ly;
  const a = o.ang || 0;
  return [x + (lx * Math.cos(a) - ly * Math.sin(a)) * s, y + (lx * Math.sin(a) + ly * Math.cos(a)) * s];
}

// ---------- from 《丸之內虐待狂》 ----------
// A Clawd playing a stick-like prop (umbrella, broom, guitar) as a guitar: handle end H just outside the body on the strumming side (screen left, so the arm
// stays visible: arms are painted behind the body), shaft crossing below the eyes and mouth, tip up to screen right.
// Returns the arm angles that put both hands on the shaft, plus H and T for umbrella(). strum 0..1 moves the right hand.
function airGuitar(x, y, u, o = {}, strum = 0) {
  const dy = (o.dy || 0) * u, H = [x - 5.4 * u, y + dy - 2.2 * u], F = [x + 6.4 * u, y + dy - 5.6 * u];
  const d = Math.hypot(F[0] - H[0], F[1] - H[1]), D = [(F[0] - H[0]) / d, (F[1] - H[1]) / d], T = [H[0] + D[0] * d * 1.12, H[1] + D[1] * d * 1.12];
  const onLine = (px, py) => {                       // the point on the shaft 2.2u from the shoulder (else the nearest one)
    const pr = (px - H[0]) * D[0] + (py - H[1]) * D[1], cx = H[0] + D[0] * pr, cy = H[1] + D[1] * pr, q = Math.hypot(px - cx, py - cy);
    const s = q < 2.2 * u ? pr + Math.sqrt((2.2 * u) ** 2 - q * q) : pr; return [H[0] + D[0] * s, H[1] + D[1] * s];
  };
  const fr = onLine(x + 4.9 * u, y + dy - 4.5 * u), st = [H[0] + .3 * u, H[1] + (strum - .5) * .9 * u];
  return { H, T, aL: armAngleTo(x, y, u, st[0], st[1], -1, o), aR: armAngleTo(x, y, u, fr[0], fr[1], 1, o) };
}
