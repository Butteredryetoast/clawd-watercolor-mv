#!/usr/bin/env python3
"""Machine-estimate lyric END times (and check the LRC starts) by forced alignment with mlx-whisper small.
Use it when only an LRC exists (after tools/lrc_to_json.py); a lyric JSON that is already machine-aligned does not need it.

  <venv>/bin/python tools/align_lyrics.py [--json=assets/x-歌词时间线-LRC版.json] [--audio=assets/song.mp3] [--lang=zh]

Needs a Python with mlx-whisper (Apple silicon), e.g. the existing work/audio-venv. The first run downloads
mlx-community/whisper-small-mlx (~480 MB) into HF_HOME (default ~/.cache/huggingface): ask the user before that.
NOTE: generalised from ChiBi/tools/align_lines.py and work/forced_alignment.py (both used in practice); this exact
script has not been run yet. Check its output against a few lines by ear before trusting it.

Per line: crop [LRC start - 0.4, min(next LRC start + 0.2, start + 29)] s, align the line's text in it, take the first and
last Han (or word) token. Starts stay the LRC starts; end_seconds = aligned end (≤ next start - 0.05).
review_priority "high" when: alignment probability < 0.45, |aligned start - LRC start| > 0.6 s, or the end hits the crop edge.
Writes the JSON back in place (a .bak copy is kept) with end_source = "audio_alignment_estimate".
"""
import os, sys, re, json, shutil, pathlib
args = dict(a.lstrip('-').split('=', 1) for a in sys.argv[1:] if '=' in a)
ROOT = pathlib.Path(__file__).resolve().parent.parent
os.environ.setdefault('HF_HUB_DISABLE_XET', '1')
import mlx.core as mx
from mlx_whisper.load_models import load_model
from mlx_whisper.audio import load_audio, pad_or_trim, log_mel_spectrogram
from mlx_whisper.timing import find_alignment
from mlx_whisper.tokenizer import get_tokenizer

cfg = (ROOT / 'src/config.js').read_text('utf-8')
JSON = ROOT / args['json'] if 'json' in args else next(iter(sorted((ROOT / 'assets').glob('*.json'))))
AUDIO = ROOT / args.get('audio', re.search(r"audio:\s*'([^']+)'", cfg).group(1))
doc = json.loads(JSON.read_text('utf-8')); L = doc['lyrics']
model = load_model('mlx-community/whisper-small-mlx', dtype=mx.float16)
tok = get_tokenizer(model.is_multilingual, num_languages=model.num_languages, language=args.get('lang', 'zh'), task='transcribe')
audio = load_audio(str(AUDIO)); total = len(audio) / 16000
word = lambda s: re.search(r'[一-鿿]|[A-Za-z0-9]', s)

for i, l in enumerate(L):
    nxt = L[i + 1]['start_seconds'] if i + 1 < len(L) else total
    a = max(0.0, l['start_seconds'] - .4); b = min(total, nxt + .2, l['start_seconds'] + 29)
    seg = audio[round(a * 16000):round(b * 16000)]
    mel = log_mel_spectrogram(pad_or_trim(seg), n_mels=model.dims.n_mels)
    tokens = tok.encode(l['text'])
    ws = [w for w in find_alignment(model, tok, tokens, mel, int(len(seg) / 160), medfilt_width=7) if word(w.word)]
    mx.clear_cache()
    if not ws: l['review_priority'] = 'high'; l['needs_audio_review'] = True; l['note'] = 'alignment found no words'; continue
    s0, e0, p = float(ws[0].start) + a, float(ws[-1].end) + a, sum(float(w.probability) for w in ws) / len(ws)
    end = round(min(e0, nxt - .05), 2)
    flags = [f for f, bad in [('low probability', p < .45), ('start differs from LRC', abs(s0 - l['start_seconds']) > .6), ('end at crop edge', e0 > b - .15)] if bad]
    l.update({'end_seconds': end, 'duration_seconds': round(end - l['start_seconds'], 2), 'end_source': 'audio_alignment_estimate',
              'alignment': {'start': round(s0, 2), 'end': round(e0, 2), 'probability': round(p, 3)},
              'needs_audio_review': bool(flags) or l.get('needs_audio_review', True), 'review_priority': 'high' if flags else 'normal'})
    if flags: l['note'] = '; '.join(flags)
    print(f"L{l['id']:<3} {l['start_seconds']:7.2f}–{end:7.2f}  p {p:.2f}  {'⚠ ' + ', '.join(flags) if flags else ''}  {l['text']}")
doc['status'] = 'automatically_aligned_not_manually_reviewed'
shutil.copy(JSON, str(JSON) + '.bak')
JSON.write_text(json.dumps(doc, ensure_ascii=False, indent=2), 'utf-8')
print(f"{JSON.relative_to(ROOT)}: high priority {[l['id'] for l in L if l['review_priority'] == 'high']}")
