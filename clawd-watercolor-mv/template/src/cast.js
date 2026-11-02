// cast.js: this film's characters, all built on clawd() from clawd.js (do NOT change the basic silhouette; tell
// characters apart with colour + accessories drawn through the o.draw / o.armL / o.armR hooks, in body-local units).
// Write one function per character: name(x, y, u, o) → clawd(x, y, u, { ...defaults, ...o, draw: accessories }).
//
// Hands: a Clawd faces the viewer, so its LEFT hand is the screen-right arm (aR) and its RIGHT hand is aL.
// In a back view (eyes 'none', mouth null) the sides swap. Held props: draw them in o.armL / o.armR at (0, 0).
// Use clawdArmTip() / armAngleTo() (kit.js) to put a hand exactly on a prop.

const ME = { col: PAL.clay, dk: PAL.clayDk, lt: '#F5B394', scarf: '#34476F', scarfDk: '#22304F' };
// Example: the lead with a scarf; o.holdR = a prop in the left hand (screen right).
function me(x, y, u, o = {}) {
  clawd(x, y, u, {
    aL: .25, aR: .25, ...o,
    armR: o.holdR, armL: o.holdL,
    draw: (uu, sw) => {
      if (uu > 12 && !(o.lid > .01)) bodyStrokes(uu, ME.dk, ME.lt, 3);            // painterly shading on big bodies only
      paint(rectPts(-5.2 * uu, -3.6 * uu, 10.4 * uu, 1.1 * uu), { wash: ME.scarf, fill: ME.scarfDk, fillOp: 50, ink: PAL.ink, sw: sw * .6 });
      paint(ribbonPts([[3 * uu, -3 * uu], [3.4 * uu, -1.4 * uu + Math.sin(T * 4) * .2 * uu]], 1.1 * uu, .9 * uu), { wash: ME.scarf, ink: PAL.ink, sw: sw * .5 });
      if (o.draw) o.draw(uu, sw);
    },
  });
}
