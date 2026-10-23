"""Find extra native word recordings on Wikimedia Commons for words without a Lingua Libre clip.
Looks up per-language file-name conventions (Wiktionary/Shtooka uploads such as 'Es-casa.ogg',
'En-us-open.ogg', 'Fr-maison.ogg'), keeps CC0 / CC BY / CC BY-SA / public-domain files only,
downloads them to $AUDIO_SRC/commons/<pack>/ and merges into data/audio/ll-<pack>.json (origin 'commons').
Usage: python3 scripts/audio/commons_match.py es en ..."""
import json, os, re, sys, time, hashlib, html, urllib.request, urllib.parse, collections
SRC = os.environ.get('AUDIO_SRC', '/home/box/audio-src')
UA = {'User-Agent': 'LinguaMagnaAudio/0.1 (https://linguamagna.pages.dev; one-time fetch of openly licensed word recordings, credited) python-urllib'}
# (title pattern, accent label) in priority order; {w} is the word, {W} capitalized
PATTERNS = {
    'es': [('Es-{w}.ogg', ''), ('Es-{w}.oga', ''), ('Es-mx-{w}.ogg', 'Mexico'), ('Es-am-lat-{w}.ogg', 'Latin America')],
    'en': [('En-us-{w}.ogg', 'US'), ('En-us-{w}.oga', 'US'), ('En-us-{w}.wav', 'US')],
    'pt': [('Pt-br-{w}.ogg', 'Brazil'), ('Pt-br-{w}.oga', 'Brazil')],
    'fr': [('Fr-{w}.ogg', ''), ('Fr-Paris--{w}.ogg', 'Paris')],
    'it': [('It-{w}.ogg', ''), ('It-{w}.oga', '')],
    'de': [('De-{w}.ogg', ''), ('De-{W}.ogg', ''), ('De-{w}.oga', '')],
}
def ok_lic(l):
    l = l.strip()
    return bool(re.fullmatch(r'(CC0( 1\.0)?|CC BY(-SA)? \d\.\d( [A-Za-z]{2})?)', l, re.I)) and 'NC' not in l and 'ND' not in l
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
            open(path + '.tmp', 'wb').write(data); os.rename(path + '.tmp', path); time.sleep(0.5); return True
        except Exception as e: print('dl retry', e, file=sys.stderr); time.sleep(10 * (i + 1))
    return False
def artist(md):
    a = re.sub(r'<[^>]+>', '', html.unescape(md.get('Artist', {}).get('value', ''))).strip()
    return re.sub(r'\s+', ' ', a)[:80] or 'unknown'
plan = json.load(open('data/audio/plan.json'))
for pk in sys.argv[1:]:
    lj = f'data/audio/ll-{pk}.json'; have = json.load(open(lj)) if os.path.exists(lj) else {}
    words = sorted({c['t'] for b in plan['packs'][pk]['bundles'].values() for c in b['clips'] if c['k'] == 'w'} - set(have))
    want = {}
    for w in words:
        for pat, acc in PATTERNS[pk]:
            t = 'File:' + pat.format(w=w, W=w[:1].upper() + w[1:])
            want.setdefault(t, (w, acc))
    found = {}
    titles = list(want)
    for i in range(0, len(titles), 50):
        d = api({'action': 'query', 'prop': 'imageinfo', 'iiprop': 'url|user|extmetadata', 'iiextmetadatafilter': 'LicenseShortName|Artist', 'titles': '|'.join(titles[i:i + 50])})
        norm = {n['to']: n['from'] for n in d['query'].get('normalized', [])}
        for p in d['query']['pages'].values():
            if 'missing' in p or not p.get('imageinfo'): continue
            t = norm.get(p['title'], p['title']); w, acc = want[t]; ii = p['imageinfo'][0]; md = ii.get('extmetadata', {})
            lic = md.get('LicenseShortName', {}).get('value', '')
            if not ok_lic(lic): print('skip license', t, lic, file=sys.stderr); continue
            rank = [x[0] for x in PATTERNS[pk]].index(next(x[0] for x in PATTERNS[pk] if 'File:' + x[0].format(w=w, W=w[:1].upper() + w[1:]) == t))
            if w in found and found[w][0] <= rank: continue
            spk = re.sub(r'^User:', '', artist(md)); spk = ii.get('user', spk) if spk.lower() in ('unknown', 'myself', 'own work', 'self') or 'machine-readable' in spk else spk
            found[w] = (rank, {'title': p['title'][5:], 'speaker': spk + (f' ({acc})' if acc else ''), 'license': lic, 'url': ii['url'].split('?')[0], 'origin': 'commons'})
        time.sleep(0.4)
    os.makedirs(f'{SRC}/commons/{pk}', exist_ok=True); n = 0
    for w, (_, r) in sorted(found.items()):
        path = f'{SRC}/commons/{pk}/' + hashlib.sha1(r['title'].encode()).hexdigest()[:16] + os.path.splitext(r['title'])[1]
        if fetch(r['url'], path): r['src'] = path; have[w] = r; n += 1
    json.dump(dict(sorted(have.items())), open(lj, 'w'), ensure_ascii=False, indent=0)
    print(pk, 'missing', len(words), 'added', n, collections.Counter(r['license'] for _, r in found.values()).most_common(6), collections.Counter(r['speaker'] for _, r in found.values()).most_common(6), flush=True)
