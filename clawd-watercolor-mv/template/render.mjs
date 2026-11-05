// render.mjs: drive studio.html in headless Chrome. Reused from PDoomVideo; song, length, fps and Chrome paths now
// come from src/config.js, with macOS defaults, a time-range encode and a statelessness check added.
//
//   node render.mjs --sheet=23,23.5,24 [--cols=3] [--w=640] --out=out/check.jpg   检查拼图（指定时间点）
//   node render.mjs --sheet=22.72:35.49:0.5 --out=out/check.jpg                   检查拼图（区间:步长）
//   node render.mjs --stills=24.8,30.5 --out=out/stills                           全分辨率静帧 PNG
//   node render.mjs --clip=22.72:35.49 --out=out/clip.mp4                         直接出带原曲的短片（单页顺序渲染）
//   node render.mjs --frames=22.72:35.49 --workers=2                              逐帧 JPEG → out/frames（可断点续渲）
//   node render.mjs --encode [--range=22.72:35.49] [--out=out/x.mp4]              逐帧 + 原曲 → MP4（音频按区间对齐）
//   node render.mjs --sample [--workers=2]                                        样片：逐帧 + 编码 + 检查拼图
//   node render.mjs --verify=24,30.2,33                                           无状态检查：乱序重渲同一帧须逐像素一致
//   node render.mjs --cover=43,34 [--out=out/cover]                               封面静帧（src/cover.js 的 COVERS）：PNG + JPG
// Common flags: --chrome=<path>  --review (burn lyric review marks into stills/frames)  --fps=24
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const CONFIG = require('./src/config.js');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const DUR = CONFIG.duration, fps = +(args.fps || CONFIG.fps), AUDIO = CONFIG.audio;
const FRAMES_DIR = 'out/frames';
const fname = i => `${FRAMES_DIR}/f${String(i).padStart(5, '0')}.jpg`;
const run = (cmd, a) => new Promise((ok, bad) => { const p = spawn(cmd, a, { stdio: 'inherit' }); p.on('close', c => c ? bad(new Error(cmd + ' exited ' + c)) : ok()); });
const range = s => String(s).split(':').map(Number);

// ---------- encode (no browser needed) ----------
async function encode(a = 0, b = DUR, out = `out/${CONFIG.slug}.mp4`) {
  const first = Math.round(a * fps), last = Math.min(Math.ceil(DUR * fps) - 1, Math.round(b * fps) - 1), n = last - first + 1;
  const missing = []; for (let i = first; i <= last; i++) if (!existsSync(fname(i))) missing.push(i);
  if (missing.length) throw new Error(`${missing.length} frames missing in ${FRAMES_DIR} (first: ${missing[0]}); run --frames=${a}:${b} first`);
  mkdirSync(dirname(out), { recursive: true });
  console.log(`encoding ${n} frames (${(first / fps).toFixed(3)}–${((last + 1) / fps).toFixed(3)} s) + ${AUDIO} → ${out}`);
  // -ss/-t on the audio input cut the song to exactly the frames' time span, so frame i always meets audio time i/fps.
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-stats', '-framerate', String(fps), '-start_number', String(first), '-i', `${FRAMES_DIR}/f%05d.jpg`,
    '-ss', (first / fps).toFixed(4), '-t', (n / fps).toFixed(4), '-i', AUDIO,
    '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart', out]);
  console.log('wrote ' + out);
}
if (args.encode) { const [a, b] = args.range ? range(args.range) : [0, DUR]; await encode(a, b, args.out || (args.range ? `out/clip_${a}_${b}.mp4` : `out/${CONFIG.slug}.mp4`)); process.exit(0); }

// ---------- browser ----------
function findChrome() {
  const list = [args.chrome, process.env.CHROME_PATH, ...(CONFIG.chrome[process.platform] || [])].filter(Boolean);
  return list.find(p => existsSync(p));
}
const GPU_ARGS = { darwin: ['--use-angle=metal'], win32: ['--use-angle=d3d11'], linux: ['--use-gl=angle', '--use-angle=gl-egl'] };   // linux/cloud: Mesa llvmpipe (≈4× faster than SwiftShader)
const LAUNCH_ARGS = ['--allow-file-access-from-files', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--window-size=1920,1080',
  '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--autoplay-policy=no-user-gesture-required', ...(GPU_ARGS[process.platform] || [])];
