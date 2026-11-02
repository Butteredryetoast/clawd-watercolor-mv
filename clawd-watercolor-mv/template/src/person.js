// person.js: the painted human rig (from 《Highway to Hell》, reused for 《Whiskey in the Jar》 and 《遇见》; 《遇见》: face lines thin out on big faces). Replaces clawd() as the cast's body; mood(), move(),
// emote() and the brushes come from clawd.js / core.js unchanged. Q-style, about 4.5 heads tall, wash + ink.
//
// person(x, y, u, o): (x, y) = ground point between the feet, u = head height in px. Person-local units (× u), y up < 0:
//   hips (±.33·wide, -1.95·legK + sit), shoulders 1.35 above the hips, head centre 2.0 above the hips (rx .5, ry .56).
//   Arms (L = screen-left, R = screen-right, before flip): aL/aR = shoulder angle from hanging down, + = raised outward;
//   eL/eR = elbow, + = the forearm keeps turning the same way. Or hand targets hL/hR = [x, y] (local u) → 2-bone IK
//   (bendL/bendR = ±1 picks the elbow side; default: elbow away from the body).
//   holdL/holdR(u, sw, ang) draw a held prop at the hand; the hook's +x runs along the forearm (elbow → hand).
//   Face: eyes (clawd.js vocabulary), brows, mouth, turn (-1..1 fakes a 3/4 view), tilt, headbang (nods on the beat).
//   Body: dy, take, sq, sx, sy, flip, rot (whole body about the feet), lean (upper body about the hips), sit (u the
//   hips drop, knees bend out), feet [[x, y], [x, y]] (local u), walk (step phase), stance (feet apart, u).
//   Look (o.look): colours + hooks hairBack / faceUnder / hairFront / faceOver / outfit (see cast.js); L.boots paints
//   tall boot shafts over the shins.
//   o.guitar = { kind, col, strum (-1..1), fret (0..1), ang } puts an instrument on the strap and both hands on it.
//   o.skipArm = 'L' | 'R' leaves one arm out; personArm(...) paints it later (e.g. over a car door).
//   Painting happens in local units through pp() / pl(), which scale by the current person's u (PU) — p5.brush
//   weights and bleeds stay in screen px, like clawd.js.

const SKIN = { a: '#F1C8A5', dk: '#D79E7C', lt: '#FBE0C8' };
const P_HIP = 1.95, P_SH = 1.35, P_HEAD = 2.0;
// Current person's unit (px per local unit) and ink weight; set by person() / personArm() for the painters below.
// PINK: optional outline colour of the current person (o.inkCol), e.g. pale background commuters.
let PU = 30, PSW = 1, PINK = null;
const pInk = c => (PINK && c === PAL.ink) ? PINK : c;
const pp = (pts, op = {}) => paint(pts.map(q => [q[0] * PU, q[1] * PU]), { ...op, ink: op.ink === undefined ? pInk(PAL.ink) : (op.ink && pInk(op.ink)), sw: (op.sw ?? 1) * PSW });
const pl = (pts, w = 1, col = PAL.ink, br = 'ink', c = .5) => inkLine(pts.map(q => [q[0] * PU, q[1] * PU]), w * PSW, pInk(col), br, c);

// Polygon of a ribbon following a path, width tapering from w0 to w1 (limbs, hair strands, light trails).
function ribbonPts(path, w0, w1 = w0) {
  const L = [], R = [], n = path.length;
  for (let i = 0; i < n; i++) {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    const w = lerp(w0, w1, i / (n - 1)) / 2, nx = -dy / d * w, ny = dx / d * w;
    L.push([path[i][0] + nx, path[i][1] + ny]); R.push([path[i][0] - nx, path[i][1] - ny]);
  }
  return L.concat(R.reverse());
}
// 2-bone IK from (sx, sy) toward (tx, ty); returns the elbow and the (clamped) end point.
function ik2(sx, sy, tx, ty, l1, l2, bend) {
  let dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy) || 1e-6;
  const max = (l1 + l2) * .999, min = Math.abs(l1 - l2) + 1e-3;
  if (d > max) { tx = sx + dx / d * max; ty = sy + dy / d * max; d = max; }
  if (d < min) { tx = sx + dx / d * min; ty = sy + dy / d * min; d = min; }
  const a = Math.atan2(ty - sy, tx - sx), b = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const ea = a + bend * b;
  return { ex: sx + Math.cos(ea) * l1, ey: sy + Math.sin(ea) * l1, tx, ty };
}

