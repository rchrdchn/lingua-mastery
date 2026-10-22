# Contributing

Thanks for helping. The most useful contributions are better language data: fixing a wrong meaning, adding a grammar lesson, or adding a whole new language pack. Code fixes to the engine and site are welcome too.

By contributing you agree that code is released under MIT ([`LICENSE`](LICENSE)) and content (packs, grammar lessons, translations, page copy) under CC BY-SA 4.0 ([`LICENSE-CONTENT`](LICENSE-CONTENT)). Only add material you wrote yourself or that comes from a source with a compatible open license (CC0, CC BY, CC BY-SA, MIT and similar). **Do not** copy from textbooks, apps, paid courses or CC BY-NC / "non-commercial" material.

## Setup

```bash
npm install               # Node 20+
npm run data:fetch        # downloads raw sources into data/raw/ (about 1.5 GB of downloads, not committed)
npm run data:build        # rebuilds data/packs/*.json  (or: node --max-old-space-size=7000 scripts/data/build-packs.mjs es fr)
npm run build             # typecheck + bundle + Eleventy + postbuild checks
npm test                  # engine unit tests (every pack must produce valid exercises)
npm run check             # internal links + 2 inbound links per sitemap URL
npm run serve             # local preview at http://localhost:8080/
npm run verify            # Playwright run-through with system Chrome
```

You only need `data:fetch` if you change the pack builder or add a language. Editing grammar or overrides still needs a rebuild of that pack, so fetch once.

## Small fixes

- **A wrong meaning in Spanish, French, Italian, Portuguese or German:** these come from Wiktionary. The best fix is upstream on Wiktionary (it then flows in on the next fetch). For a quick fix here, edit `content/gloss-overrides/<lang>.json`:
  - `gloss`: lemma -> the English gloss to show, senses separated by "; " (first sense first, short and translation-like).
  - `_lemma`: word form -> lemma, when the builder picks the wrong lemma (for example `"creo": "creer"`, not crear).
  - `_drop`: words to leave out (fillers such as "uh").
  Or open an issue with the "Data fix" template.
- **A wrong ESL translation (English pack):** edit `content/en-overrides.json`. Each key is an English word: `{ "es": "...", "pt": "...", "zh": "...", "py": "pinyin", "pos": "verb" }`. Words in `_skip` are left out of the course. Without an override, the builder uses the English Wiktionary translation tables, then a reverse dictionary lookup.
- **Gloss check:** `npm run data:lint` flags primary glosses (text before the first ";") in the top 600 words of each pack that read like grammar notes ("form of", "dative of", "plural of", "compound of"...) or run over 60 characters. `npm test` runs the same check, and `GLOSS_STRICT=1 npm run data:build` fails the build on it. Fix flags with an override.
- **A grammar lesson typo:** edit `content/grammar/<lang>.mjs`.

Then run `node --max-old-space-size=7000 scripts/data/build-packs.mjs <lang>`, `npm test` and `npm run build`, and commit both the source change and the regenerated `data/packs/<lang>.json`.

## Adding a grammar lesson

Add an object to `content/grammar/<lang>.mjs`:

```js
{
  id: 'negation',                       // unique within the pack
  slug: 'ne-pas-negation',              // URL: /<language>/grammar/<slug>/
  level: 'a1',                          // one of the pack's level ids
  title:   { en: 'Ne ... pas: saying "not"' },              // one key per base language of the pack
  summary: { en: 'One or two sentences, answer first.' },
  body:    { en: ['Short paragraph.', 'Another short paragraph.'] },
  pattern: 'ne + verb + pas',
  examples: [{ t: 'Je ne comprends pas.', tr: { en: 'I do not understand.' } }],  // written by you
  cloze: { answers: ['pas', 'jamais'], pool: ['pas', 'jamais', 'plus', 'rien'] },
  after: ['etre'],                      // optional: other lesson ids that must be mastered first
}
```

How the builder uses it:

- **Practice sentences:** up to 40 Tatoeba sentences that contain exactly one `answers` token become fill-the-gap drills. Wrong options come from `pool`. Pick answers that are distinctive, otherwise you get few sentences (the build log shows the count).
- **Prerequisites:** the lesson unlocks after the earliest vocabulary group that teaches one of the answer words (inflected forms count), plus anything in `after`.
- **Base languages:** for the English pack, write `title`, `summary`, `body` and example `tr` in `es`, `pt` and `zh` too (see `content/grammar/en.mjs`). For other packs, `en` is enough.

Style: short paragraphs, plain words, no em dashes, examples you wrote yourself.

## Adding a new language pack

Example: Japanese (`ja`) taught from English.

