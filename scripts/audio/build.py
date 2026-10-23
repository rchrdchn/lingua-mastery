"""Build per-owner audio bundles from data/audio/plan.json.
Words use Lingua Libre recordings where data/audio/ll-<pack>.json has one; everything else is
synthesized with Piper. Mandarin words are synthesized from the pack's own pinyin (never guessed);
Mandarin sentences use g2pW with multi-character pack words forced to their dictionary pinyin.
Run with the Piper venv: /home/box/piper-venv/bin/python scripts/audio/build.py [packs...]
Bundle format: b'LMA1' + uint32le(len(index)) + index JSON {text: [offset, length]} + MP3 data."""
import json, os, sys, struct, hashlib, subprocess, collections, shutil, time
import numpy as np
from multiprocessing import Pool

VOICES = os.environ.get('PIPER_VOICES', '/home/box/piper-voices')
CACHE = os.environ.get('AUDIO_CACHE', '/home/box/audio-cache')
PROC_V = 'p3'  # bump to re-encode everything
VOICE = {
    'zh': ('kokoro-v1.1-zh-zf_002', 'zf_002 (Kokoro-82M v1.1-zh)', 'Apache-2.0', 'Kokoro'),  # pre-synthesized by kokoro_zh.py
    'es': ('kokoro-v1.0-em_alex', 'em_alex (Kokoro-82M v1.0)', 'Apache-2.0', 'Kokoro'),
    'en': ('kokoro-v1.0-af_heart', 'af_heart (Kokoro-82M v1.0)', 'Apache-2.0', 'Kokoro'),
    'fr': ('kokoro-v1.0-ff_siwis', 'ff_siwis (Kokoro-82M v1.0)', 'Apache-2.0', 'Kokoro'),  # tom dropped: fine-tune base undocumented
    'it': ('it_IT-serena-high', 'serena (it_IT, high)', 'CC BY 4.0 dataset'),
    'pt': ('kokoro-v1.0-pf_dora', 'pf_dora (Kokoro-82M v1.0)', 'Apache-2.0', 'Kokoro'),
    'de': ('de_DE-thorsten-high', 'Thorsten (de_DE, high)', 'CC0 dataset'),
}
SR = 22050
SRC = os.environ.get('AUDIO_SRC', '/home/box/audio-src')
def engine(pk): return VOICE[pk][3] if len(VOICE[pk]) > 3 else 'Piper'
def ext(pk): return engine(pk) != 'Piper' or (len(VOICE[pk]) > 4 and VOICE[pk][4])  # clips pre-synthesized by ext_tts.py / kokoro_zh.py
def ext_path(pk, clip):  # clips pre-synthesized by scripts/audio/ext_tts.py (non-Piper engines)
    m = VOICE[pk][0]; return f"{SRC}/tts/{m}/{hashlib.sha1('|'.join([m, clip['k'], clip['t']]).encode()).hexdigest()}.wav"
LEAD = int(0.12 * SR)   # iOS can clip the first ~100 ms of a clip
TAIL = int(0.10 * SR)

def sha(*parts): return hashlib.sha1('|'.join(map(str, parts)).encode()).hexdigest()

# ---------- worker state ----------
W = {}
def init(pk, lex):
    from piper import PiperVoice
    W['pk'] = pk; W['lex'] = lex or {}
    if ext(pk): return  # pre-synthesized in another venv (kokoro_zh.py / ext_tts.py)
    W['voice'] = PiperVoice.load(f'{VOICES}/{VOICE[pk][0]}.onnx', download_dir=VOICES)
    assert W['voice'].config.sample_rate == SR, W['voice'].config.sample_rate

def zh_phonemes(syls):
    from piper.phonemize_chinese import _split_initial_final_tone
    ph = []
    for s in syls:
        if s in ('。', '，', '？', '！', ',', '?', '!'):
            ph.append({'，': ',', '？': '?', '！': '!'}.get(s, s)); continue
        s = s.replace('ü', 'v').replace('u:', 'v')
        i, f, t = _split_initial_final_tone(s)
        if not f: continue
        ph += [i or 'Ø', f, t]
    return ph

def zh_sentence_syls(text):
    """g2pW per character, then force known multi-character words to the pack's pinyin."""
    from piper.phonemize_chinese import _normalize_g2pw_syllable
    v = W['voice']
    ph = getattr(v, '_chinese_phonemizer', None)
    if ph is None: v.phonemize('你好'); ph = v._chinese_phonemizer
    text = ph._numbers_to_words(text.replace('“', '').replace('”', '').replace('"', ''))
    syl = ph.g2p(text)[0]
    out = [(_normalize_g2pw_syllable(s) if s else (c if c in '。，？！,?!' else None)) for s, c in zip(syl, text)]
    # g2pW sometimes gives the Taiwan reading han4 for the conjunction 和; Mainland standard is he2
    out = [('he2' if c == '和' and o == 'han4' else o) for o, c in zip(out, text)]
    lex = W['lex']; i = 0; forced = 0
    while i < len(text):
        for L in range(min(6, len(text) - i), 1, -1):
            w = text[i:i + L]
            if w in lex:
                for k in range(L): out[i + k] = lex[w][k]
                i += L; forced += 1; break
        else: i += 1
    return [s for s in out if s], forced

