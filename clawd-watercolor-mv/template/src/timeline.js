// timeline.js: chapter registry, shot dispatch, whole-sentence subtitles, credits, review marks.
// Reused from PDoomVideo (chapter()/shot dispatch and the brush wipe are unchanged); the P(doom) meter, karaoke and
// fixed wipe times were removed. Chapter breaks are motivated by on-screen action, so CONFIG.wipes is empty.
//
// Each chapter file calls chapter(name, start, end, shots) where shots = [[t0, fn], ...] in time order.
// A shot function is called as fn(t, lt, dur): t = song time, lt = t - t0, dur = shot length. It paints the whole frame
// (backgrounds included) and must be a pure function of t: frames render in parallel and out of order.

const CH = [];
function chapter(name, start, end, shots) { CH.push({ name, start, end, shots }); CH.sort((a, b) => a.start - b.start); }

const WIPES = CONFIG.wipes || [];
const WIPE_TR = .3;
// Review marks (lyric id + 复听 priority) are a preview aid: on in the studio, on in check sheets, off in the MP4
// unless render.mjs is given --review.
const REVIEW = typeof location !== 'undefined' && (!location.search.includes('render') || location.search.includes('review'));

const LOOPS = {};
const shotAt = t => SHOTLIST.find(s => t >= s.a && t < s.b) || SHOTLIST[SHOTLIST.length - 1];
const lyricAt = t => LY.find(l => t >= l[0] && t < l[1]);
function drawWorld(t) {
  if (window.LOOP) { window.LOOP(t); flushLetters(); return; }
  const ch = CH.find(c => t >= c.start && t < c.end);
  if (!ch) placeholder(t);
  else {
    let i = 0; while (i + 1 < ch.shots.length && t >= ch.shots[i + 1][0]) i++;
    const t0 = ch.shots[i][0], end = i + 1 < ch.shots.length ? ch.shots[i + 1][0] : ch.end, fn = ch.shots[i][1];
    if (!fn || t < t0) placeholder(t);                        // a shot listed as null is not painted yet
    else fn(t, t - t0, end - t0);
    CAM = null;
  }
  flushLetters();
  WIPES.forEach((b, j) => { if (Math.abs(t - b) < WIPE_TR) wipe((t - (b - WIPE_TR)) / (2 * WIPE_TR), j); });
  for (const tr of TRANSITIONS) if (Math.abs(t - tr.t) < tr.d) { transition(tr, (t - (tr.t - tr.d)) / (2 * tr.d)); flushLetters(); }
  subtitle(t);
}

// Unpainted time: show the storyboard shot so the whole film can already be scrubbed against the song.
function placeholder(t) {
  const s = shotAt(t);
  paint(rectPts(-60, -60, W + 120, H + 120), { fill: '#CBB89A', fillOp: 60, bleed: .2, tex: .5, ink: null });
  dancer(1600, 860, 12, 'idle', t, { blush: .6, aL: .35, aR: .35, mouth: 'smile' });
  const c = (txt, y, size, col = PAL.ink) => letter(txt, 960, y, size, col, { ink: false, screen: true });
  c(`${s.ch} · ${s.chName}`, 150, 54);
  c(`${s.a.toFixed(2)}–${s.b.toFixed(2)} s   ${s.lyric}`, 230, 34, PAL.clayDk);
  wrap(s.shot, 34).slice(0, 7).forEach((ln, i) => letter(ln, 160, 320 + i * 52, 34, PAL.ink, { ink: false, align: 'left', screen: true }));
  letter('（本镜头尚未绘制）', 960, 820, 30, PAL.clayDk, { ink: false, screen: true });
}
function wrap(txt, n) { const out = []; for (let i = 0; i < txt.length; i += n) out.push(txt.slice(i, i + n)); return out; }