// Body geometry (local u) shared by person(), personArm() and the chapters (for hand targets on props).
function personGeo(o = {}) {
  const wide = o.wide ?? 1, legK = o.legK ?? 1, sit = o.sit || 0;
  const hip = -(P_HIP * legK) + sit, sh = hip - P_SH, head = hip - P_HEAD;
  return { wide, legK, sit, hip, sh, head, neck: head + .5, shX: .58 * wide, hipX: .33 * wide, upper: .8, fore: .76, thigh: legK, shin: .95 * legK };
}
// World point → person-local u (ignores rot / scale; accounts for flip, dy and lean). For aiming hands at props.
function personLocal(x, y, u, o, wx, wy) {
  const g = personGeo(o), f = o.flip ? -1 : 1;
  let lx = (wx - x) / u * f, ly = (wy - y) / u - (o.dy || 0);
  const ln = o.lean || 0;
  if (ln) { const c = Math.cos(-ln), s = Math.sin(-ln), py = ly - g.hip; [lx, ly] = [lx * c - py * s, lx * s + py * c + g.hip]; }
  return [lx, ly];
}
// Local hand point of an arm (same maths as the painter), for props that must follow a hand.
function armSolve(g, o, side) {
  const S = [side * g.shX * .95, g.sh + .14], tgt = side < 0 ? o.hL : o.hR;
  if (tgt) {
    const pick = side < 0 ? o.bendL : o.bendR;
    let r = ik2(S[0], S[1], tgt[0], tgt[1], g.upper, g.fore, pick ?? 1);
    if (pick == null) { const r2 = ik2(S[0], S[1], tgt[0], tgt[1], g.upper, g.fore, -1); if (side * r2.ex > side * r.ex) r = r2; }
    return { S, E: [r.ex, r.ey], Hd: [r.tx, r.ty] };
  }
  const a = side < 0 ? (o.aL ?? .12) : (o.aR ?? .12), e = side < 0 ? (o.eL ?? .1) : (o.eR ?? .1);
  const ua = Math.PI / 2 - side * a, fa = ua - side * e;
  const E = [S[0] + Math.cos(ua) * g.upper, S[1] + Math.sin(ua) * g.upper];
  return { S, E, Hd: [E[0] + Math.cos(fa) * g.fore, E[1] + Math.sin(fa) * g.fore] };
}