def synth(clip):
    from piper import SynthesisConfig
    v = W.get('voice'); pk = W['pk']; t = clip['t']
    word = clip['k'] == 'w'
    cfg = SynthesisConfig(length_scale=1.12 if word else 1.04, noise_scale=0.5, noise_w_scale=0.6)
    if pk == 'zh':
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import kokoro_zh as kz
        f = f"{kz.OUT}/{kz.key(clip['k'], t, clip.get('syl'))}.wav"
        if not os.path.exists(f): raise SystemExit(f'missing Kokoro clip for {t!r}: run kokoro_zh.py first')
        return decode(f)
    if ext(pk):
        f = ext_path(pk, clip)
        if not os.path.exists(f): raise SystemExit(f'missing {engine(pk)} clip for {t!r}: run ext_tts.py first')
        return decode(f)
    if False:
        syls = clip.get('syl') if word else None
        if not syls: syls, _ = zh_sentence_syls(t)
        ph = zh_phonemes(list(syls) + ([] if syls and syls[-1] in '。？！?!' else ['。']))
        return v.phoneme_ids_to_audio(v.phonemes_to_ids(ph), cfg)
    text = t if not word or t[-1:] in '.!?' else t + '.'
    chunks = [c.audio_float_array for c in v.synthesize(text, cfg)]
    gap = np.zeros(int(0.18 * SR), dtype=np.float32)
    return np.concatenate([x for c in chunks for x in (c, gap)][:-1]) if chunks else np.zeros(1, np.float32)

def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()

def frames_db(a, n=441):
    m = len(a) // n
    if m == 0: return np.array([-120.0])
    r = np.sqrt(np.mean(a[:m * n].reshape(m, n) ** 2, axis=1) + 1e-12)
    return 20 * np.log10(r)

