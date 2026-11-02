#!/usr/bin/env python3
"""Turn an LRC into the lyric-timeline JSON that tools/build_data.py reads (use it when no machine-aligned JSON exists).

  python3 tools/lrc_to_json.py --lrc=assets/song.lrc [--out=assets/song-歌词时间线-LRC版.json] [--dur=236.35]
                               [--title=歌名] [--artist=歌手]

Rules (nothing here is human verified):
  start_seconds = LRC time (kept as given)
  end_seconds   = estimate: min(next LRC start - 0.15, start + max(2.0, 1.2 + 0.075 * characters))
  every line needs_audio_review = true; review_priority = "high" where the gap to the next line is > 4 s
  credit lines (词：/ 曲：/ 编曲：/ 监制：…, and "歌名 - 歌手" before the first lyric) go to "credits", not "lyrics".
--dur defaults to ffprobe of CONFIG.audio. --title / --artist default to src/config.js.
"""
import sys, json, re, pathlib, subprocess
ROOT = pathlib.Path(__file__).resolve().parent.parent
args = dict(a.lstrip('-').split('=', 1) for a in sys.argv[1:] if '=' in a)
cfg = (ROOT / 'src/config.js').read_text('utf-8')
cfg_str = lambda key: (re.search(key + r":\s*'([^']*)'", cfg) or [None, ''])[1]
LRC = ROOT / args['lrc']
OUT = ROOT / args.get('out', f'assets/{LRC.stem}-歌词时间线-LRC版.json')
if 'dur' in args: DUR = float(args['dur'])
else:
    DUR = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(ROOT / cfg_str('audio'))],
                               capture_output=True, text=True, check=True).stdout)
CREDIT = re.compile(r'^(作?词|作?曲|编曲|监制|制作人?|混音|母带|录音|和声|吉他|贝斯|鼓|弦乐|出品|发行|OP|SP|Lyrics|Composer|Producer)\s*[：:]', re.I)

rows = []
for line in LRC.read_text('utf-8').splitlines():
    m = re.match(r'\[(\d+):(\d+(?:\.\d+)?)\](.*)', line.strip())
    if m and m.group(3).strip(): rows.append((int(m.group(1)) * 60 + float(m.group(2)), m.group(3).strip()))
credits, lyr = [], []
for t, txt in rows:
    if CREDIT.match(txt) or (not lyr and ' - ' in txt): credits.append({'time_seconds': round(t, 2), 'text': txt})
    else: lyr.append((t, txt))
out = []
for i, (t, txt) in enumerate(lyr):
    nxt = lyr[i + 1][0] if i + 1 < len(lyr) else DUR
    end = min(nxt - 0.15, t + max(2.0, 1.2 + 0.075 * len(txt)))
    out.append({'id': i + 1, 'text': txt, 'start_seconds': round(t, 2), 'end_seconds': round(end, 2),
                'start_source': 'lrc', 'end_source': 'next_start' if end == nxt - 0.15 else 'length_guess',
                'review_priority': 'high' if nxt - t > 4.0 else 'normal', 'needs_audio_review': True})
doc = {
    'title': args.get('title', cfg_str('title')), 'artist': args.get('artist', cfg_str('artist')), 'audio_duration_seconds': DUR,
    'status': 'lrc_only_human_review_pending',
    'method': {'steps': ['start_seconds = original LRC', 'end_seconds = min(next start - 0.15, length guess)'],
               'limits': ['no forced alignment was run', 'ends are guesses', 'not human verified']},
    'credits': credits or [{'time_seconds': 0, 'text': f"{cfg_str('title')} - {cfg_str('artist')}"}],
    'lyrics': out,
}
OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=2), 'utf-8')
print(f'{OUT.relative_to(ROOT)}: {len(out)} lines, {len(credits)} credits, duration {DUR:.3f} s, '
      f'high priority: {[l["id"] for l in out if l["review_priority"] == "high"]}')