function person(x, y, u, o = {}) {
  const L = o.look || {}, g = personGeo(o), sw = clamp(u / 30, .5, 2.6) * (o.swMul || 1);
  const sq = (o.sq || 0) + (o.take || 0);
  if (!o.noShadow) paint(ellPts(x, y + u * .04, u * (.75 + .25 * g.wide), u * .14, 18), { fill: PAL.ink, fillOp: o.shadowOp ?? 40, bleed: .3, tex: .3, border: .1, ink: null });

  push();
  translate(x, y + (o.dy || 0) * u);
  if (o.rot) rotate(o.rot);
  scale((o.flip ? -1 : 1) * (o.sx ?? 1) * (1 + sq * .5), (o.sy ?? 1) * (1 - sq));
  PU = u; PSW = sw; PINK = o.inkCol || null;
  const P = pp;

  // ---------- legs ----------
  if (!o.noLegs) [-1, 1].forEach(side => {
    const H0 = [side * g.hipX, g.hip];
    if (o.seated) {   // front view on a seat: thighs hidden (foreshortened), shins straight down to the floor
      const K = [side * g.hipX * .95, g.hip + .12], Ft = [side * g.hipX * .85, -.04];
      P(ribbonPts([K, Ft], .26 * g.wide, .16), { wash: L.pants || PAL.ink, fill: L.pantsDk || PAL.ink, fillOp: 60, tex: .5, ink: PAL.ink, sw: .7 });
      if (L.boots) P(ribbonPts([[Ft[0], lerp(K[1], Ft[1], .35)], Ft], .26, .21), { wash: L.boots, fill: L.bootsDk || PAL.ink, fillOp: 50, tex: .5, ink: PAL.ink, sw: .6 });
      P(ellPts(Ft[0] + side * .03, -.06, .17, .09, 12), { wash: L.shoes || PAL.ink, ink: PAL.ink, sw: .5 });
      return;
    }
    let F = o.feet ? o.feet[side < 0 ? 0 : 1] : [side * (.27 * g.wide + (o.stance || 0)), 0];
    if (o.walk != null) { const ph = Math.sin((o.walk + (side < 0 ? 0 : .5)) * TAU); if (ph > 0) F = [F[0], F[1] - ph * .32]; }
    const r = ik2(H0[0], H0[1], F[0], F[1], g.thigh, g.shin, side < 0 ? 1 : -1);
    const path = [H0, [r.ex, r.ey], [r.tx, r.ty]];
    P(ribbonPts(path, .27 * g.wide, .16), { wash: L.pants || PAL.ink, fill: L.pantsDk || PAL.ink, fillOp: 60, tex: .5, ink: PAL.ink, sw: .7, curv: .25 });
    if (L.legsSkin) P(ribbonPts([[r.ex, r.ey], [r.tx, r.ty - .05]], .16, .13), { wash: L.skin || SKIN.a, ink: PAL.ink, sw: .6 });
    if (L.boots) P(ribbonPts([[lerp(r.ex, r.tx, .1), lerp(r.ey, r.ty, .1)], [r.tx, r.ty - .05]], .26, .21), { wash: L.boots, fill: L.bootsDk || PAL.ink, fillOp: 50, tex: .5, ink: PAL.ink, sw: .6 });
    P(ellPts(r.tx + side * .05, r.ty - .06, .17, .09, 12), { wash: L.shoes || PAL.ink, ink: PAL.ink, sw: .5 });
  });

  // ---------- upper body (leans about the hips) ----------
  push();
  if (o.lean) { translate(0, g.hip * u); rotate(o.lean); translate(0, -g.hip * u); }
  // torso
  const tor = [[-g.shX, g.sh + .06], [-g.shX * .5, g.sh - .04], [g.shX * .5, g.sh - .04], [g.shX, g.sh + .06],
               [g.shX * .9, g.hip - .55], [g.hipX + .07, g.hip + .1], [-g.hipX - .07, g.hip + .1], [-g.shX * .9, g.hip - .55]];
  P(rectPts(-.09, g.neck - .02, .18, g.sh - g.neck + .08), { wash: SKIN.dk, ink: null });
  P(tor, { wash: L.shirt || PAL.cream, fill: L.shirtDk || '#C9BBA6', fillOp: 70, tex: .6, ink: PAL.ink, sw: .8, curv: .2 });
  if (L.outfit) L.outfit(g, o);
  if (o.guitar) guitarOn(g, o);

  // ---------- head (tilts and nods about the neck) ----------
  const nod = (o.headbang || 0) * pulse(T, 4.5);
  push();
  translate(0, g.neck * u); rotate((o.tilt || 0) + nod * .18); translate(0, (-g.neck + nod * .1) * u);
  const Hh = { cx: 0, cy: g.head, rx: .5, ry: .56, turn: clamp(o.turn || 0, -1, 1), wind: o.hairWind || 0, sw };
  if (L.hairBack) L.hairBack(Hh, o);
  P(ellPts(0, g.head, .5, .56, 26), { wash: L.skin || SKIN.a, ink: null });
  P(ellPts(-.12 + Hh.turn * .08, g.head - .2, .26, .2, 16), { fill: L.skinLt || SKIN.lt, fillOp: 90, bleed: .2, tex: .7, border: .7, ink: null });
  P(ellPts(0, g.head + .34, .38, .14, 16), { fill: L.skinDk || SKIN.dk, fillOp: 70, bleed: .15, tex: .6, border: .6, ink: null });
  P(ellPts(0, g.head, .5, .56, 26), { ink: PAL.ink, sw: .9 });
  if (L.faceUnder) L.faceUnder(Hh, o);
  face(Hh, o, L);
  if (L.hairFront) L.hairFront(Hh, o);
  if (L.faceOver) L.faceOver(Hh, o);
  pop();

  // ---------- arms ----------
  for (const side of [-1, 1]) if (o.skipArm !== (side < 0 ? 'L' : 'R')) armPaint(g, o, L, side);
  pop();
  pop();
  if (o.emote) emote(o.emote, x + (o.flip ? -1 : 1) * .75 * u, y + ((o.dy || 0) + g.head - .8) * u, u * .32, o.emoteK ?? 1);
}