def clean(a, human):
    """Trim silence, normalize loudness, add lead/tail padding. Returns (audio, problem or None)."""
    a = a - np.mean(a) if len(a) else a
    db = frames_db(a); n = 441
    if not len(a) or db.max() < -60: return None, 'silent'
    floor, peak = np.percentile(db, 10), db.max()
    thr = max(peak - 38, floor + 8)
    on = np.where(db > thr)[0]
    s0, s1 = max(0, on[0] * n - int(0.06 * SR)), min(len(a), (on[-1] + 1) * n + int(0.12 * SR))
    a = a[s0:s1]
    if human:
        if peak - floor < 22: return None, f'noisy ({peak - floor:.0f} dB)'
        if len(a) / SR > (3.2 if human == 'w' else 12): return None, f'long ({len(a) / SR:.1f}s)'
        if np.mean(np.abs(a) > 0.99) > 0.002: return None, 'clipped'
    act = frames_db(a); act = act[act > act.max() - 25]
    rms = 10 ** (np.mean(act) / 20) if len(act) else 0.1
    a = a * (10 ** (-18 / 20) / max(rms, 1e-4))
    pk = np.max(np.abs(a)) or 1
    if pk > 0.89: a = a * (0.89 / pk)
    fade = min(len(a) // 4, int(0.01 * SR))
    if fade: a[:fade] *= np.linspace(0, 1, fade); a[-fade:] *= np.linspace(1, 0, fade)
    return np.concatenate([np.zeros(LEAD, np.float32), a.astype(np.float32), np.zeros(TAIL, np.float32)]), None

def mp3(a, word):
    import lameenc
    e = lameenc.Encoder(); e.set_bit_rate(32 if word else 24); e.set_in_sample_rate(SR); e.set_channels(1); e.set_quality(2)
    return bytes(e.encode((np.clip(a, -1, 1) * 32767).astype('<i2').tobytes()) + e.flush())

def job(args):
    clip, ll = args
    word = clip['k'] == 'w'
    src_key = ('ll', ll['title']) if ll else ('tts', VOICE[W['pk']][0], clip['t'], clip['k'], ','.join(clip.get('syl') or []), 'v2', *(['he2'] if W['pk'] == 'zh' and '和' in clip['t'] else []))
    key = sha(PROC_V, *src_key)
    out = f'{CACHE}/mp3/{key[:2]}/{key}.mp3'
    if os.path.exists(out): return clip['t'], open(out, 'rb').read(), 'll' if ll else 'tts', None, os.path.getsize(out)
    problem = None
    if ll:
        a, problem = clean(decode(ll['src']), clip['k'])
        if a is None:
            ll = None; key = sha(PROC_V, 'tts', VOICE[W['pk']][0], clip['t'], clip['k'], ','.join(clip.get('syl') or []), 'v2', *(['he2'] if W['pk'] == 'zh' and '和' in clip['t'] else [])); out = f'{CACHE}/mp3/{key[:2]}/{key}.mp3'
            if os.path.exists(out): return clip['t'], open(out, 'rb').read(), 'tts', problem, os.path.getsize(out)
    if not ll:
        a, p2 = clean(synth(clip), False)
        if a is None: return clip['t'], None, 'fail', p2, 0
    data = mp3(a, word)
    os.makedirs(os.path.dirname(out), exist_ok=True); open(out + '.tmp', 'wb').write(data); os.rename(out + '.tmp', out)
    return clip['t'], data, 'll' if ll else 'tts', problem, len(data)

def main():
    plan = json.load(open('data/audio/plan.json'))
    packs = sys.argv[1:] or list(plan['packs'])
    credits = json.load(open('data/audio/credits.json')) if os.path.exists('data/audio/credits.json') else {}
    for pk in packs:
        t0 = time.time(); P = plan['packs'][pk]
        llmap = json.load(open(f'data/audio/ll-{pk}.json')) if os.path.exists(f'data/audio/ll-{pk}.json') else {}
        tatoeba = json.load(open(f'data/audio/tatoeba-{pk}.json')) if os.path.exists(f'data/audio/tatoeba-{pk}.json') else {}
        def native(c):
            r = (llmap if c['k'] == 'w' else tatoeba).get(c['t'])
            return r if r and r.get('src') else None
        uniq = {}
        for b in P['bundles'].values():
            for c in b['clips']: uniq.setdefault((c['t'], c['k']), c)
        jobs = [(c, native(c)) for c in uniq.values()]
        res = {}; words_set = {c['t'] for c in uniq.values() if c['k'] == 'w'}
        with Pool(int(os.environ.get('JOBS', '7')), initializer=init, initargs=(pk, P.get('lex'))) as pool:
            for i, r in enumerate(pool.imap_unordered(job, jobs, chunksize=8)):
                if r[0] not in res or r[2] == 'll': res[r[0]] = r
                if i % 2000 == 0: print(pk, i, '/', len(jobs), f'{time.time() - t0:.0f}s', flush=True)
        by_text = res  # words and sentences with identical text share one clip
        outdir = f'src/a/{pk}'; shutil.rmtree(outdir, ignore_errors=True); os.makedirs(outdir)
        total = 0; nfiles = 0; src_count = collections.Counter(); rejects = collections.Counter(); used_ll = {}
        for r in by_text.values():
            src_count[r[2]] += 1
            if r[3]: rejects[r[3].split(' ')[0]] += 1
            if r[2] == 'll': used_ll[r[0]] = llmap.get(r[0]) if r[0] in llmap and r[0] in words_set else tatoeba.get(r[0]) or llmap[r[0]]
        for owner, b in P['bundles'].items():
            idx = {}; blobs = []; off = 0
            for c in b['clips']:
                r = by_text.get(c['t'])
                if not r or not r[1]: continue
                idx[c['t']] = [off, len(r[1])]; blobs.append(r[1]); off += len(r[1])
            if not idx: continue
            head = json.dumps(idx, ensure_ascii=False, separators=(',', ':')).encode()
            data = b'LMA1' + struct.pack('<I', len(head)) + head + b''.join(blobs)
            path = 'src' + b['file']; open(path, 'wb').write(data); total += len(data); nfiles += 1
        # credits: who recorded what (for CREDITS.md, the credits page and word pages)
        spk = collections.defaultdict(lambda: {'n': 0, 'licenses': set()})
        for w, r in used_ll.items():
            if r.get('origin') == 'tatoeba': continue  # sentence recordings are credited under 'sentences'
            spk[r['speaker']]['n'] += 1; spk[r['speaker']]['licenses'].add(r['license'])
        credits[pk] = {
            'tts': {'engine': engine(pk), 'voice': VOICE[pk][1], 'model': VOICE[pk][0], 'license': VOICE[pk][2], 'clips': src_count['tts']},
            'll': {'clips': sum(1 for r in used_ll.values() if r.get('origin') != 'tatoeba'), 'speakers': {k: {'n': v['n'], 'licenses': sorted(v['licenses'])} for k, v in sorted(spk.items(), key=lambda kv: -kv[1]['n'])}},
            'words': {w: {'speaker': r['speaker'], 'license': r['license'], 'title': r['title'], 'origin': r.get('origin', 'll')} for w, r in sorted(used_ll.items()) if r.get('origin') != 'tatoeba'},
            'sentences': {'clips': sum(1 for r in used_ll.values() if r.get('origin') == 'tatoeba'), 'speakers': dict(collections.Counter(f"{r['speaker']}|{r['license']}|{r.get('attribution', '')}" for r in used_ll.values() if r.get('origin') == 'tatoeba'))},
            'files': nfiles, 'bytes': total, 'clips': len(by_text), 'failed': src_count['fail'], 'll_rejected': dict(rejects),
        }
        print(pk, f'{nfiles} files, {total / 1e6:.1f} MB, clips {len(by_text)}', dict(src_count), 'll rejected', dict(rejects), f'{time.time() - t0:.0f}s', flush=True)
        json.dump(credits, open('data/audio/credits.json', 'w'), ensure_ascii=False, indent=1, sort_keys=True)

if __name__ == '__main__':
    main()
