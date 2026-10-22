"""Spot-check generated audio with speech recognition (faster-whisper) and, for Mandarin,
compare the pinyin of what was heard with the pack's pinyin.
Usage: /home/box/piper-venv/bin/python scripts/audio/qa.py [packs...]  (N words + N sentences per pack)"""
import json, os, sys, random, struct, subprocess, difflib, re, unicodedata, collections
import numpy as np
from faster_whisper import WhisperModel
N = int(os.environ.get('QA_N', '30'))
plan = json.load(open('data/audio/plan.json'))
model = WhisperModel(os.environ.get('QA_MODEL', 'small'), device='cpu', compute_type='int8')
LANG = {'zh': 'zh', 'es': 'es', 'en': 'en', 'fr': 'fr', 'it': 'it', 'pt': 'pt', 'de': 'de'}

def clips_of(path):
    b = open(path, 'rb').read(); n = struct.unpack('<I', b[4:8])[0]; idx = json.loads(b[8:8 + n]); base = 8 + n
    return {t: b[base + o: base + o + l] for t, (o, l) in idx.items()}

def pcm(mp3):
    out = subprocess.run(['ffmpeg', '-v', 'error', '-i', '-', '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], input=mp3, capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype=np.float32)

def norm(s):
    s = unicodedata.normalize('NFKC', s).lower()
    return re.sub(r'[^\w]', '', s)

def tone_syls(text):
    from pypinyin import lazy_pinyin, Style
    return [p for p in lazy_pinyin(text, style=Style.TONE3, neutral_tone_with_five=True) if re.match(r'^[a-zü]+[1-5]$', p)]

report = {}
for pk in sys.argv[1:] or list(plan['packs']):
    P = plan['packs'][pk]; random.seed(7)
    credits = json.load(open('data/audio/credits.json')).get(pk, {})
    llwords = set(credits.get('words', {}))
    owners = [o for o in P['bundles'] if os.path.exists('src' + P['bundles'][o]['file'])]
    words, sents = [], []
    for o in random.sample(owners, min(len(owners), 400)):
        b = P['bundles'][o]
        for c in b['clips']:
            (words if c['k'] == 'w' else sents).append((c, b['file']))
    random.shuffle(words); random.shuffle(sents)
    stats = collections.Counter(); bad = []
    for kind, lst in (('w', words[:N]), ('s', sents[:N])):
        for c, f in lst:
            mp3 = clips_of('src' + f).get(c['t'])
            if not mp3: stats['missing'] += 1; continue
            segs, _ = model.transcribe(pcm(mp3), language=LANG[pk], beam_size=5, condition_on_previous_text=False,
                                       initial_prompt=('以下是普通话。' if pk == 'zh' else None), without_timestamps=True)
            heard = ''.join(s.text for s in segs).strip()
            r = difflib.SequenceMatcher(None, norm(heard), norm(c['t'])).ratio()
            src = 'll' if kind == 'w' and c['t'] in llwords else 'tts'
            stats[f'{kind}_{src}_n'] += 1; stats[f'{kind}_{src}_sim'] += r
            if r >= 0.8: stats[f'{kind}_{src}_ok'] += 1
            if pk == 'zh':
                exp = c.get('syl') or tone_syls(c['t']); got = tone_syls(heard)
                if kind == 'w':
                    stats['zh_w_tone_n'] += 1
                    if [s.replace('ü', 'v') for s in got] == [s.replace('ü', 'v') for s in exp]: stats['zh_w_tone_ok'] += 1
                    elif [s[:-1] for s in got] == [s[:-1] for s in exp]: stats['zh_w_tone_neutral_or_tone_diff'] += 1
            if r < 0.8: bad.append(f'{kind}/{src}: "{c["t"]}" heard "{heard}"')
    report[pk] = {k: (round(v, 2) if isinstance(v, float) else v) for k, v in stats.items()}
    print(pk, json.dumps(report[pk]), flush=True)
    for x in bad[:12]: print('   ', x)
json.dump(report, open('/home/box/tts/qa.json', 'w'), indent=1)