// Paint one arm (local units; called inside person()'s transform).
function armPaint(g, o, L, side) {
  const { S, E, Hd } = armSolve(g, o, side), P = pp;
  const sleeveCol = L.sleeve || L.shirt || PAL.cream, bare = L.sleeveLen === 'none', short = L.sleeveLen === 'short';
  P(ribbonPts([S, E, Hd], .25, .15), { wash: bare || short ? (L.skin || SKIN.a) : sleeveCol, fill: bare || short ? SKIN.dk : (L.sleeveDk || L.shirtDk || '#C9BBA6'), fillOp: 50, tex: .5, ink: PAL.ink, sw: .7, curv: .3 });
  if (short) P(ribbonPts([S, [lerp(S[0], E[0], .75), lerp(S[1], E[1], .75)]], .3, .25), { wash: sleeveCol, ink: PAL.ink, sw: .6 });
  if (L.cuff && !bare && !short) { const c = [lerp(E[0], Hd[0], .72), lerp(E[1], Hd[1], .72)]; P(ribbonPts([c, [lerp(E[0], Hd[0], .9), lerp(E[1], Hd[1], .9)]], .21, .2), { wash: L.cuff, ink: PAL.ink, sw: .5 }); }
  P(ellPts(Hd[0], Hd[1], .11, .1, 12), { wash: L.skin || SKIN.a, ink: L.skinDk || SKIN.dk, sw: .5 });
  const hook = side < 0 ? o.holdL : o.holdR;
  if (hook) { const u = PU, sw = PSW; push(); translate(Hd[0] * u, Hd[1] * u); const fa = Math.atan2(Hd[1] - E[1], Hd[0] - E[0]); rotate(fa); hook(u, sw, fa); PU = u; PSW = sw; pop(); }
}
// Paint only one arm of a person, in the same place person() would (for layering over doors, counters, ...).
function personArm(x, y, u, o, side) {
  const g = personGeo(o), sw = clamp(u / 30, .5, 2.6) * (o.swMul || 1), sq = (o.sq || 0) + (o.take || 0);
  push(); translate(x, y + (o.dy || 0) * u); if (o.rot) rotate(o.rot);
  scale((o.flip ? -1 : 1) * (o.sx ?? 1) * (1 + sq * .5), (o.sy ?? 1) * (1 - sq)); PU = u; PSW = sw; PINK = o.inkCol || null;
  if (o.lean) { translate(0, g.hip * u); rotate(o.lean); translate(0, -g.hip * u); }
  armPaint(g, o, o.look || {}, side);
  pop();
}
// World position of a person's hand (follows rot-free poses; good enough for props handed over between people).
function personHandAt(x, y, u, o, side) {
  const g = personGeo(o), { Hd } = armSolve(g, o, side), f = o.flip ? -1 : 1;
  let [lx, ly] = Hd; const ln = o.lean || 0;
  if (ln) { const c = Math.cos(ln), s = Math.sin(ln), py = ly - g.hip; [lx, ly] = [lx * c - py * s, lx * s + py * c + g.hip]; }
  return [x + lx * u * f, y + (ly + (o.dy || 0)) * u];
}