1. **Pick sources** with open licenses: a frequency list (FrequencyWords has most languages), Tatoeba sentences, and a dictionary (Wiktionary via kaikki.org has most languages). Note each license.
2. **Fetch:** add the language code to `LANGS` in `scripts/data/fetch.mjs` (frequency list, Tatoeba sentences and links to English, kaikki dump). Languages with a different script or no spaces may need their own tokenizer, the way Mandarin uses the HSK list and CC-CEDICT instead.
3. **Configure:** add an entry to `PACKS` in `scripts/data/build-packs.mjs`:
   ```js
   ja: { name: 'Japanese', short: 'Japanese', slug: 'japanese', bases: ['en'], speech: 'ja-JP',
         levels: [['a1', 'A1', 300], ['a2', 'A2', 300]], cluster: 10 },
   ```
   `levels` is `[id, name, word count]` in frequency order. `cluster` is the number of words per vocabulary concept. Languages written with spaces go through the shared European builder, which credits `freq`, `wiktionary`, `tatoeba` and `original`. Add any new source to the `CREDITS` table and to the `credits` list passed to `finish()`.
4. **Grammar:** create `content/grammar/ja.mjs` with at least 5 original lessons.
5. **Site copy:** add a `ja` entry to `lib/langs.js` (hub intro, level blurbs, FAQs, `levelSlug`), add `'ja'` to `ORDER` in `src/_data/lm.js`, and add it to `PACKS` in `src/app/main.ts`.
6. **Build and test:** `node --max-old-space-size=7000 scripts/data/build-packs.mjs ja && npm test && npm run build && npm run check`. The tests fail if any concept produces no exercises, if a correct answer is missing from its choices, or if the graph order is wrong.
7. **Check by hand:** open `/learn/?pack=ja`, do the placement quiz and one lesson, and skim 30 word pages for bad meanings.

A new **base language** (teaching English from French, say) means: add the code to the `Base` type in `src/engine/types.ts`, UI strings in `src/engine/i18n.ts`, glosses into that language for the pack's items (`g.fr`), sentence translations (`tr.fr`), and grammar text in that language.

## Pack schema (`data/packs/<id>.json`)

Generated, not hand-edited. Types are in `src/engine/types.ts`.

```ts
{
  id: 'es', target: 'es', name: 'Spanish', short: 'Spanish', slug: 'spanish',
  bases: ['en'],                 // languages explanations and translations are shown in
  speech: 'es-ES',               // speechSynthesis language for listening drills
  version: 1,
  levels: [{ id: 'a1', name: 'A1' }, ...],
  concepts: Concept[],           // topologically ordered: every prereq appears earlier
  items: Item[],                 // words
  chars?: CharInfo[],            // Mandarin only
  sentences: { [tatoebaId]: { t, a, tr: { [base]: text }, ta: { [base]: translator } } },
  credits: [{ name, url, license, licenseUrl, note }]
}

Concept = {
  id: 'es.v.a1.core.1' | 'es.g.ser' | 'zh.f.tones',
  kind: 'vocab' | 'grammar' | 'tone' | 'write',
  level, track?: 'core' | 'nouns' | 'verbs' | 'describing',
  slug?, title: { [base]: string }, summary?, body?, pattern?, examples?,
  items?: string[],              // vocab: item ids taught together
  chars?: string[],              // write: characters to draw
  toneMode?: 'single' | 'neutral' | 'pair' | 'sandhi',
  cloze?: { answers, pool, sents: string[] },   // grammar
  prereqs: string[],             // concept ids that must be mastered first
  threshold: { streak, sec }     // mastery: this many right in a row, averaging under sec seconds
}

Item = {
  id: 'es:ser', t: 'ser', g: { en: 'to be; to exist' },   // gloss per base
  lvl: 'a1', rank: 8, slug: 'ser', concept: 'es.v.a1.verbs.1',
  pos?, ipa?, forms?: string[], ex?: string[],             // example sentence ids
  r?, syl?, sp?, alt?, cl?                                 // Mandarin: pinyin, numbered syllables, sandhi pinyin, traditional, measure words
}
```

## Code changes

- Engine logic lives in `src/engine/` (pure TypeScript, no DOM except `speech.ts` and `store.ts`). Add a test in `test/engine.test.ts` for behaviour changes.
- Keep the site fast and static: no frameworks, no trackers, no accounts.
- Before a pull request: `npm test && npm run build && npm run check`.

## Never commit secrets

No API tokens, account IDs, `.env` files or credentials. Deploys use the Cloudflare Pages Git integration, so the repo needs none. If you add a script that needs a key, read it from an environment variable and document it.
