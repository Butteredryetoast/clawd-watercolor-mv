// beat.mjs: estimate tempo and beat phase from the song (no Python / numpy needed; only ffmpeg).
//   node tools/beat.mjs [--audio=assets/song.mp3] [--min=60] [--max=180] [--segments=4]
// Method: spectral-flux onset strength (10 ms hop) → autocorrelation over 60–180 BPM → for the best candidates a
// fine scan of BPM (0.01) × phase (0.01 s) maximising the onset sum at the beat grid → the same phase scan per segment,
// to spot tempo drift. Half / double tempo are both reported: choose by ear and by the storyboard. NOT human verified.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const CONFIG = require('../src/config.js');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const SR = 11025, HOP = 110, N = 512, FPS = SR / HOP;           // ~100 onset frames per second
const audio = args.audio || CONFIG.audio, bmin = +(args.min || 60), bmax = +(args.max || 180), nseg = +(args.segments || 4);

const pcm = spawnSync('ffmpeg', ['-v', 'error', '-i', audio, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 }).stdout;
const x = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length >> 2);
console.log(`${audio}: ${(x.length / SR).toFixed(2)} s`);

// ---- onset strength: half-wave rectified log-magnitude spectral flux ----
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) {
      const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
      re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
      const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } }
  }
}
const win = Float32Array.from({ length: N }, (_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / N));
const nF = Math.floor((x.length - N) / HOP), on = new Float32Array(nF);
let prev = new Float32Array(N / 2);
for (let f = 0; f < nF; f++) {
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = x[f * HOP + i] * win[i];
  fft(re, im);
  let s = 0; const cur = new Float32Array(N / 2);
  for (let k = 1; k < N / 2; k++) { cur[k] = Math.log1p(100 * Math.hypot(re[k], im[k])); s += Math.max(0, cur[k] - prev[k]); }
  on[f] = s; prev = cur;
}
// remove the slow loudness trend (1 s moving mean), keep positive part
const o = new Float32Array(nF); { let acc = 0; const w = Math.round(FPS); for (let f = 0; f < nF; f++) { acc += on[f]; if (f >= w) acc -= on[f - w]; o[f] = Math.max(0, on[f] - acc / Math.min(f + 1, w)); } }
const at = t => { const p = t * FPS, i = Math.floor(p), k = p - i; return i < 0 || i + 1 >= nF ? 0 : o[i] * (1 - k) + o[i + 1] * k; };

// ---- coarse: autocorrelation over the tempo range ----
const cand = [];
for (let bpm = bmin; bpm <= bmax; bpm += .5) {
  const lag = 60 / bpm * FPS; let s = 0; for (let f = 0; f + lag + 1 < nF; f += 2) s += o[f] * at((f + lag) / FPS);
  cand.push([bpm, s]);
}
const peaks = cand.filter(([, s], i) => i > 0 && i < cand.length - 1 && s >= cand[i - 1][1] && s >= cand[i + 1][1]).sort((a, b) => b[1] - a[1]).slice(0, 4);

// ---- fine: BPM 0.01 × phase 0.01 s, score = mean onset strength on the grid ----
function gridScore(bpm, ph, t0 = 0, t1 = x.length / SR) { const P = 60 / bpm; let s = 0, n = 0; for (let t = ph + Math.ceil((t0 - ph) / P) * P; t < t1; t += P) { s += at(t); n++; } return n ? s / n : 0; }
function bestPhase(bpm, t0, t1) { let best = [0, -1]; for (let ph = 0; ph < 60 / bpm; ph += .01) { const s = gridScore(bpm, ph, t0, t1); if (s > best[1]) best = [ph, s]; } return best; }
const fine = peaks.map(([b0]) => { let best = [b0, 0, -1]; for (let bpm = b0 - .6; bpm <= b0 + .6; bpm += .01) { const [ph, s] = bestPhase(bpm); if (s > best[2]) best = [bpm, ph, s]; } return best; })
  .sort((a, b) => b[2] - a[2]);
const meanO = o.reduce((a, b) => a + b, 0) / nF;
console.log('candidates (BPM, offset s, grid strength / mean):');
for (const [bpm, ph, s] of fine) console.log(`  ${bpm.toFixed(2).padStart(7)}  ${ph.toFixed(2).padStart(5)}  ${(s / meanO).toFixed(2)}`);
const [B, PH] = fine[0], dur = x.length / SR;
console.log(`\nper-segment phase at ${B.toFixed(2)} BPM (same value everywhere = steady tempo; drifting = use CONFIG.beat.map):`);
for (let i = 0; i < nseg; i++) { const t0 = dur * i / nseg, t1 = dur * (i + 1) / nseg, [ph, s] = bestPhase(B, t0, t1); console.log(`  ${t0.toFixed(0).padStart(4)}–${t1.toFixed(0).padEnd(4)} s  phase ${ph.toFixed(2)}  strength ${(s / meanO).toFixed(2)}`); }
console.log(`\nCONFIG.beat = { bpm: ${B.toFixed(2)}, offset: ${PH.toFixed(2)}, verified: false }   // beat = ${(60 / B).toFixed(4)} s, bar(4) = ${(240 / B).toFixed(3)} s`);
