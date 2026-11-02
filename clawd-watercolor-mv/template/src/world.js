// world.js: everything that must stay continuous across shots and chapters, as pure functions of song time t.
// Chapters only READ these; nothing is stored between frames.
//
//   1. layouts of the recurring sets (world coordinates), so every chapter puts the table / window / door in one place;
//   2. story state: where each prop is, what is lit, what someone wears, as t → value functions;
//   3. the set functions themselves (or put big sets in their own files: sets.js, street.js … loaded after world.js).
// A prop that moves from one place to another needs an on-screen action that explains it, and the README lists every
// continuity rule you invented (待确认).

const ROOM = { floor: 860, win: [1100, 300, 480, 270], table: [640, 1240, 760] };   // example layout
const lampOn = t => t >= 12;                                                         // example state functions
const scarfOn = t => t < 40 || t >= 120;

// Example set: a room with a window onto the night city (nest() paints the city into the window at 1/4 scale).
// nest() does NOT clip: the nested set's backgrounds overflow the window. So paint the nested view FIRST, then the
// wall in four pieces around the window (covering the overflow), keep wall texture strokes out of the window, frame last.
function roomSet(t, o = {}) {
  const [wx, wy, ww, wh] = ROOM.win, F = ROOM.floor, wall = { wash: '#4A4E78', fill: '#3A3E66', fillOp: 50, tex: .5, ink: null };
  nest(wx, wy, ww / W, () => nightCity(t, { lit: o.cityLit ?? .4 }));
  bg(-400, -300, W + 800, wy + 300, wall); bg(-400, wy + wh, W + 800, F - wy - wh, wall);
  bg(-400, wy - 2, wx + 402, wh + 4, wall); bg(wx + ww, wy - 2, W + 400 - wx - ww, wh + 4, wall);
  for (const [x, w, sd] of [[-200, wx + 160, 7], [wx + ww + 40, W + 200 - wx - ww, 8]]) brushStrokes(x, -200, w, F + 150, { n: 8, angle: -.5, len: 300, cols: ['#55598A', '#43476F'], sw: 1.2, br: 'bristle', seed: sd });
  bg(-400, F, W + 800, 600, { wash: '#7E5E44', fill: '#5E4430', fillOp: 50, tex: .5, ink: null });
  paint(rectPts(wx - 14, wy - 14, ww + 28, wh + 28), { ink: '#3A2C24', sw: 1.4 });                    // frame: outline only
  for (const [x, y, w, h] of [[wx - 14, wy - 14, ww + 28, 14], [wx - 14, wy + wh, ww + 28, 16], [wx - 14, wy, 14, wh], [wx + ww, wy, 14, wh], [wx + ww / 2 - 4, wy, 8, wh]])
    paint(rectPts(x, y, w, h), { wash: '#6E5440', ink: null });
  // a floor lamp, its light switched by world state
  inkLine([[400, F], [400, 560]], 3, '#3A2C24', 'ink', 0);
  paint([[340, 560], [460, 560], [430, 480], [370, 480]], { wash: lampOn(t) ? '#F6D27A' : '#B8A88E', ink: PAL.ink, sw: 1 });
  if (lampOn(t)) softGlow(400, 560, 260, 200, '#FFE3A0', 1.2);
}
// Example full-frame set (also nested in the window above): rooftops, moon, stars.
function nightCity(t, o = {}) {
  bg(-200, -200, W + 400, H + 400, { wash: '#232B58', fill: '#2C3366', fillOp: 50, bleed: .2, tex: .4, ink: null });
  stars(-100, -100, W + 200, 600, 50, t, { seed: 3 });
  moon(1500, 230, 60);
  roofRow(-200, W + 200, H - 80, 260, 520, { seed: 11, col: '#3A4270', dk: '#262C4E', lit: o.lit ?? .4 });
  bg(-200, H - 90, W + 400, 300, { wash: '#E4E8F1', ink: null });
}
