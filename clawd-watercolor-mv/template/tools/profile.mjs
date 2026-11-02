// profile.mjs: time renderAt(t) with chosen functions stubbed out, to find what makes a frame slow.
//   node tools/profile.mjs --t=72 --stub=pano,partyFlat,roofRow
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const CONFIG = require('../src/config.js');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const pptr = require('puppeteer-core');
const browser = await pptr.launch({ executablePath: CONFIG.chrome.darwin[0], headless: true, protocolTimeout: 0, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
const page = await browser.newPage(); await page.setViewport({ width: 1920, height: 1080 });
await page.goto(pathToFileURL(resolve('studio.html')).href + '?render', { waitUntil: 'load', timeout: 0 });
await page.waitForFunction('window.ready === true', { timeout: 0 });
const ts = String(args.t || 72).split(',').map(Number), sets = String(args.stub || '').split(';');
for (const set of [''].concat(sets.filter(Boolean))) {
  const ms = await page.evaluate(async (set, ts) => {
    const keep = {}; for (const n of set.split(',').filter(Boolean)) { keep[n] = window[n]; window[n] = () => {}; }
    await window.renderAt(ts[0]);
    const out = []; for (const t of ts) { const a = performance.now(); await window.renderAt(t); out.push(Math.round(performance.now() - a)); }
    for (const n in keep) window[n] = keep[n];
    return out;
  }, set, ts);
  console.log((set || '(none)').padEnd(40), ms.join(' '));
}
await browser.close();
