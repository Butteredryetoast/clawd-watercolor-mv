// props.js: this film's set dressing and objects, painted with paint() / inkLine() + texture.js strokes.
// Positions that vary come from hash(i), never Math.random, so every frame is a pure function of t.
// Song-independent pieces (lights, roofs, snow, bubbles, cords, vortex …) are already in kit.js — use those first.
//
// Rules learned the hard way:
// - no lettering on props / signs (the film's only text is the title once, the credits block and subtitles);
// - glows: softGlow / glowDot (stacked washes), never a single watercolor fill (hard rim);
// - no pure-white strokes on light paper (p5.brush spectral mixing turns them grey);
// - small shapes (< 40 px on screen) are flattened to washes automatically (FILL_MIN in core.js).