// ---------- face ----------
function face(Hh, o, L) {
  const { cy, turn } = Hh, fx = turn * .17, sp = .2 * (1 - .22 * Math.abs(turn)), ey = cy + .04;
  const P = pp, fw = Math.min(1, 1.3 / PSW), ln = (pts, w = 1, ...r) => pl(pts, w * fw, ...r);   // 大脸（u > 39）时五官线条按比例收细，免得笑眼糊成墨团
  const e = o.eyes || 'normal', sqz = clamp(o.squint || 0);
  const blink = (e === 'normal' || e === 'look') && ((T * .9 + (o.seed || 0) * 1.7) % 3.3) < .12;
  const brows = o.brows || (e === 'angry' ? 'down' : e === 'scared' ? 'up' : 'flat'), bc = L.browCol || L.hair || PAL.ink;
  // brows
  for (const s of [-1, 1]) {
    const bx = fx + s * sp, by = ey - .19, inner = brows === 'down' ? .05 : brows === 'up' ? -.05 : brows === 'worried' ? -.06 : 0, outer = brows === 'worried' ? .03 : 0;
    pl([[bx - s * .02, by + inner], [bx + s * .13, by - .02 + outer]], (L.browW || 1.1) * Math.min(1, 1.4 / PSW), bc, 'ink', .3);   // capped: thick brows read as sunglasses at large u
  }
  if (L.freckles) for (const s of [-1, 1]) for (let i = 0; i < 3; i++) P(ellPts(fx + s * (.24 + i * .05), ey + .13 + (i % 2) * .03, .012, .012, 6), { wash: '#B9765A', ink: null });
  if (o.blush ?? L.blush) for (const s of [-1, 1]) P(ellPts(fx + s * .3, ey + .14, .09, .045, 12), { fill: PAL.rose, fillOp: 130 * (o.blush ?? L.blush), bleed: .2, ink: null });
  // eyes
  if (sqz > .8) { for (const s of [-1, 1]) ln([[fx + s * sp - .06, ey], [fx + s * sp + .06, ey]], 1); }
  else if (e === 'shades') {
    P(rrPts(fx - sp - .14, ey - .09, sp * 2 + .28, .17, .06), { wash: PAL.ink, ink: null });
    ln([[fx - sp - .08, ey - .05], [fx - sp + .02, ey - .06]], .4, PAL.cream, 'inkfine', 0);
  } else for (const s of [-1, 1]) {
    const X = fx + s * sp, Y = ey, k = 1 - sqz * .7;
    if (e === 'normal' || e === 'look' || (e === 'wink' && s > 0) || e === 'angry') {
      const lx = e === 'look' ? (o.lookX || 0) * .05 : 0, ly = e === 'look' ? (o.lookY || 0) * .04 : 0;
      if (blink) ln([[X - .06, Y + .02], [X + .06, Y + .02]], .9);
      else {
        P(ellPts(X + lx, Y + ly, .055, .085 * k, 12), { wash: PAL.ink, ink: null });
        if (PU > 38) P(ellPts(X + lx + .018, Y + ly - .03 * k, .017, .022 * k, 8), { wash: PAL.cream, washOp: 230, ink: null });
        if (L.lashes) ln([[X - .07, Y - .055 * k], [X, Y - .1 * k], [X + s * .085, Y - .07 * k], [X + s * .12, Y - .1 * k]], .8, PAL.ink, 'ink', .4);
      }
    } else if (e === 'happy' || e === 'wink') ln([[X - .08, Y + .03], [X, Y - .05], [X + .08, Y + .03]], 1.1, PAL.ink, 'ink', .3);
    else if (e === 'closed') ln([[X - .08, Y - .01], [X, Y + .05], [X + .08, Y - .01]], 1.1, PAL.ink, 'ink', .4);
    else if (e === 'narrow') P(rectPts(X - .08, Y - .015, .16, .04), { wash: PAL.ink, ink: null });
    else if (e === 'scared') {
      P(ellPts(X, Y, .085, .11, 14), { wash: '#FFFDF6', ink: PAL.ink, sw: .5 });
      P(ellPts(X + (o.lookX || 0) * .03, Y + .01 + (o.lookY || 0) * .03, .03, .04, 8), { wash: PAL.ink, ink: null });
    } else if (e === 'spark') {
      P(ellPts(X, Y, .13, .13, 14), { fill: PAL.ochre, fillOp: 90, bleed: .3, ink: null });
      P(starPts(X, Y, .12 * (1 + .12 * Math.sin(T * 14))), { wash: PAL.cream, fill: PAL.ochre, fillOp: 80, ink: PAL.ink, sw: .45 });
    } else if (e === 'dot') P(ellPts(X, Y, .035, .045, 8), { wash: PAL.ink, ink: null });
    else if (e === 'heart') P(heartPts(X, Y, .08), { wash: '#E2476E', ink: PAL.ink, sw: .4 });
    else if (e === 'x') { ln([[X - .06, Y - .06], [X + .06, Y + .06]], .9, PAL.ink, 'ink', 0); ln([[X + .06, Y - .06], [X - .06, Y + .06]], .9, PAL.ink, 'ink', 0); }
    else if (e === 'swirl') { const p = []; for (let i = 0; i < 12; i++) { const a = i * .8 + T * 6 * s, r = i * .009; p.push([X + Math.cos(a) * r, Y + Math.sin(a) * r]); } ln(p, .6, PAL.ink, 'inkfine', .6); }
  }
  // nose
  ln([[fx + turn * .06 - .025, cy + .16], [fx + turn * .06 + .02, cy + .19], [fx + turn * .06 + .03, cy + .15]], .55, L.skinDk || SKIN.dk, 'inkfine', .5);
  // mouth
  const m = o.mouth, mx = fx + turn * .03, my = cy + .3;
  if (m === 'smile') ln([[mx - .1, my - .02], [mx, my + .04], [mx + .1, my - .02]], .9, PAL.ink, 'ink', .6);
  else if (m === 'grin') { P([[mx - .14, my - .04], [mx + .14, my - .04], [mx + .09, my + .08], [mx - .09, my + .08]], { wash: '#5A2430', ink: PAL.ink, sw: .6, curv: .3 }); P(rectPts(mx - .11, my - .035, .22, .04), { wash: '#FFFDF6', ink: null }); }
  else if (m === 'O') P(ellPts(mx, my + .02, .07, .085, 12), { wash: '#5A2430', ink: PAL.ink, sw: .6 });
  else if (m === 'o') P(ellPts(mx, my + .01, .035, .045, 10), { wash: '#5A2430', ink: null });
  else if (m === 'flat') ln([[mx - .08, my], [mx + .08, my]], .9, PAL.ink, 'ink', 0);
  else if (m === 'wobble') ln([[mx - .1, my], [mx - .05, my - .025], [mx, my], [mx + .05, my - .025], [mx + .1, my]], .8, PAL.ink, 'ink', .3);
  else if (m === 'shout') {
    P(ellPts(mx, my + .04, .14, .13, 16), { wash: '#4A1C28', ink: PAL.ink, sw: .7 });
    P(ellPts(mx, my + .12, .08, .04, 10), { wash: PAL.rose, ink: null });
    P(rectPts(mx - .09, my - .085, .18, .035), { wash: '#FFFDF6', ink: null });
  } else if (m === 'tongue') {
    ln([[mx - .1, my - .02], [mx, my + .03], [mx + .1, my - .02]], .9, PAL.ink, 'ink', .6);
    P([[mx - .05, my + .02], [mx + .05, my + .02], [mx + .045, my + .11], [mx - .045, my + .11]], { wash: PAL.rose, ink: PAL.ink, sw: .45, curv: .6 });
  }
}