// ---------- brush wipe ----------
// Fat paint strokes sweep across to cover the old scene, the scene swaps under full cover (p = .5), then they drag off.
// ---------- motivated transitions over hard cuts (p5.brush) ----------
// Each one is centred on a shot boundary t: it covers the old shot (p 0→.5), the shot swaps under full cover,
// then it uncovers the new one (p .5→1). Pure functions of p, so they render out of order like everything else.
const TRANSITIONS = [
  // One entry per hard cut that the shots themselves do not bridge. t = the cut, d = half-length (s). Examples:
  // { t: 18.97, type: 'whip', d: .14, dir: 1, cols: ['#3A4678', '#E8D8A8', '#232B58'], haze: '#4A5488' },  // whip pan (dir -1 = back)
  // { t: 52.50, type: 'bloom', d: .2, col: '#F4C8E8' },             // a light swells and fills the frame
  // { t: 186.77, type: 'smoke', d: .45 },                           // white breath / smoke billows across
  // { t: 210.54, type: 'paint', d: .26, cols: ['#D23A35', '#C8A0A0'] },   // p5.brush wipe in chosen colours
  // { t: 60.00, type: 'paper', d: .3 },  { t: 90.00, type: 'clock', d: .3, col: '#2B2233' },  { t: 145.02, type: 'splash', d: .3 },
];
const coverK = p => p < .5 ? easeOut(p * 2) : 1 - easeIn((p - .5) * 2);         // 0 → 1 (full cover at the cut) → 0
function transition(tr, p) {
  const k = coverK(p), fwd = p < .5;
  if (tr.type === 'paint') { wipeCols(p, tr.cols); return; }
  if (tr.type === 'whip') {                                                     // whip pan: streaks rush across, motion-blur haze
    const dir = tr.dir || 1, sh = (p - .5) * 2 * dir;
    flash(.55 * k, tr.haze || '#F3EBDC');
    for (let i = 0; i < 26; i++) {
      const y = (i + .5) / 26 * (H + 200) - 100 + Math.sin(i * 2.1) * 20, L = 500 + 900 * hash(i), x = W / 2 + sh * 1400 + (hash(i * 3.3) - .5) * 2400;
      inkLine([[x - L / 2, y], [x + L / 2, y + (hash(i) - .5) * 20]], 4 + 10 * k * hash(i * 7), (tr.cols || ['#8C6A52', '#D9C4A4', '#5A4A5E'])[i % 3], 'paint', .2);
    }
    return;
  }
  if (tr.type === 'splash') {                                                   // water thrown at the lens, then running off downward (《Whiskey》)
    const grow = p < .5 ? easeOut(p * 2) : 1, run = p < .5 ? 0 : easeIn((p - .5) * 2), top = lerp(-260, H + 260, run);
    const edge = []; for (let i = 0; i <= 12; i++) edge.push([lerp(-100, W + 100, i / 12), top + Math.sin(i * 1.7) * 40 + hash(i) * 50]);
    if (grow > .02 && run < .99) paint([...edge, [W + 100, H + 100], [-100, H + 100]], { wash: tr.col || '#8FB2C8', washOp: 255 * clamp(grow * 1.4), fill: '#5E86A0', fillOp: 60 * grow, tex: .5, bleed: .2, ink: null });
    for (let i = 0; i < 26; i++) {
      const x = hash(i * 3.3) * W, y0 = hash(i * 7.1) * H, r = (30 + 110 * hash(i * 5.7)) * grow, y = Math.max(y0, top + 40) + run * 300 * hash(i);
      if (r > 3 && y < H + r) paint(ellPts(x, y, r, r * .85, 16, 2), { wash: '#C8E0EE', washOp: 200, ink: '#4A6A80', sw: 1 });
      if (run > 0 && y < H + r) inkLine([[x, top - 20], [x + 4, y - r]], 1.4 + 2 * hash(i), '#B8D4E4', 'paint', .2);
    }
    brushStrokes(-100, -100, W + 200, H + 200, { n: 10, angle: -.2, len: 900, cols: ['#A8CADC', '#7AA0B8'], sw: 2.5 * (1 - run) + .2, br: 'paint', seed: 77, curve: .6 });
    return;
  }
  if (tr.type === 'smoke') {                                                    // white smoke billows sweep across
    const x0 = fwd ? lerp(-900, W / 2, easeOut(p * 2)) : lerp(W / 2, W + 900, easeIn((p - .5) * 2));
    for (let i = 0; i < 16; i++) {
      const r = 260 + hash(i) * 260, x = x0 + (hash(i * 2.2) - .5) * (fwd ? 1600 : 1600), y = (i / 15) * (H + 300) - 150;
      paint(ellPts(x + (fwd ? -1 : 1) * 400 * (1 - k), y, r, r * .7, 18, 10), { wash: '#F2F0F6', washOp: 255 * clamp(k * 1.3), fill: '#C9C6D4', fillOp: 70 * k, bleed: .3, tex: .4, ink: null });
    }
    brushStrokes(-200, -100, W + 400, H + 200, { n: 18, angle: -.1, len: 700, cols: ['#E2DEEA', '#CFCBDC'], sw: 2.2 * k + .2, br: 'paint', seed: 91, curve: .7, wave: 80 });
    return;
  }
  if (tr.type === 'paper') {                                                    // a gust of paper sheets fills the frame
    for (let i = 0; i < 40; i++) {
      const x = lerp(-300, W + 300, frac(hash(i) + p * 1.6)), y = hash(i * 3.1) * (H + 200) - 100, s = 90 + 120 * hash(i * 5) * (.4 + k);
      push(); translate(x, y); rotate(p * 6 + i);
      paint(rectPts(-s / 2, -s * .36, s, s * .72, 2), { wash: tr.blank ? '#F8F4EC' : '#EFE3CC', fill: '#B99A72', fillOp: tr.blank ? 0 : 50, tex: .6, ink: PAL.ink, sw: .6 }); pop();
    }
    flash(.85 * clamp(k * 1.4 - .3), tr.blank ? '#F8F4EC' : '#E8DCC4');
    return;
  }
  if (tr.type === 'clock') {                                                    // a clock hand sweeps a wedge over the frame
    const a = (fwd ? easeOut(p * 2) : easeIn((p - .5) * 2)) * TAU, R = 1500, pts = [[W / 2, H / 2]];
    const a0 = fwd ? 0 : a, a1 = fwd ? a : TAU;
    for (let i = 0; i <= 24; i++) { const ang = -Math.PI / 2 + lerp(a0, a1, i / 24); pts.push([W / 2 + Math.cos(ang) * R, H / 2 + Math.sin(ang) * R]); }
    if (Math.abs(a1 - a0) > .02) paint(pts, { wash: tr.col || PAL.ink, fill: '#5A4A5E', fillOp: 60, tex: .5, ink: null });
    const ha = -Math.PI / 2 + a;
    inkLine([[W / 2, H / 2], [W / 2 + Math.cos(ha) * 1200, H / 2 + Math.sin(ha) * 1200]], 6, '#C9A45C', 'ink', 0);
    paint(ellPts(W / 2, H / 2, 18, 18, 12), { wash: '#C9A45C', ink: PAL.ink, sw: 1 });
    return;
  }
  if (tr.type === 'bloom') {                                                    // stepping out into daylight
    paint(ellPts(W / 2, H / 2, 200 + 1600 * k, 140 + 1100 * k, 30, 20), { fill: tr.col || '#FFF2D0', fillOp: 220 * k, bleed: .4, tex: .3, ink: null });
    flash(.8 * k * k, tr.col ? mixCol(tr.col, '#FFFFFF', .5) : '#FFF8E8');
    brushStrokes(-200, -100, W + 400, H + 200, { n: 8, angle: -.6, len: 900, cols: ['#FFE4A0', '#F7D9A8'], sw: 3 * k + .2, br: 'paint', seed: 95, curve: .4 });
  }
}
// The PDoomVideo brush wipe with chosen colours.
function wipeCols(p, cols) { const keep = WIPE_COLS[0]; WIPE_COLS[0] = cols; wipe(p, 0); WIPE_COLS[0] = keep; }