let browser, kind;
async function launch() {
  const chrome = findChrome();
  let pptr = null; try { pptr = require('puppeteer-core'); } catch {}
  if (pptr && chrome) {
    kind = 'puppeteer'; browser = await pptr.launch({ executablePath: chrome, headless: true, protocolTimeout: 0, args: LAUNCH_ARGS });
    console.log('Chrome:', chrome);
  } else {
    // Fallback (cloud/CI): Playwright's bundled Chromium. On macOS, install Chrome or pass --chrome=<path> instead.
    let pw; try { pw = require('playwright'); } catch { throw new Error('No Chrome found. Pass --chrome=<path> (macOS default: ' + CONFIG.chrome.darwin[0] + ') and run npm install.'); }
    kind = 'playwright'; browser = await pw.chromium.launch({ executablePath: chrome, headless: true, args: LAUNCH_ARGS });
    console.log('Chromium (playwright):', chrome || 'bundled');
  }
}
await launch();
let relaunching = null;
const browserAlive = () => kind === 'puppeteer' ? browser.connected ?? browser.isConnected() : browser.isConnected();
async function ensureBrowser() {                                   // relaunch Chrome once if it died (shared by all workers)
  if (browserAlive()) return;
  if (!relaunching) relaunching = (async () => { console.log('Chrome went away — relaunching'); try { await browser.close(); } catch {} await launch(); })().finally(() => { relaunching = null; });
  await relaunching;
}
async function openPage(tag = '', extra = '') {
  const page = await browser.newPage();
  page.on('console', m => { if (['error', 'warn', 'warning'].includes(m.type())) console.log(`[page${tag}]`, m.text()); });
  page.on('pageerror', e => console.log(`[page error${tag}]`, e.message));
  const q = '?render' + (args.review || args.sheet ? '&review' : '') + extra;
  await page.goto(pathToFileURL(resolve('studio.html')).href + q, { waitUntil: 'load', timeout: 0 });
  await (kind === 'puppeteer' ? page.waitForFunction('window.ready === true', { timeout: 60000 }) : page.waitForFunction('window.ready === true', null, { timeout: 60000 }));
  if (args.loop) await page.evaluate(name => { window.LOOP = LOOPS[name]; }, args.loop);
  return page;
}
const frameOf = async (page, t, type = 'image/png', q = .92) => {
  const url = await page.evaluate(o => window.renderAt(o.t, o.type, o.q), { t, type, q });
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
};
const times = s => String(s).includes(':') ? (([a, b, st]) => { const o = []; for (let x = a; x < b - 1e-6; x += st || .5) o.push(+x.toFixed(3)); return o; })(range(s)) : String(s).split(',').map(Number);

async function sheet(ts, out) {
  const page = await openPage(); mkdirSync(dirname(out), { recursive: true });
  const { url, ms } = await page.evaluate(o => window.renderSheet(o.ts, o.c, o.w), { ts, c: +(args.cols || 4), w: +(args.w || 480) });
  writeFileSync(out, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
  console.log(`${out}  ms/frame: ${ms.join(' ')}`); await page.close();
}
async function frames(a, b, workers = +(args.workers || 2)) {
  mkdirSync(FRAMES_DIR, { recursive: true });
  const first = Math.round(a * fps), last = Math.min(Math.ceil(DUR * fps) - 1, Math.round(b * fps) - 1);
  const todo = []; for (let i = first; i <= last; i++) { const f = fname(i); if (!existsSync(f) || statSync(f).size < 1000) todo.push(i); }
  console.log(`${todo.length} frames to render (${last - first + 1 - todo.length} already done), ${workers} workers`);
  let next = 0, done = 0; const start = Date.now();
  // Long runs: a tab (or Chrome itself) can crash after thousands of frames. Each worker recycles its tab every
  // 300 frames, and on any error reopens the tab (relaunching Chrome if needed) and retries the same frame.
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    let page = await openPage('#' + w), count = 0;
    while (next < todo.length) {
      const i = todo[next++], f = fname(i);
      let buf = null;
      for (let attempt = 0; attempt < 4 && !buf; attempt++) {
        try {
          if (count > 0 && count % 300 === 0 && attempt === 0) { try { await page.close(); } catch {} page = await openPage('#' + w); }
          buf = await frameOf(page, i / fps, 'image/jpeg', .94);
        } catch (e) {
          console.log(`worker ${w}: frame ${i} failed (${e.message.split('\n')[0]}), retrying`);
          try { await page.close(); } catch {}
          await ensureBrowser(); page = await openPage('#' + w);
        }
      }
      if (!buf) throw new Error(`frame ${i} failed 4 times`);
      count++;
      writeFileSync(f + '.tmp', buf); renameSync(f + '.tmp', f);
      if (++done % 24 === 0 || done === todo.length) {
        const el = (Date.now() - start) / 1000;
        console.log(`frame ${done}/${todo.length}  ${(el / done * 1000).toFixed(0)} ms/frame effective  eta ${((todo.length - done) * el / done / 60).toFixed(1)} min`);
      }
    }
    await page.close();
  }));
}

