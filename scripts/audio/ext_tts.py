"""Pre-synthesize a pack's clips with a non-Piper engine; build.py then reads the WAVs.
Kokoro (run with /home/box/tts2/kokoro-venv/bin/python):  ext_tts.py <pack> kokoro <lang_code> <voice>
MeloTTS (run with /home/box/tts2/melo-venv/bin/python):  ext_tts.py <pack> melo <LANG> <speaker>
Words that already have a native recording are skipped unless ALL=1. Env SHARD=i/n, THREADS.
Output: $AUDIO_SRC/tts/<model>/<sha1(model|kind|text)>.wav where <model> is build.py's VOICE[pack][0]."""
import json, os, sys, re, hashlib
pk, eng, a1, a2 = sys.argv[1:5]
MODEL = os.environ.get('MODEL') or (f'kokoro-v1.0-{a2}' if eng == 'kokoro' else f'melo-{a1}-{a2}')
OUT = f"{os.environ.get('AUDIO_SRC', '/home/box/audio-src')}/tts/{MODEL}"
def path(kind, text): return f"{OUT}/{hashlib.sha1('|'.join([MODEL, kind, text]).encode()).hexdigest()}.wav"
plan = json.load(open('data/audio/plan.json')); P = plan['packs'][pk]
nat = json.load(open(f'data/audio/ll-{pk}.json')) if os.path.exists(f'data/audio/ll-{pk}.json') else {}
tat = json.load(open(f'data/audio/tatoeba-{pk}.json')) if os.path.exists(f'data/audio/tatoeba-{pk}.json') else {}
uniq = {}
for b in P['bundles'].values():
    for c in b['clips']: uniq.setdefault((c['t'], c['k']), c)
items = sorted((c['k'], c['t']) for c in uniq.values()
               if os.environ.get('ALL') or not ((nat if c['k'] == 'w' else tat).get(c['t'], {}).get('src')))
if os.environ.get('ONLY'): only = set(json.load(open(os.environ['ONLY']))); items = [x for x in items if x[1] in only]
shard, nsh = (int(x) for x in os.environ.get('SHARD', '0/1').split('/'))
items = [x for i, x in enumerate(items) if i % nsh == shard and not os.path.exists(path(*x))]
print(MODEL, 'to do', len(items), flush=True); os.makedirs(OUT, exist_ok=True)
import numpy as np, soundfile as sf, torch
torch.set_num_threads(int(os.environ.get('THREADS', '2')))
if eng == 'kokoro':
    from kokoro import KModel, KPipeline
    model = KModel(repo_id='hexgrad/Kokoro-82M').eval()
    pipe = KPipeline(lang_code=a1, repo_id='hexgrad/Kokoro-82M', model=model)
    def synth(text):
        parts = [r.audio.numpy() for r in pipe(text, voice=a2, speed=float(os.environ.get('SPEED', '1.0'))) if r.audio is not None]
        return (np.concatenate(parts) if parts else np.zeros(100, np.float32)), 24000
else:
    from melo.api import TTS
    m = TTS(language=a1, device='cpu'); sid = m.hps.data.spk2id[a2]
    def synth(text):
        return m.tts_to_file(text, sid, None, speed=float(os.environ.get('SPEED', '1.0')), quiet=True), m.hps.data.sampling_rate
for i, (kind, text) in enumerate(items):
    a, sr = synth(text); f = path(kind, text)
    sf.write(f + '.tmp.wav', a, sr); os.rename(f + '.tmp.wav', f)
    if i % 200 == 0: print(i, flush=True)
print('done', len(items), flush=True)
