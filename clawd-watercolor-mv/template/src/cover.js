// cover.js: still covers in other aspect ratios (node render.mjs --cover=43,34 → out/cover/cover_<key>.png / .jpg).
// Loaded right after config.js: with ?cover=<key> in the URL it resizes the canvas before core.js reads
// CONFIG.width/height and paints COVERS[key].draw() instead of the timeline (through the LOOP hook, so no subtitles).
// A cover is laid out in logical px (w × h) and rendered at COVER_RES× that; SCALE_K = 1 / COVER_RES keeps the ink
// weights at their logical size (no close-up thinning).
//
// 每部片自己写 draw：用本片的场景函数（coverCam 取景）+ 前景角色和标题（coverScreen，逻辑像素）。
// 例：《丸之內虐待狂》work/Marunouchi/src/cover.js（神田川峡谷 + 桥栏 + 弹雨伞的她 + 中上日下的标题）。
const COVER_RES = 2;
const COVERS = {
  '43': { w: 1440, h: 1080, draw: () => coverDemo(1440, 1080) },
  '34': { w: 1080, h: 1440, draw: () => coverDemo(1080, 1440) },
};
const COVER_KEY = typeof location !== 'undefined' ? (location.search.match(/cover=(\w+)/) || [])[1] : null;
if (COVER_KEY && COVERS[COVER_KEY]) {
  const c = COVERS[COVER_KEY];
  CONFIG.width = c.w * COVER_RES; CONFIG.height = c.h * COVER_RES;
  const cv = document.getElementById('out'); cv.width = CONFIG.width; cv.height = CONFIG.height;
  window.LOOP = t => { SCALE_K = 1 / COVER_RES; c.draw(t); SCALE_K = 1; };
}
// camera in logical px: world (cx, cy) at the centre at zoom z; coverScreen = the cover's own logical px
const coverCam = (cx, cy, z) => camBegin(cx, cy, z * COVER_RES);
const coverScreen = (w, h) => camBegin(w / 2, h / 2, COVER_RES);

// placeholder until the film has its own cover: a Clawd and the title on paper
function coverDemo(w, h) {
  coverScreen(w, h);
  clawd(w / 2, h * .8, 30, { eyes: 'happy', mouth: 'grin' });
  const zs = Math.min(w, h) * .1;
  letter(CONFIG.title, w / 2, h * .18, zs, '#FFF2DE', { stroke: '#2A1E30', ink: false, font: `bold ${zs}px ${CONFIG.fonts.zh}` });
  letter(CONFIG.artist, w / 2, h * .18 + zs * 1.1, zs * .4, '#FFF2DE', { stroke: '#2A1E30', ink: false, font: `bold ${zs * .4}px ${CONFIG.fonts.zh}` });
  camEnd();
}
