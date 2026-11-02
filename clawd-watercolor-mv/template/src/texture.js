// texture.js: the painted surface. p5.brush strokes laid over flat washes so every set reads as brush on paper:
// directional dry-brush passes on walls and floors, wood grain, cloth folds, swirls in coffee, stipple in foam.
// Every stroke position comes from hash(seed + i), so frames stay pure functions of t (the line boil still comes
// from the per-frame random seed, like all other ink).
window.defineMoreBrushes = () => {
  brush.add('paint', { type: 'default', weight: 11, scatter: 1.1, sharpness: .35, grain: 16, opacity: 42, spacing: .3, pressure: [1.05, .55], rotate: 'natural', noise: .5 });
  brush.add('bristle', { type: 'default', weight: 7, scatter: 2.2, sharpness: .2, grain: 5, opacity: 60, spacing: .45, pressure: [1, .5], rotate: 'natural', noise: .65 });
  brush.add('stipple', { type: 'default', weight: 4, scatter: 4, sharpness: .1, grain: 3, opacity: 70, spacing: 1.6, pressure: [1, 1], rotate: 'random', noise: .8 });
};
// n strokes inside the box (x, y, w, h). o: col (or cols[]), n, angle (rad, 0 = horizontal), len (px), curve (0..1),
// br (brush), sw (weight), seed, wave (sideways wobble px).
function brushStrokes(x, y, w, h, o = {}) {
  const n = o.n ?? 18, ang = o.angle ?? 0, len = o.len ?? Math.max(w, h) * .4, seed = o.seed ?? 1, cols = o.cols || [o.col || PAL.ink];
  const ca = Math.cos(ang), sa = Math.sin(ang), curve = o.curve ?? .5, wave = o.wave ?? len * .06;
  for (let i = 0; i < n; i++) {
    const h1 = hash(seed * 13.7 + i * 1.31), h2 = hash(seed * 7.3 + i * 2.17), h3 = hash(seed * 3.1 + i * 4.43), L = len * (.55 + .7 * h3);
    const cx = x + w * h1, cy = y + h * h2, a = ang + (hash(seed + i * 9.1) - .5) * (o.spread ?? .25);
    const dx = Math.cos(a) * L / 2, dy = Math.sin(a) * L / 2, nx = -Math.sin(a) * wave * (h3 - .5) * 2, ny = Math.cos(a) * wave * (h3 - .5) * 2;
    const clampX = v => clamp(v, x, x + w), clampY = v => clamp(v, y, y + h);
    inkLine([[clampX(cx - dx), clampY(cy - dy)], [clampX(cx + nx), clampY(cy + ny)], [clampX(cx + dx), clampY(cy + dy)]], (o.sw ?? 1.2) * (.7 + .6 * h1), cols[i % cols.length], o.br || 'paint', curve);
  }
}
// Concentric swirl strokes around (cx, cy): for coffee surfaces, vortices and the dream sea.
function swirlStrokes(cx, cy, r0, r1, o = {}) {
  const n = o.n ?? 14, rot = o.rot ?? 0, flat = o.flat ?? 1, cols = o.cols || [o.col || PAL.ink];
  for (let i = 0; i < n; i++) {
    const r = lerp(r0, r1, hash(i * 3.3 + (o.seed || 0))), a0 = rot + hash(i * 5.1) * TAU, span = .6 + hash(i * 2.9) * 1.2, p = [];
    for (let k = 0; k <= 6; k++) { const a = a0 + span * k / 6, rr = r * (1 - .08 * k / 6); p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * flat]); }
    inkLine(p, (o.sw ?? 1.2) * (.6 + .8 * hash(i * 7.7)), cols[i % cols.length], o.br || 'paint', .6);
  }
}
// Scattered short dabs (foam, sugar, dust, petals on the floor).
function stipple(x, y, w, h, o = {}) {
  const n = o.n ?? 30, cols = o.cols || [o.col || PAL.cream];
  for (let i = 0; i < n; i++) {
    const px = x + w * hash(i * 1.7 + (o.seed || 0)), py = y + h * hash(i * 3.9 + (o.seed || 0)), a = hash(i * 5.3) * TAU, l = (o.len ?? 10) * (.5 + hash(i));
    inkLine([[px, py], [px + Math.cos(a) * l, py + Math.sin(a) * l]], o.sw ?? 1, cols[i % cols.length], o.br || 'stipple', 0);
  }
}
// Painterly shading on a Clawd body (call inside a clawd draw hook, body-local units): a few dry passes darker along
// the bottom, lighter on top, so the flat wash reads as brushed pigment.
function bodyStrokes(u, dk, lt, seed = 0) {
  brushStrokes(-4.6 * u, -7.7 * u, 9.2 * u, 1.6 * u, { n: 4, col: lt, angle: -.05, len: 5 * u, sw: .9 * u / 30 + .4, seed: seed + 1, br: 'bristle' });
  brushStrokes(-4.6 * u, -3.9 * u, 9.2 * u, 1.5 * u, { n: 5, col: dk, angle: .03, len: 5.5 * u, sw: 1 * u / 30 + .4, seed: seed + 2, br: 'bristle' });
}
