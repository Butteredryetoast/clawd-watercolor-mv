// finish.mjs: everything after `node render.mjs --encode`: check the MP4, make the overview sheet, the 720p share copy,
// and copy the deliverables to the Desktop (never overwriting). Needs only ffmpeg / ffprobe.
//   node tools/finish.mjs [--in=out/<slug>.mp4] [--desk="<folder>"] [--name=<file prefix>] [--no-copy]
// 1. ffprobe: frame count, duration, streams.
// 2. audio offset: cross-correlate the MP4's audio against CONFIG.audio at 10 % / 50 % / 90 % of the song (must be 0 ms).
// 3. overview: one frame every 4 s, 8 per row → out/check/full_overview.jpg (+ full_half0/1.jpg, larger, for Read).
// 4. 720p: -preset veryfast -crf 25 -vf scale=1280:-2 → out/<slug>_720p.mp4.
// 5. desktop: ~/Desktop/MV制作/<artist> - <title>/ (or --desk). The user tidies folders: an existing folder of that name
//    under ~/Desktop/MV制作 or ~/Desktop is found and reused; files already there are never overwritten (cp -n).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, copyFileSync, constants, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const CONFIG = require('../src/config.js');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const IN = args.in || `out/${CONFIG.slug}.mp4`, OUT720 = IN.replace(/\.mp4$/, '_720p.mp4'), fps = CONFIG.fps;
const sh = (cmd, a, o = {}) => { const r = spawnSync(cmd, a, { maxBuffer: 1 << 30, ...o }); if (r.status) throw new Error(`${cmd} failed: ${r.stderr}`); return r.stdout; };
const ok = [], warn = [];

// 1. probe
const probe = JSON.parse(sh('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'stream=codec_type,width,height,nb_read_frames,duration:format=duration,size', '-of', 'json', IN]));
const v = probe.streams.find(s => s.codec_type === 'video'), au = probe.streams.find(s => s.codec_type === 'audio');
const want = Math.ceil(CONFIG.duration * fps);
console.log(`${IN}: ${v.width}×${v.height}, ${v.nb_read_frames} frames (${(+v.duration).toFixed(3)} s), audio ${au ? (+au.duration).toFixed(3) + ' s' : 'MISSING'}, ${(probe.format.size / 1048576).toFixed(0)} MB`);
(Math.abs(v.nb_read_frames - want) <= 1 && au ? ok : warn).push(`frames ${v.nb_read_frames} / expected ${want}${au ? '' : ', NO AUDIO'}`);

// 2. audio offset
const pcm = f => { const b = sh('ffmpeg', ['-v', 'error', '-i', f, '-vn', '-ac', '1', '-ar', '8000', '-f', 's16le', '-']); return new Int16Array(b.buffer, b.byteOffset, b.length >> 1); };
const A = pcm(IN), B = pcm(CONFIG.audio), sr = 8000;
for (const f of [.1, .5, .9]) {
  const i = Math.round(CONFIG.duration * f * sr), w = 4 * sr, m = Math.round(.3 * sr); let best = [0, -2], nx = 0;
  for (let k = 0; k < w; k++) nx += A[i + k] ** 2;
  for (let lag = -m; lag <= m; lag++) { let d = 0, ny = 0; for (let k = 0; k < w; k++) { const y = B[i + lag + k] || 0; d += A[i + k] * y; ny += y * y; } const c = d / Math.sqrt(nx * ny + 1e-9); if (c > best[1]) best = [lag, c]; }
  const msg = `audio offset at ${(i / sr).toFixed(1)} s: ${(best[0] / sr * 1000).toFixed(1)} ms (corr ${best[1].toFixed(4)})`;
  console.log(msg); (best[0] === 0 && best[1] > .95 ? ok : warn).push(msg);
}

// 3. overview (from out/frames when complete, else decoded from the MP4)
mkdirSync('out/check', { recursive: true });
const step = 4 * fps, n = Math.ceil(want / step), useFrames = existsSync('out/frames') && readdirSync('out/frames').length >= want;
const src = useFrames ? ['-framerate', String(fps), '-i', 'out/frames/f%05d.jpg'] : ['-i', IN];
const tile = (from, count, cols, w, out) => sh('ffmpeg', ['-v', 'error', '-y', ...(useFrames ? ['-framerate', String(fps), '-start_number', String(from), '-i', 'out/frames/f%05d.jpg'] : ['-ss', String(from / fps), '-i', IN]),
  '-vf', `select='not(mod(n\\,${step}))',scale=${w}:-1,tile=${cols}x${Math.ceil(count / cols)}:padding=4:color=white`, '-fps_mode', 'vfr', '-frames:v', '1', out]);
tile(0, n, 8, 320, 'out/check/full_overview.jpg');
const half = Math.ceil(n / 2) * step;
tile(0, Math.ceil(n / 2), 8, 400, 'out/check/full_half0.jpg'); tile(half, n - Math.ceil(n / 2), 8, 400, 'out/check/full_half1.jpg');
console.log(`overview: out/check/full_overview.jpg (${n} tiles, every 4 s, left→right, top→bottom; from ${useFrames ? 'frames' : 'the MP4'}) + full_half0/1.jpg`);

// 4. 720p
sh('ffmpeg', ['-v', 'error', '-y', '-i', IN, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '25', '-vf', 'scale=1280:-2', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', OUT720]);
console.log(`720p: ${OUT720} (${(statSync(OUT720).size / 1048576).toFixed(0)} MB)`);

// 5. desktop copy
if (!args['no-copy']) {
  const folder = `${CONFIG.artist} - ${CONFIG.title}`, D = join(homedir(), 'Desktop');
  const dest = args.desk || [join(D, 'MV制作', folder), join(D, folder)].find(existsSync) || join(D, 'MV制作', folder);
  mkdirSync(dest, { recursive: true });
  const pre = args.name || `${CONFIG.title}_Clawd_MV`;
  for (const [from, to] of [[IN, `${pre}_1080p.mp4`], [OUT720, `${pre}_720p.mp4`], ['out/check/full_overview.jpg', `${CONFIG.title}_全片总览_每4秒.jpg`]]) {
    try { copyFileSync(from, join(dest, to), constants.COPYFILE_EXCL); console.log(`copied → ${join(dest, to)}`); }
    catch (e) { if (e.code === 'EEXIST') warn.push(`not overwritten (already there): ${join(dest, to)}`); else throw e; }
  }
}
console.log(`\nOK:\n  ${ok.join('\n  ')}${warn.length ? `\nCHECK:\n  ${warn.join('\n  ')}` : ''}`);