// ---------- instrument on the strap (local units) ----------
// kind 'guitar' (cherry red, offset double cutaway) or 'bass' (long neck). Hands: L strums at the body, R frets the neck.
const GUITAR_RED = '#C8233A', GUITAR_RED_DK = '#86132A';
function instrumentPose(g, gt) {
  const ang = gt.ang ?? -.5, C = [-.12 * g.wide, g.hip - .28], neck = gt.kind === 'bass' ? 1.75 : 1.35;
  const ca = Math.cos(ang), sa = Math.sin(ang), at = (u, v) => [C[0] + u * ca - v * sa, C[1] + u * sa + v * ca];
  return { C, ang, neck, at, strum: at(.02, -.03 + (gt.strum || 0) * .15), fret: at(.5 + (gt.fret ?? .5) * (neck - .65), .07) };
}
function guitarOn(g, o) {
  const gt = o.guitar, ip = instrumentPose(g, gt), { C, ang, neck, at } = ip, P = pp;
  const body = gt.col || (gt.kind === 'bass' ? '#B5793E' : GUITAR_RED), dk = gt.dk || (gt.kind === 'bass' ? '#6E4421' : GUITAR_RED_DK);
  // strap over the far shoulder
  pl([at(-.32, -.2), [-g.shX * .2, g.sh + .05], [g.shX * .7, g.sh + .05], at(neck * .32, -.07)], 2.4, '#3A2E2A', 'ink', .5);
  push(); translate(C[0] * PU, C[1] * PU); rotate(ang);
  const shape = [[-.44, -.05], [-.36, -.28], [-.12, -.3], [.05, -.22], [.22, -.36], [.3, -.26], [.2, -.06], [.24, .14], [.36, .26], [.24, .33], [.02, .22], [-.2, .33], [-.4, .24]];
  P(shape, { wash: body, fill: dk, fillOp: 90, tex: .6, ink: PAL.ink, sw: .8, curv: .5 });
  P([[-.3, .02], [-.18, -.14], [.08, -.12], [.12, .1], [-.12, .2]], { wash: '#F4ECDC', ink: PAL.ink, sw: .45, curv: .4 });
  for (const px of [-.17, -.03]) P(rectPts(px, -.08, .06, .16), { wash: PAL.ink, ink: null });
  P(rectPts(-.33, -.06, .05, .12), { wash: '#B8B2A8', ink: null });
  // neck + headstock
  P(rectPts(.18, -.045, neck - .2, .09), { wash: '#7A5236', fill: '#4E3524', fillOp: 70, ink: PAL.ink, sw: .6 });
  for (let i = 1; i < 9; i++) { const fx = .22 + (neck - .26) * (1 - Math.pow(.86, i)) / (1 - Math.pow(.86, 9)); pl([[fx, -.045], [fx, .045]], .35, '#D8C9A8', 'inkfine', 0); }
  P([[neck - .02, -.06], [neck + .2, -.1], [neck + .24, .04], [neck - .02, .06]], { wash: body, ink: PAL.ink, sw: .6 });
  for (let i = 0; i < (gt.kind === 'bass' ? 4 : 6); i++) pl([[-.3, -.03 + i * .012], [neck, -.03 + i * .012]], .22, '#EFE6D2', 'inkfine', 0);
  pop();
  // the hands go on the instrument
  o.hL = o.hL || ip.strum; o.hR = o.hR || ip.fret;
  if (o.bendL == null) o.bendL = 1;
  if (o.bendR == null) o.bendR = 1;
}
