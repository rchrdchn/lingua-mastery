// Downloads raw open data into data/raw (gitignored). Re-run to refresh sources.
// Usage: node scripts/data/fetch.mjs [--skip-kaikki]
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import readline from 'node:readline';
import https from 'node:https';
const RAW = new URL('../../data/raw/', import.meta.url).pathname;
fs.mkdirSync(RAW, { recursive: true });
const sh = c => execSync(c, { stdio: 'inherit', cwd: RAW });
const get = (url, out) => { if (fs.existsSync(RAW + out)) return; console.log('GET', url); sh(`curl -sSLf -o ${out}.part '${url}' && mv ${out}.part ${out}`); };
const LANGS = ['es', 'fr', 'it', 'pt', 'de', 'en'];
const T3 = { es: 'spa', fr: 'fra', it: 'ita', pt: 'por', de: 'deu', en: 'eng', zh: 'cmn' };

// Mandarin
get('https://raw.githubusercontent.com/ivankra/hsk30/master/hsk30.csv', 'hsk30.csv');
get('https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz', 'cedict.txt.gz');
// Frequency lists (hermitdave/FrequencyWords, MIT, OpenSubtitles 2018)
for (const l of LANGS) get(`https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/${l}/${l}_50k.txt`, `freq-${l}.txt`);
// Tatoeba (CC BY 2.0 FR): sentences with author, plus links to English (and English to es/zh/pt for ESL)
for (const l of ['zh', 'es', 'fr', 'it', 'pt', 'de', 'en']) get(`https://downloads.tatoeba.org/exports/per_language/${T3[l]}/${T3[l]}_sentences_detailed.tsv.bz2`, `tatoeba-${l}.tsv.bz2`);
for (const l of ['zh', 'es', 'fr', 'it', 'pt', 'de']) get(`https://downloads.tatoeba.org/exports/per_language/${T3[l]}/${T3[l]}-eng_links.tsv.bz2`, `links-${l}-en.tsv.bz2`);

// Wiktionary glosses via kaikki.org (CC BY-SA 4.0 / GFDL). Streamed and filtered to the top words only.
const KK = { es: 'Spanish', fr: 'French', it: 'Italian', pt: 'Portuguese', de: 'German' };
const TOP = 6000;
function topWords(l) {
  return new Set(fs.readFileSync(RAW + `freq-${l}.txt`, 'utf8').split('\n').slice(0, TOP).map(x => x.split(' ')[0]).filter(Boolean));
}
function kaikki(l) {
  const out = RAW + `kaikki-${l}.jsonl`;
  if (fs.existsSync(out)) return Promise.resolve();
  const want = topWords(l);
  const w = fs.createWriteStream(out + '.part');
  const url = `https://kaikki.org/dictionary/${KK[l]}/kaikki.org-dictionary-${KK[l]}.jsonl`;
  console.log('STREAM', url);
  return new Promise((res, rej) => https.get(url, r => {
    const rl = readline.createInterface({ input: r });
    let n = 0;
    rl.on('line', line => {
      // Cheap pre-filter on any "word" value, then parse and check the top-level headword.
      let hit = false; for (const m of line.matchAll(/"word": ?"([^"]*)"/g)) if (want.has(m[1].toLowerCase())) { hit = true; break; }
      if (!hit) return;
      let e; try { e = JSON.parse(line); } catch { return; }
      if (!want.has(String(e.word).toLowerCase())) return;
      if (e.pos === 'name' || e.pos === 'character') return;
      const senses = (e.senses || []).filter(s => s.glosses).slice(0, 4).map(s => ({ g: s.glosses[s.glosses.length - 1], tags: s.tags || [], form_of: (s.form_of || []).map(f => f.word) }));
      if (!senses.length) return;
      const ipa = (e.sounds || []).find(s => s.ipa)?.ipa;
      const gender = (e.head_templates || [])[0]?.expansion;
      w.write(JSON.stringify({ word: e.word, pos: e.pos, senses, ipa, head: gender }) + '\n'); n++;
    });
    rl.on('close', () => { w.end(() => { fs.renameSync(out + '.part', out); console.log('kaikki', l, n); res(); }); });
    r.on('error', rej);
  }).on('error', rej));
}
// English Wiktionary translation tables (es, pt, zh) for the ESL pack: far more reliable
// than reverse-looking-up glosses. Top 2000 English words, translations only.
function kaikkiEnTranslations() {
  const out = RAW + 'kaikki-en-tr.jsonl';
  if (fs.existsSync(out)) return Promise.resolve();
  const want = new Set(fs.readFileSync(RAW + 'freq-en.txt', 'utf8').split('\n').slice(0, 2000).map(x => x.split(' ')[0]).filter(Boolean));
  const LANGS = { es: 'es', pt: 'pt', zh: 'cmn', cmn: 'cmn' };
  const w = fs.createWriteStream(out + '.part');
  const url = 'https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl';
  console.log('STREAM', url);
  return new Promise((res, rej) => https.get(url, r => {
    const rl = readline.createInterface({ input: r }); let n = 0;
    rl.on('line', line => {
      const m = line.match(/^\{"word": ?"([^"]*)"/) || line.match(/"word": ?"([^"]*)", ?"(?:pos|lang_code)"/);
      if (m && !want.has(m[1])) return;
      if (!line.includes('"translations"')) return;
      let e; try { e = JSON.parse(line); } catch { return; }
      if (!want.has(e.word) || e.lang_code && e.lang_code !== 'en') return;
      const all = [...(e.translations || []), ...(e.senses || []).flatMap(s => s.translations || [])];
      const tr = {};
      for (const t of all) {
        // Mandarin only (code cmn); other Chinese varieties (Min Nan, Cantonese) share "Chinese" headings.
        const b = t.code === 'cmn' || /^(Chinese )?Mandarin$/.test(t.lang || '') ? 'zh' : t.code;
        if (!['es', 'pt', 'zh'].includes(b) || !t.word) continue;
        (tr[b] ||= []).push({ w: t.word, s: t.sense || '', r: t.roman || '', tags: t.tags || [] });
      }
      if (!Object.keys(tr).length) return;
      const senses = (e.senses || []).filter(s => s.glosses).slice(0, 3).map(s => s.glosses[s.glosses.length - 1]);
      w.write(JSON.stringify({ word: e.word, pos: e.pos, senses, tr }) + '\n'); n++;
    });
    rl.on('close', () => { w.end(() => { fs.renameSync(out + '.part', out); console.log('kaikki en translations', n); res(); }); });
    r.on('error', rej);
  }).on('error', rej));
}
if (!process.argv.includes('--skip-kaikki')) {
  await Promise.all([...Object.keys(KK).map(kaikki), kaikkiEnTranslations()]);
}
// Decompress .bz2 files with Python (bzip2 is not always installed).
for (const f of fs.readdirSync(RAW).filter(f => f.endsWith('.tsv.bz2'))) {
  const out = f.replace(/\.bz2$/, '');
  if (!fs.existsSync(RAW + out)) { console.log('bunzip', f); sh(`python3 -c "import bz2,shutil,sys; shutil.copyfileobj(bz2.open(sys.argv[1]), open(sys.argv[2],'wb'))" ${f} ${out}`); }
}
// Hanzi Writer stroke data comes from the hanzi-writer-data npm package (Arphic Public License); see scripts/data/build-packs.mjs.
console.log('fetch done');
