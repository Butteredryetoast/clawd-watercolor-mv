// dryrun.mjs: run every shot function without a browser, with p5 / p5.brush stubbed out, to catch exceptions and
// count painted shapes per frame (a proxy for render cost). Fast: the whole film in a few seconds.
//   node tools/dryrun.mjs [--from=0] [--to=208.84] [--step=0.25]
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const files = [...readFileSync('studio.html', 'utf8').replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script src="(src\/[^"]+)"><\/script>/g)].map(m => m[1]);
let shapes = 0, lines = 0;
const noop = () => {};
const brush = new Proxy({}, { get: (o, k) => k === 'polygon' ? () => { shapes++; } : k === 'spline' ? () => { lines++; } : k === 'endShape' ? () => { shapes++; } : noop });
let seed = 1;
const ctx = {
  console, Math, Number, Array, Object, JSON, String, Boolean, Infinity, NaN, isFinite, parseInt, parseFloat, Proxy, Promise, Uint8Array, Float32Array,
  brush, push: noop, pop: noop, translate: noop, rotate: noop, scale: noop, resetMatrix: noop, image: noop, randomSeed: s => { seed = s; }, noiseSeed: noop,
  random: () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; },
  location: { search: '?render' }, document: { getElementById: () => null }, window: {},
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of files) vm.runInContext(readFileSync(f, 'utf8'), ctx, { filename: f });
vm.runInContext('outX = { measureText: s => ({ width: s.length * 40 }), font: "" }; letG = { clear(){}, drawingContext: {} }; drawLetters = () => {};', ctx);
const from = +(args.from ?? 0), to = +(args.to ?? vm.runInContext('CONFIG.duration', ctx)), step = +(args.step ?? .25);
const errs = {}, heavy = [];
for (let t = from; t < to; t += step) {
  shapes = lines = 0;
  try { vm.runInContext(`T = ${t}; LETTERS = []; SUBTITLE = null; CAM = null; randomSeed(1000 + Math.floor(T * BOIL)); drawWorld(T);`, ctx); }
  catch (e) { const k = e.message; (errs[k] ||= []).push(+t.toFixed(2)); }
  heavy.push([+t.toFixed(2), shapes, lines]);
}
for (const [k, ts] of Object.entries(errs)) console.log(`ERROR ${k}\n   at t = ${ts.slice(0, 8).join(', ')}${ts.length > 8 ? ` … (${ts.length})` : ''}`);
heavy.sort((a, b) => b[1] - a[1]);
console.log('heaviest frames (t, shapes, strokes):', heavy.slice(0, 6).map(h => h.join('/')).join('  '));
console.log(`${heavy.length} frames checked, ${Object.keys(errs).length} distinct errors`);