if (args.sheet) await sheet(times(args.sheet), args.out || 'out/sheet.jpg');
else if (args.stills) {
  const page = await openPage(), out = args.out || 'out/stills'; mkdirSync(out, { recursive: true });
  console.log('GPU:', await page.evaluate(() => window.gpuInfo()));
  for (const s of times(args.stills)) {
    const t0 = Date.now(), buf = await frameOf(page, s, 'image/png'), f = `${out}/t${s.toFixed(2).replace('.', '_')}.png`;
    writeFileSync(f, buf); console.log(`${f}  ${Date.now() - t0} ms`);
  }
} else if (args.cover) {
  // Covers: each key opens a page with ?cover=<key> (src/cover.js resizes the canvas and paints that cover).
  const out = args.out || 'out/cover'; mkdirSync(out, { recursive: true });
  for (const key of String(args.cover).split(',')) {
    const page = await openPage('#' + key, '&cover=' + key), t0 = Date.now();
    const png = await frameOf(page, 0, 'image/png'), jpg = await frameOf(page, 0, 'image/jpeg', .95);
    writeFileSync(`${out}/cover_${key}.png`, png); writeFileSync(`${out}/cover_${key}.jpg`, jpg);
    console.log(`${out}/cover_${key}.png / .jpg  ${Date.now() - t0} ms`); await page.close();
  }
} else if (args.verify) {
  // Every frame must be a pure function of t: render the list forwards in one page and backwards in a fresh page
  // (with other times interleaved), then compare pixel hashes.
  const ts = times(args.verify), h = b => createHash('sha1').update(b).digest('hex').slice(0, 12);
  const p1 = await openPage('#a'), A = {}; for (const t of ts) A[t] = h(await frameOf(p1, t));
  const p2 = await openPage('#b'), B = {}; for (const t of [...ts].reverse()) { await frameOf(p2, Math.max(0, t - 1.37)); B[t] = h(await frameOf(p2, t)); }
  let ok = true; for (const t of ts) { const same = A[t] === B[t]; ok &&= same; console.log(`${t.toFixed(3)} s  ${A[t]}  ${B[t]}  ${same ? 'OK' : 'DIFFERENT'}`); }
  console.log(ok ? 'stateless: all frames identical' : 'stateless check FAILED'); if (!ok) process.exitCode = 1;
} else if (args.loop) {
  const out = args.out || `out/loop_${args.loop}`, workers = +(args.workers || 2); mkdirSync(out, { recursive: true });
  const probe = await openPage(), len = await probe.evaluate(() => window.LOOP.len), n = Math.round(len * fps); await probe.close();
  let next = 0; await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const page = await openPage('#' + w);
    while (next < n) { const i = next++; writeFileSync(`${out}/l${String(i).padStart(3, '0')}.png`, await frameOf(page, i / fps)); }
  }));
} else if (args.frames) { const [a, b] = range(args.frames); await frames(a, b); }
else if (args.sample) {
  const { start: a, end: b, name } = CONFIG.sample;
  await frames(a, b);
  await browser.close(); browser = null;
  await encode(a, b, args.out || `out/${name}.mp4`);
  process.exit(0);
} else {
  const page = await openPage();
  const [a, b] = args.clip ? range(args.clip) : [0, DUR];
  const out = args.out || 'out/clip.mp4'; mkdirSync(dirname(out), { recursive: true });
  const n = Math.round((b - a) * fps);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-ss', String(a), '-t', (n / fps).toFixed(4), '-i', AUDIO,
    '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', out],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const start = Date.now();
  for (let i = 0; i < n; i++) {
    const buf = await frameOf(page, a + i / fps, 'image/jpeg', .92);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 24 === 0 || i === n - 1) console.log(`frame ${i + 1}/${n}  ${((Date.now() - start) / (i + 1)).toFixed(0)} ms/frame`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  console.log(`wrote ${out}`);
}
if (browser) await browser.close();
