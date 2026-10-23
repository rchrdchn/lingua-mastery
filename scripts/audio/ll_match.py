"""Match pack words to Lingua Libre recordings on Wikimedia Commons and download them.
Usage: python3 scripts/audio/ll_match.py es fr ...  (needs /home/box/ll/titles-<iso>.txt from list.py)
Writes data/audio/ll-<pack>.json: {word: {title, speaker, license, src}}; WAVs go to $AUDIO_SRC/ll/<pack>/."""
import json, os, re, sys, time, hashlib, urllib.request, urllib.parse, collections
from concurrent.futures import ThreadPoolExecutor
ISO = {'zh': 'cmn', 'es': 'spa', 'en': 'eng', 'fr': 'fra', 'it': 'ita', 'pt': 'por', 'de': 'deu'}
OK_LIC = {'CC0', 'CC BY 4.0', 'CC BY-SA 4.0', 'CC BY 3.0', 'CC BY-SA 3.0', 'Public domain'}
SRC = os.environ.get('AUDIO_SRC', '/home/box/audio-src')
UA = {'User-Agent': 'LinguaMagnaAudio/0.1 (https://linguamagna.pages.dev; one-time fetch of Lingua Libre word recordings, credited) python-urllib'}
plan = json.load(open('data/audio/plan.json'))
# Accent allowlists where the course teaches one variety (Lingua Libre's speaker database, which records
# each speaker's place, was unreachable, so speakers were checked by hand and with an accent classifier):
# English: General American speakers; Portuguese: Brazilian speakers (checked with a phoneme recognizer for
# Brazilian /ti di/ palatalization and final -e as [i]; Santamarcanda, Nelson Ricardo 2500 and Waldyrious are
# European Portuguese and are left out so the course stays pt-BR; AnshulBhagwat is left out as likely non-native).
ALLOW = {
    'en': {'Wodencafe', 'Grendelkhan', 'Naomi Persephone Amethyst (NaomiAmethyst)', 'She animates', 'Rachlel', 'Simplificationalizer', 'Semperosculto'},
    'pt': {'Juliano P. Junho (Jjunho)', 'Sillim', 'JnpoJuwan', 'Juwan (JnpoJuwan)', 'Juwan', 'MedK1', 'Ed Guimaraes'},
}

def api(params):
    q = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({**params, 'format': 'json', 'maxlag': '5'})
    for i in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(q, headers=UA), timeout=60) as r: return json.load(r)
        except Exception as e: print('retry', e, file=sys.stderr); time.sleep(5 * (i + 1))
    raise SystemExit('api failed')

def fetch(url, path):
    if os.path.exists(path): return True
    for i in range(8):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r: data = r.read()
            open(path + '.tmp', 'wb').write(data); os.rename(path + '.tmp', path); time.sleep(0.6); return True
        except Exception as e: print('dl retry', e, file=sys.stderr); time.sleep(15 * (i + 1))
    return False

for pk in sys.argv[1:]:
    iso = ISO[pk]
    words = {c['t'] for b in plan['packs'][pk]['bundles'].values() for c in b['clips'] if c['k'] == 'w'}
    lower = collections.defaultdict(set)
    for w in words: lower[w.lower()].add(w)
    pre = re.compile(r'^File:LL-Q\d+ \(' + iso + r'\)-(.+)\.wav$')
    cands = collections.defaultdict(list); spk_count = collections.Counter()
    for line in open(f'/home/box/ll/titles-{iso}.txt', encoding='utf-8'):
        title = line.rstrip('\n'); m = pre.match(title)
        if not m: continue
        rest = m.group(1)
        for i in [i for i, ch in enumerate(rest) if ch == '-']:
            spk, w = rest[:i], rest[i + 1:]
            hit = [w] if w in words else ([x for x in lower.get(w.lower(), ()) ] if pk != 'de' else [])
            if ALLOW.get(pk) and spk not in ALLOW[pk]: continue
            for x in hit: cands[x].append((title, spk)); spk_count[spk] += 1
    print(pk, 'words', len(words), 'with recordings', len(cands), 'speakers', len(spk_count), spk_count.most_common(5), flush=True)
    # Prefer exact-case matches, then the speakers who recorded the most of our words (consistent voice).
    order = {w: sorted(v, key=lambda tv: (tv[0].endswith('-' + w + '.wav') is False, -spk_count[tv[1]])) for w, v in cands.items()}
    out = {}; pending = {w: list(v[:3]) for w, v in order.items()}
    while pending:
        batch_titles = {}
        for w, v in list(pending.items()):
            if not v: del pending[w]; continue
            batch_titles[v[0][0]] = w
        titles = list(batch_titles)
        for i in range(0, len(titles), 50):
            chunk = titles[i:i + 50]
            d = api({'action': 'query', 'prop': 'imageinfo', 'iiprop': 'url|extmetadata', 'iiextmetadatafilter': 'LicenseShortName|Artist', 'titles': '|'.join(chunk)})
            norm = {n['to']: n['from'] for n in d['query'].get('normalized', [])}
            for p in d['query']['pages'].values():
                t = norm.get(p['title'], p['title']); w = batch_titles.get(t)
                if w is None: continue
                ii = (p.get('imageinfo') or [{}])[0]; md = ii.get('extmetadata', {})
                lic = md.get('LicenseShortName', {}).get('value', '')
                spk = pending[w][0][1]
                if ii.get('url') and lic in OK_LIC:
                    out[w] = {'title': t[5:], 'speaker': spk, 'license': lic, 'url': ii['url'].split('?')[0]}
                    del pending[w]
                else: pending[w].pop(0)
            time.sleep(0.5)
        for w in [w for w in pending if w in out]: del pending[w]
    os.makedirs(f'{SRC}/ll/{pk}', exist_ok=True)
    def dl(item):
        w, r = item; path = f'{SRC}/ll/{pk}/' + hashlib.sha1(r['title'].encode()).hexdigest()[:16] + '.wav'
        return w, path if fetch(r['url'], path) else None
    with ThreadPoolExecutor(1) as ex:
        for w, path in ex.map(dl, list(out.items())):
            if path: out[w]['src'] = path
            else: del out[w]
    json.dump(dict(sorted(out.items())), open(f'data/audio/ll-{pk}.json', 'w'), ensure_ascii=False, indent=0)
    print(pk, 'downloaded', len(out), collections.Counter(r['license'] for r in out.values()), flush=True)
