#!/usr/bin/env python3
"""Subset Noto Serif CJK SC (SIL OFL 1.1) to the characters the film actually paints.

  python3 tools/build_font.py [--src=/path/NotoSerifCJK-SemiBold.ttc]

Optional: by default the film uses the macOS system Kaiti (CONFIG.fonts.zh). Use this when the render machine may lack
it, or for a different look. Needs `pip install fonttools`. Run again whenever lyrics, credits or on-screen text change.
Output: assets/fonts/FilmSerif.woff; then set CONFIG.fonts.face = { family: 'Film Serif', url: 'assets/fonts/FilmSerif.woff' }
and put '"Film Serif", ' first in CONFIG.fonts.zh. Characters outside the subset fall back to PingFang SC /
Noto Sans CJK SC (see CONFIG.fonts in src/config.js), so a missing glyph never renders as tofu on macOS.
"""
import sys, re, pathlib, subprocess
ROOT = pathlib.Path(__file__).resolve().parent.parent
args = dict(a.lstrip('-').split('=', 1) for a in sys.argv[1:] if '=' in a)
SRC = args.get('src', '/usr/share/fonts/opentype/noto/NotoSerifCJK-SemiBold.ttc')
FONT_NUMBER = args.get('number', '2')  # index 2 = Noto Serif CJK SC inside the collection

chars = set()
for f in ['src/lyrics.js', 'src/config.js']:
    p = ROOT / f
    if p.exists(): chars |= set(p.read_text('utf-8'))
# fixed on-screen text from the storyboard: title, credits, the single big SFX, emote marks
chars |= set('砰！ ()-：:，。、！？…—·《》“”0123456789!?zZ')
chars |= set('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz')
chars = ''.join(sorted(c for c in chars if c.isprintable()))
out = ROOT / 'assets/fonts/FilmSerif.woff'
out.parent.mkdir(parents=True, exist_ok=True)
subprocess.run([sys.executable, '-m', 'fontTools.subset', SRC, f'--font-number={FONT_NUMBER}', f'--text={chars}',
                '--flavor=woff', '--layout-features=*', '--name-IDs=*', f'--output-file={out}'], check=True)
print(f'{out.relative_to(ROOT)}: {len(chars)} chars, {out.stat().st_size // 1024} KB')
