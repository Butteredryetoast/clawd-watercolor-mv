#!/usr/bin/env python3
"""Audio/timeline check image: waveform + onset strength of a time range, with shot cuts, lyric spans
(red = high-priority re-listen), key action times and estimated beats overlaid.

  python3 tools/sync_check.py [--range=22.72:35.49] [--out=out/check/sync.png] [--marks=25.55:手表脱手,...]

Needs ffmpeg, numpy and Pillow. Reads src/lyrics.js, src/shotlist.js and src/config.js.
"""
import sys, re, json, subprocess, pathlib
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
args = dict(a.lstrip('-').split('=', 1) for a in sys.argv[1:] if '=' in a)
cfg_txt = (ROOT / 'src/config.js').read_text('utf-8')
num = lambda key: float(re.search(key + r'\s*:\s*([\d.]+)', cfg_txt).group(1))
a, b = map(float, args.get('range', f"{num('start')}:{num('end')}").split(':'))
out = ROOT / args.get('out', f'out/check/sync_{a}_{b}.png')
audio = re.search(r"audio:\s*'([^']+)'", cfg_txt).group(1)
bpm, off = num('bpm'), num('offset')

sr = 8000
raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(a), '-t', str(b - a), '-i', str(ROOT / audio), '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'],
                     capture_output=True, check=True).stdout
x = np.frombuffer(raw, np.float32)
LY = [json.loads('[' + m.group(1) + ']') for m in re.finditer(r'^\s*\[([\d.]+, [\d.]+, ".*?", \d+, "\w+", \w+)(?:, .*)?\],', (ROOT / 'src/lyrics.js').read_text('utf-8'), re.M)]
SH = [json.loads(l.strip().rstrip(',')) for l in (ROOT / 'src/shotlist.js').read_text('utf-8').splitlines() if l.strip().startswith('{')]
marks = [(float(m.split(':')[0]), m.split(':', 1)[1]) for m in args.get('marks', '').split(',') if ':' in m]

Wd, Hd, L, R = 1800, 520, 60, 40
img = Image.new('RGB', (Wd, Hd), '#F3EBDC'); d = ImageDraw.Draw(img)
fonts = ['/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', '/System/Library/Fonts/PingFang.ttc']
font = next((ImageFont.truetype(f, 15) for f in fonts if pathlib.Path(f).exists()), ImageFont.load_default())
X = lambda t: L + (t - a) / (b - a) * (Wd - L - R)
# waveform (peak envelope) and onset strength
cols = Wd - L - R; env = [np.abs(x[int(i * len(x) / cols):int((i + 1) * len(x) / cols) or 1]).max() if len(x) else 0 for i in range(cols)]
pk = max(env) or 1
for i, e in enumerate(env): h = e / pk * 90; d.line([(L + i, 150 - h), (L + i, 150 + h)], fill='#8E7E70')
hop = 80; fr = np.lib.stride_tricks.sliding_window_view(x, 256)[::hop]
S = np.log1p(np.abs(np.fft.rfft(fr * np.hanning(256), axis=1)) * 10); fl = np.maximum(0, np.diff(S, axis=0)).sum(1)
fl = fl / (fl.max() or 1); pts = [(X(a + (i + 1) * hop / sr), 330 - v * 70) for i, v in enumerate(fl)]
d.line(pts, fill='#3A9C98', width=1); d.text((8, 255), '起音', fill='#3A9C98', font=font); d.text((8, 60), '波形', fill='#8E7E70', font=font)
# beats (estimate)
bt = off + np.ceil((a - off) / (60 / bpm)) * 60 / bpm
while bt < b: d.line([(X(bt), 245), (X(bt), 260)], fill='#7B5CA8'); bt += 60 / bpm
d.text((8, 240), f'拍(估{bpm:g})', fill='#7B5CA8', font=font)
# shots
for s in SH:
    if s['b'] <= a or s['a'] >= b: continue
    xa = X(max(a, s['a'])); d.line([(xa, 20), (xa, Hd - 20)], fill='#2B2233', width=2)
    d.text((xa + 4, 22), f"{s['a']:.2f} {s['chName']}", fill='#2B2233', font=font)
# lyrics
for s0, s1, txt, i, pri, need in LY:
    if s1 <= a or s0 >= b: continue
    col = '#C8324A' if pri == 'high' else '#E8AA38'
    d.rectangle([X(max(a, s0)), 380, X(min(b, s1)), 404], fill=col)
    d.text((X(max(a, s0)) + 4, 408), f'L{i} {txt}' + ('  待复听(高)' if pri == 'high' else ''), fill=col, font=font)
for k, (t, lab) in enumerate(marks):
    yy = 438 + (k % 2) * 22; d.line([(X(t), 432), (X(t), yy + 16)], fill='#D2343F', width=2); d.text((X(t) + 3, yy), lab, fill='#D2343F', font=font)
for t in np.arange(np.ceil(a), b, 1.0): d.line([(X(t), Hd - 18), (X(t), Hd - 10)], fill='#2B2233'); d.text((X(t) - 8, Hd - 34), f'{t:.0f}s', fill='#2B2233', font=font)
out.parent.mkdir(parents=True, exist_ok=True); img.save(out); print(out.relative_to(ROOT))
