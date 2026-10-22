"""Native sentence audio from Tatoeba, only where that clip's own license is CC0 / CC BY / CC BY-SA.
Clips with an empty license ('no reuse outside Tatoeba'), NC or ND licenses are skipped.
Needs the Tatoeba exports in /home/box/tatoeba/ (sentences_with_audio.tar.bz2, <iso>_sentences.tsv.bz2).
Writes data/audio/tatoeba-<pack>.json {sentence: {title, speaker, license, url, attribution, src, origin}}.
Usage: python3 scripts/audio/tatoeba_match.py es en ..."""
import bz2, tarfile, collections, json, os, sys, time, unicodedata, urllib.request
ISO = {'es': 'spa', 'en': 'eng', 'pt': 'por', 'fr': 'fra', 'it': 'ita', 'de': 'deu'}
OK = {'CC0 1.0', 'CC BY 4.0', 'CC BY-SA 4.0', 'CC BY 3.0', 'CC BY-SA 3.0', 'CC BY 2.0 FR'}
SRC = os.environ.get('AUDIO_SRC', '/home/box/audio-src'); T = '/home/box/tatoeba'
UA = {'User-Agent': 'LinguaMagnaAudio/0.1 (https://linguamagna.pages.dev; one-time fetch of openly licensed sentence audio, credited) python-urllib'}
def n(s): return unicodedata.normalize('NFC', s.strip())
plan = json.load(open('data/audio/plan.json'))
aud = collections.defaultdict(list)
tf = tarfile.open(f'{T}/sentences_with_audio.tar.bz2', 'r:bz2')
for l in tf.extractfile(tf.getmembers()[0]):
    x = l.decode().rstrip('\n').split('\t')
    if len(x) >= 4 and x[3] in OK: aud[x[0]].append({'audio': x[1], 'user': x[2], 'license': x[3], 'attr': x[4] if len(x) > 4 and x[4] != '\\N' else f'https://tatoeba.org/user/profile/{x[2]}'})
for pk in sys.argv[1:]:
    sents = {n(c['t']): c['t'] for b in plan['packs'][pk]['bundles'].values() for c in b['clips'] if c['k'] == 's'}
    out = {}; os.makedirs(f'{SRC}/tatoeba/{pk}', exist_ok=True)
    for l in bz2.open(f'{T}/{ISO[pk]}_sentences.tsv.bz2', 'rt'):
        sid, _, txt = l.rstrip('\n').split('\t', 2)
        t = sents.get(n(txt))
        if not t or t in out or sid not in aud: continue
        a = aud[sid][0]; path = f"{SRC}/tatoeba/{pk}/{a['audio']}.mp3"
        if not os.path.exists(path):
            for i in range(5):
                try:
                    data = urllib.request.urlopen(urllib.request.Request(f"https://tatoeba.org/audio/download/{a['audio']}", headers=UA), timeout=60).read()
                    open(path, 'wb').write(data); time.sleep(0.5); break
                except Exception as e: print('retry', e, file=sys.stderr); time.sleep(5 * (i + 1))
            else: continue
        out[t] = {'title': f"Tatoeba sentence #{sid}, audio #{a['audio']}", 'speaker': a['user'], 'license': a['license'], 'url': f'https://tatoeba.org/sentences/show/{sid}', 'attribution': a['attr'], 'src': path, 'origin': 'tatoeba'}
    json.dump(dict(sorted(out.items())), open(f'data/audio/tatoeba-{pk}.json', 'w'), ensure_ascii=False, indent=0)
    print(pk, 'sentences', len(sents), 'tatoeba CC audio', len(out), collections.Counter((r['speaker'], r['license']) for r in out.values()).most_common(), flush=True)