const WIPE_COLS = [[PAL.clayDk, PAL.clay], [PAL.indigo, PAL.violet], [PAL.teal, PAL.sap], [PAL.violet, PAL.rose], [PAL.ochre, PAL.clay]];
function wipe(p, idx) {
  const [c1, c2] = WIPE_COLS[idx % WIPE_COLS.length], n = 5, bh = (H + 420) / n + 40;
  push(); translate(W / 2, H / 2); rotate(-.1); translate(-W / 2, -H / 2);
  for (let i = 0; i < n; i++) {
    const y0 = -230 + i * (H + 420) / n, d = [0, .14, .06, .18, .1][i];
    const q = p < .5 ? easeOut(clamp((p * 2 - d) / (1 - d))) : ease(clamp(((p - .5) * 2 - d) / (1 - d)));
    const x0 = p < .5 ? -300 : lerp(-300, W + 400, q), x1 = p < .5 ? lerp(-300, W + 400, q) : W + 400;
    if (x1 - x0 < 30) continue;
    const pts = [], rag = (k, side) => side * (40 + 50 * hash(i * 31 + k)) + jit(12);
    for (let k = 0; k <= 8; k++) pts.push([lerp(x0, x1, k / 8), y0 + Math.sin(k * .9 + i) * 14 + jit(5)]);
    for (let k = 1; k < 9; k++) pts.push([x1 + rag(k, 1) - 40, y0 + bh * k / 9]);
    for (let k = 8; k >= 0; k--) pts.push([lerp(x0, x1, k / 8), y0 + bh + Math.sin(k * .8 + i * 2) * 14 + jit(5)]);
    if (p >= .5) for (let k = 8; k > 0; k--) pts.push([x0 - rag(k + 20, 1) + 40, y0 + bh * k / 9]);
    paint(pts, { wash: i % 2 ? c1 : c2, washOp: 255, fill: i % 2 ? c2 : c1, fillOp: 70, bleed: .05, tex: .8, border: .6, ink: null,
      hatch: { d: 44, a: 0, o: { rand: .6, gradient: .5 }, b: 'charcoal', c: i % 2 ? c2 : PAL.cream, w: .8 } });
  }
  pop();
}

