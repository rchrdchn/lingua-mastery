"""Merge Mandarin native recordings into data/audio/ll-zh.json.
Sources (all on Wikimedia Commons):
  * Shtooka-project files named Zh-<pinyin>.ogg (Wei Gao, Beijing; Yue Tan, Liaoning; Xudong Yang, Henan),
    matched on the pack's own tone-marked pinyin, so homophones share a recording and polyphones never mismatch.
  * Lingua Libre (LL-Q9192 (cmn)-...) from scripts/audio/ll_match.py, matched on hanzi.
Taiwan-Mandarin speakers and Taiwan-variant readings are skipped; learner (non-native) uploads are skipped.
Inputs: /home/box/ll/titles-zhpre.txt (Commons File: titles with prefixes Zh-, Cmn-), data/audio/ll-zh.json (LL)."""
import json, os, re, sys, time, unicodedata, hashlib, urllib.request, urllib.parse, collections
UA = {'User-Agent': 'LinguaMagnaAudio/0.1 (https://linguamagna.pages.dev; pronunciation audio for a free course, credited) python-urllib'}
SRC = os.environ.get('AUDIO_SRC', '/home/box/audio-src')
plan = json.load(open('data/audio/plan.json')); P = plan['packs']['zh']
M = {'a': 'āáǎà', 'e': 'ēéěè', 'i': 'īíǐì', 'o': 'ōóǒò', 'u': 'ūúǔù', 'ü': 'ǖǘǚǜ'}
def mark(s):
    s = s.replace('v', 'ü').replace('u:', 'ü'); t = int(s[-1]) if s[-1].isdigit() else 5; b = s.rstrip('012345')
    if t in (5, 0): return b
    for v in ('a', 'e'):
        if v in b: return b.replace(v, M[v][t - 1], 1)
    if 'ou' in b: return b.replace('o', M['o'][t - 1], 1)
    i = max(i for i, c in enumerate(b) if c in 'aeiouü'); return b[:i] + M[b[i]][t - 1] + b[i + 1:]
SPEAKERS = {  # Commons "Artist" field -> (credit name, priority). Lower is preferred.
    'Wei Gao': ('Wei Gao (Shtooka, Beijing)', 0), 'Yue Tan': ('Yue Tan (Shtooka, Liaoning)', 1), 'Xudong Yang': ('Xudong Yang (Henan)', 2)}
LL_SKIP_SPEAKERS = {'Shangkuanlc', '雲角'}  # Taiwan Mandarin / unverified traditional-script speaker
TW_VARIANT = set('垃圾星期危险企业质量头发研究法国角色微携暂亚洲港识谁血寻播档蜗卫骨包括惊结束傍晚')  # chars whose Taiwan reading differs
def api(p):
    q = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({**p, 'format': 'json', 'maxlag': '5'})
    for i in range(6):
        try: return json.load(urllib.request.urlopen(urllib.request.Request(q, headers=UA), timeout=60))
        except Exception as e: print('retry', e, file=sys.stderr); time.sleep(5 * (i + 1))
words = {}
for b in P['bundles'].values():
    for c in b['clips']:
        if c['k'] == 'w' and c.get('syl'): words[c['t']] = c['syl']
by = collections.defaultdict(list)
for w, s in words.items(): by[''.join(mark(x) for x in s)].append(w)
files = collections.defaultdict(list)
for line in open('/home/box/ll/titles-zhpre.txt'):
    t = line.strip(); m = re.match(r'^File:(?:Zh|Cmn)-(.+)\.(ogg|oga)$', t, re.I)
    if not m: continue
    k = unicodedata.normalize('NFC', m.group(1)).lower().replace(' ', '').replace("'", '').replace('_', '')
    if k in by: files[k].append(t)
titles = sorted({t for v in files.values() for t in v}); info = {}
for i in range(0, len(titles), 50):
    d = api({'action': 'query', 'prop': 'imageinfo', 'iiprop': 'url|extmetadata', 'titles': '|'.join(titles[i:i + 50])})
    for p in d['query']['pages'].values():
        ii = (p.get('imageinfo') or [{}])[0]; em = ii.get('extmetadata', {})
        g = lambda k: re.sub('<[^>]+>', '', em.get(k, {}).get('value', '')).strip()
        info[p['title']] = {'url': (ii.get('url') or '').split('?')[0], 'artist': g('Artist'), 'license': g('LicenseShortName')}
    time.sleep(0.5)
OK_LIC = re.compile(r'^(CC0|CC BY(-SA)? [0-9.]+( [a-z]+)?|Public domain)$', re.I)
out = {}
for k, ts in files.items():
    best = None
    for t in ts:
        inf = info.get(t)
        if not inf or not inf['url'] or not OK_LIC.match(inf['license']): continue
        spk = next((v for a, v in SPEAKERS.items() if inf['artist'].startswith(a)), None)
        if not spk: continue
        if not best or spk[1] < best[0]: best = (spk[1], t, spk[0], inf)
    if not best: continue
    _, t, name, inf = best
    path = f"{SRC}/shtooka/zh/{hashlib.sha1(t.encode()).hexdigest()[:16]}.ogg"
    if not os.path.exists(path):
        for i in range(5):
            try:
                data = urllib.request.urlopen(urllib.request.Request(inf['url'], headers=UA), timeout=60).read()
                open(path + '.tmp', 'wb').write(data); os.rename(path + '.tmp', path); break
            except Exception as e: print('retry', t, e, file=sys.stderr); time.sleep(5 * (i + 1))
        time.sleep(0.3)
    for w in by[k]: out[w] = {'title': t[5:], 'speaker': name, 'license': inf['license'].replace(' fr', ' FR').replace(' us', ' US'), 'url': inf['url'], 'src': path}
nsh = len(out)
ll = json.load(open('data/audio/ll-zh.json')) if os.path.exists('data/audio/ll-zh.json') else {}
skipped = collections.Counter()
for w, v in ll.items():
    if v.get('origin') == 'shtooka': continue
    if w in out: continue
    if v['speaker'] in LL_SKIP_SPEAKERS: skipped['speaker'] += 1; continue
    if any(c in TW_VARIANT for c in w): skipped['tw-variant'] += 1; continue
    out[w] = {**v, 'origin': 'll'}
for v in out.values(): v.setdefault('origin', 'shtooka')
json.dump(dict(sorted(out.items())), open('data/audio/ll-zh.json', 'w'), ensure_ascii=False, indent=0)
print('zh words', len(words), 'native', len(out), 'shtooka', nsh, 'll', len(out) - nsh, 'skipped', dict(skipped))
