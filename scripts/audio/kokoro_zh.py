"""Pre-synthesize Mandarin clips with Kokoro-82M v1.1-zh (Apache-2.0), voice zf_002.
Words: phonemes come from the pack's own pinyin (HSK readings), then standard tone sandhi
(3rd-tone, 一, 不) via misaki/PaddleSpeech ToneSandhi; neutral tones and erhua from the pack.
Sentences: misaki's frontend (jieba + pypinyin + ToneSandhi) with multi-character pack words
forced to their dictionary pinyin and 和 forced to he2.
Output: $AUDIO_SRC/tts/zh-kokoro/<sha1(KV|kind|text|syl)>.wav (24 kHz). build.py reads these.
Run with the Kokoro venv: /home/box/tts2/kokoro-venv/bin/python scripts/audio/kokoro_zh.py [--test file.json outdir]"""
import json, os, re, sys, hashlib
try:
    import numpy as np, soundfile as sf, torch
    from pypinyin.contrib.tone_convert import to_initials, to_finals_tone3
except ImportError:  # build.py (Piper venv) imports this module only for key() and OUT
    pass
KV = 'kokoro-v1.1-zh-zf_002-v1'
VOICE = 'zf_002'; REPO = 'hexgrad/Kokoro-82M-v1.1-zh'
SRC = os.environ.get('AUDIO_SRC', '/home/box/audio-src')
OUT = f'{SRC}/tts/zh-kokoro'

def key(kind, text, syl): return hashlib.sha1('|'.join([KV, kind, text, ','.join(syl or [])]).encode()).hexdigest()

def init():
    from kokoro import KModel, KPipeline
    from misaki.zh_frontend import ZH_MAP
    torch.set_num_threads(int(os.environ.get('THREADS', '2')))
    model = KModel(repo_id=REPO).eval()
    pipe = KPipeline(lang_code='z', repo_id=REPO, model=model, en_callable=lambda t: '')
    return pipe, ZH_MAP

def syl_if(s):
    """'hui4' -> ('h', 'uei4'); handles nu:3, zhi/zi."""
    s = s.replace('u:', 'v').replace('ü', 'v')
    c = to_initials(s, strict=True); v = to_finals_tone3(s, strict=True, neutral_tone_with_five=True)
    if not v[-1].isdigit(): v += '5'
    if re.match(r'i\d', v):
        if c in ('z', 'c', 's'): v = 'ii' + v[1:]
        elif c in ('zh', 'ch', 'sh', 'r'): v = 'iii' + v[1:]
    return c, v

def phones_for(word, syls, tm, ZH_MAP):
    ini, fin = [], []
    for s in syls:
        if s in ('r5', 'r') and fin: fin[-1] = fin[-1][:-1] + 'R' + fin[-1][-1]; continue
        c, v = syl_if(s); ini.append(c); fin.append(v)
    chars = word if len(word) == len(fin) else (word.replace('儿', '') if len(word.replace('儿', '')) == len(fin) else None)
    if chars:  # only the rule-based sandhi (不, 一, 3rd tone); neutral tones come from the pack, never guessed
        cit = [v[-1] for v in fin]
        fin = tm._three_sandhi(chars, tm._yi_sandhi(chars, tm._bu_sandhi(chars, fin)))
        for ch, a, b in zip(chars, cit, [v[-1] for v in fin]):  # every tone change must be a known sandhi
            assert a == b or (a == '3' and b == '2') or (ch == '不' and b == '2') or (ch == '一' and b in '24'), (word, syls, fin)
    ph = []
    for c, v in zip(ini, fin):
        if c: ph.append(c)
        ph.append(v)
    ph = '_'.join(ph).replace('_eR', '_er').replace('R', '_R'); ph = re.sub(r'(?=\d)', '_', ph).split('_')
    return ''.join(ZH_MAP.get(p, '❓') for p in ph if p)

def sentence_ps(pipe, text, lex):
    fe = pipe.g2p.frontend; orig = fe.__class__._get_initials_finals
    def forced(self, word):
        if word in lex and len(lex[word]) == len(word):
            out = [('', 'er5') if s in ('r5', 'r') else syl_if(s) for s in lex[word]]; return [c for c, _ in out], [v for _, v in out]
        i, f = orig(self, word)
        f = [('e2' if ch == '和' and fv.startswith('an') and ii == 'h' else fv) for ch, ii, fv in zip(word, i, f)]
        return i, f
    fe._get_initials_finals = forced.__get__(fe)
    try: ps, _ = pipe.g2p(text)
    finally: del fe._get_initials_finals
    return ps

def synth(pipe, ps, speed):
    parts = [r.audio.numpy() for r in pipe.generate_from_tokens(ps, voice=VOICE, speed=speed) if r.audio is not None]
    return np.concatenate(parts) if parts else np.zeros(1, np.float32)

def run(items, outpath, lex):
    pipe, ZH_MAP = init(); tm = pipe.g2p.frontend.tone_modifier; n = 0
    for kind, text, syl, path in items:
        if os.path.exists(path): continue
        if kind == 'w' and syl: ps = phones_for(text, syl, tm, ZH_MAP)
        else: ps = sentence_ps(pipe, text, lex)
        a = synth(pipe, ps, 1.0)
        sf.write(path + '.tmp.wav', a, 24000); os.rename(path + '.tmp.wav', path); n += 1
        if n % 200 == 0: print(n, flush=True)
    return n

if __name__ == '__main__':
    plan = json.load(open('data/audio/plan.json')); P = plan['packs']['zh']; lex = P.get('lex') or {}
    lex = {w: s for w, s in lex.items() if len(w) > 1}
    if sys.argv[1:2] == ['--test']:
        items = [('w' if syl else 's', t, syl.split() if syl else None, f'{sys.argv[3]}/{i}.wav') for i, t, _, syl in json.load(open(sys.argv[2]))]
        os.makedirs(sys.argv[3], exist_ok=True); run(items, None, lex); sys.exit()
    native = json.load(open('data/audio/ll-zh.json')) if os.path.exists('data/audio/ll-zh.json') else {}
    uniq = {}
    for b in P['bundles'].values():
        for c in b['clips']: uniq.setdefault((c['t'], c['k']), c)
    os.makedirs(OUT, exist_ok=True)
    # every clip gets a TTS fallback (native clips can be rejected by build.py's quality filter)
    items = [(c['k'], c['t'], c.get('syl'), f"{OUT}/{key(c['k'], c['t'], c.get('syl'))}.wav") for c in uniq.values()]
    shard, nsh = (int(x) for x in os.environ.get('SHARD', '0/1').split('/'))
    items = [x for i, x in enumerate(sorted(items)) if i % nsh == shard]
    print('items', len(items), flush=True); print('done', run(items, OUT, lex))