// ---------- subtitles (whole sentence) + credits ----------
// The backing band is NOT painted with p5.brush: a brush fill is re-rolled at every boil step (12 times a second), and a
// large dark shape whose shape and texture change 12 times a second reads as flicker (seen in 《冬天一个游》). The band is
// drawn on the compositor instead (drawSubtitleBand, under the paper grain): soft-edged, its outline wobble taken from
// hash(lyric id), so it is fixed for the whole line and only fades in and out with it.
function subtitle(t) {
  const S = CONFIG.subtitle, L = lyricAt(t);
  creditsAt(t);
  if (!L) return;
  const [a, b, , id, pri] = L;
  const k = easeOut((t - a) / S.fadeIn) * (1 - ease((t - (b - S.fadeOut)) / S.fadeOut));
  if (k < .02) return;
  SUBTITLE = { lines: subtitleLines(L), k, id, pri };
}
// Lines top to bottom. CONFIG.subtitle.lines = [{ key, size, font, weight }]: key 'orig' = the lyric text (LY[2]),
// 'zh' = its translation (LY[6], text_zh in the JSON); font names a CONFIG.fonts entry. No lines = one 'orig' line.
// S.y is the centre of the first line; the others stack below it, S.gap apart. A line with no text is skipped.
function subtitleLines(L) {
  const S = CONFIG.subtitle, out = [];
  let y = S.y;
  for (const d of S.lines || [{ key: 'orig' }]) {
    const txt = d.key === 'zh' ? L[6] : L[2]; if (!txt) continue;
    const size = d.size || S.size;
    if (out.length) y += out[out.length - 1].size / 2 + (S.gap ?? 10) + size / 2;
    out.push({ txt, size, y, font: `${d.weight ?? S.weight ?? ''} ${size}px ${CONFIG.fonts[d.font || 'zh'] || CONFIG.fonts.zh}` });
  }
  return out;
}
function drawSubtitleBand(c) {
  const S = CONFIG.subtitle; if (!SUBTITLE || !(S.band > 0) || !SUBTITLE.lines.length) return;
  const { lines, k, id } = SUBTITLE;
  c.save();
  const top = lines[0].y - lines[0].size / 2, bot = lines[lines.length - 1].y + lines[lines.length - 1].size / 2, cy = (top + bot) / 2;
  const hw = Math.max(...lines.map(l => { c.font = l.font; return c.measureText(l.txt).width; })) / 2 + S.size * 1.1;
  const hh = (bot - top) / 2 + S.size * .32, n = 36;
  c.fillStyle = S.bandCol || S.outline;
  c.filter = `blur(${Math.round(S.size * .3)}px)`;
  // a wide pale haze, then the denser core; a squarish superellipse whose edge wobbles a little per line
  for (const [pad, op] of [[S.size * .55, .42], [0, 1]]) {
    c.globalAlpha = clamp(k * op * S.band / 255);
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, ca = Math.cos(a), sa = Math.sin(a), wob = 1 + (hash(id * 17.3 + i * 1.7) - .5) * .06;
      const x = W / 2 + Math.sign(ca) * Math.pow(Math.abs(ca), .35) * (hw + pad) * wob, y = cy + Math.sign(sa) * Math.pow(Math.abs(sa), .35) * (hh + pad * .45) * wob;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.closePath(); c.fill();
  }
  c.restore();
}
// Credit lines (词 / 曲 / 编曲 / 监制 …) as one block, shown together at CONFIG.credits.at for .hold seconds. The first
// CREDITS entry (title - artist) is usually painted by the opening shot itself (skipFirst). Long lines split at '/'.
function creditsAt(t) {
  const C = CONFIG.credits, age = t - C.at; if (age < 0 || age > C.hold) return;
  const k = ease(age / .5) * (1 - ease((age - C.hold + .6) / .6));
  const lines = CREDITS.slice(C.skipFirst === false ? 0 : 1).flatMap(([, txt]) => txt.length > 34 ? (() => { const parts = txt.split('/'); const h = Math.ceil(parts.length / 2); return [parts.slice(0, h).join(' / '), '　　' + parts.slice(h).join(' / ')]; })() : [txt.replace(/\//g, ' / ')]);
  lines.forEach((txt, i) => letter(txt, C.x ?? 70, (C.y ?? 760) + i * (C.size + 14), C.size, PAL.cream, { alpha: k * seg(age, i * .12, i * .12 + .4), stroke: CONFIG.subtitle.outline, ink: false, screen: true, align: C.align || 'left' }));
}
function drawSubtitleText(c) {
  if (REVIEW && !window.REVIEW_OFF) drawReviewMark(c, T);
  if (!SUBTITLE) return;
  const { lines, k } = SUBTITLE, S = CONFIG.subtitle;
  c.save(); c.globalAlpha = clamp(k * 1.15);
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  for (const { txt, size, y, font } of lines) {
    c.font = font;
    c.shadowColor = S.shadow || 'rgba(0,0,0,.5)'; c.shadowBlur = size * .3; c.shadowOffsetY = size * .06;
    c.lineWidth = size * .2; c.strokeStyle = S.outline; c.strokeText(txt, 960, y);
    c.shadowColor = 'transparent';
    c.fillStyle = S.color; c.fillText(txt, 960, y);
  }
  c.restore();
}
// Small corner tag while a lyric is up: "L2 · 待复听(高)". Never part of the final picture unless --review.
function drawReviewMark(c, t) {
  const L = lyricAt(t); if (!L) return;
  const [, , , id, pri, need] = L, tag = `L${id}${need ? ` · 待复听${pri === 'high' ? '（高）' : ''}` : ''} · LRC 入点 · 估计出点`;
  c.save(); c.font = `22px ${CONFIG.fonts.zh}`; const w = c.measureText(tag).width + 20;
  c.fillStyle = pri === 'high' ? 'rgba(200,50,74,.85)' : 'rgba(43,34,51,.7)'; c.fillRect(W - w - 24, 24, w, 34);
  c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.fillText(tag, W - w - 14, 41); c.restore();
}
// Label used by contact sheets and the studio.
window.frameLabel = t => { const s = shotAt(t), L = lyricAt(t); return `${t.toFixed(2)}s · ${s.ch}·${s.a.toFixed(2)}${L ? ` · L${L[3]}${L[4] === 'high' ? '!' : ''}` : ''}`; };
