// render_watch.mjs: a small render queue. Run it once in macOS Terminal (it uses this Mac's Chrome + GPU):
//   node tools/render_watch.mjs
// It watches out/jobs/ for *.job.json files ({ "args": ["--sheet=30:40:1", "--out=out/check/x.jpg"] }), runs
// `node render.mjs <args>` one job at a time, and writes <id>.log and <id>.done next to the job.
// Only render.mjs options are accepted (no shell), and every --out must stay inside out/. Ctrl+C to stop.
import { readdirSync, readFileSync, writeFileSync, renameSync, createWriteStream, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
const DIR = 'out/jobs'; mkdirSync(DIR, { recursive: true });
const OK = /^--(sheet|stills|frames|encode|sample|clip|verify|out|cols|w|workers|range|review|fps)(=[\w.:,\/-]+)?$/;
const valid = a => Array.isArray(a) && a.length < 12 && a.every(x => typeof x === 'string' && OK.test(x) && !x.includes('..') && (!x.startsWith('--out=') || x.startsWith('--out=out/')));
let busy = false;
console.log('render queue: watching', DIR, '(Ctrl+C to stop)');
setInterval(() => {
  if (busy) return;
  const f = readdirSync(DIR).filter(n => n.endsWith('.job.json')).sort()[0]; if (!f) return;
  const id = f.replace('.job.json', ''), path = `${DIR}/${f}`;
  let job; try { job = JSON.parse(readFileSync(path, 'utf8')); } catch { return; }
  renameSync(path, `${DIR}/${id}.running.json`);
  if (!valid(job.args)) { writeFileSync(`${DIR}/${id}.done`, 'rejected: invalid args'); console.log(id, 'rejected'); return; }
  busy = true; const t0 = Date.now(); console.log(new Date().toLocaleTimeString(), id, job.args.join(' '));
  const log = createWriteStream(`${DIR}/${id}.log`);
  const p = spawn(process.execPath, ['render.mjs', ...job.args]);
  p.stdout.pipe(log); p.stderr.pipe(log);
  p.on('close', c => { writeFileSync(`${DIR}/${id}.done`, `exit ${c} in ${((Date.now() - t0) / 1000).toFixed(0)} s`); console.log(id, 'exit', c, `${((Date.now() - t0) / 1000).toFixed(0)} s`); busy = false; });
}, 1000);
