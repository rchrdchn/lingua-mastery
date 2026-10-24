# Contributing to Lingua Magna

Thanks for helping make Lingua Magna better. The most useful contributions are better language data: fixing a wrong meaning, adding a grammar lesson, or adding a whole new language pack. Code fixes to the engine and site are welcome too.

## Contents

- [Ways to contribute](#ways-to-contribute)
- [Sourcing and licensing rules](#sourcing-and-licensing-rules)
- [Set up locally](#set-up-locally)
- [Small fixes](#small-fixes)
- [Adding a grammar lesson](#adding-a-grammar-lesson)
- [Translations and base languages](#translations-and-base-languages)
- [Adding a new language pack](#adding-a-new-language-pack)
- [Audio and voices](#audio-and-voices)
- [Code changes](#code-changes)
- [Branches and pull requests](#branches-and-pull-requests)
- [Pull request checklist](#pull-request-checklist)
- [Licensing of contributions](#licensing-of-contributions)
- [Never commit secrets](#never-commit-secrets)
- [Pack schema](#pack-schema-datapacksidjson)

## Ways to contribute

| You want to | Do this |
|---|---|
| Report something broken | Open a **Bug** issue with the page URL, steps and your browser. |
| Fix a wrong meaning, translation, pinyin or sentence | Open a **Data fix** issue, or send a pull request with an override (see [Small fixes](#small-fixes)). |
| Suggest or write a grammar lesson | Open a **Grammar lesson** issue, or add it yourself (see [Adding a grammar lesson](#adding-a-grammar-lesson)). |
| Translate the app or lessons | Improve the UI strings or grammar text for a base language (see [Translations and base languages](#translations-and-base-languages)). |
| Add a language | Open a **New language or base language** issue first, then follow [Adding a new language pack](#adding-a-new-language-pack). |
| Improve audio | Report a bad clip with a Data fix issue, or propose a better openly licensed recording or voice. |
| Improve the code | Bug fixes, accessibility, performance and tests are welcome (see [Code changes](#code-changes)). |

## Sourcing and licensing rules

**Text and data**

- Only add material you wrote yourself, or that comes from a source with a compatible open license: CC0, CC BY, CC BY-SA, MIT and similar.
- **Do not** copy from textbooks, apps, paid courses, or CC BY-NC / "non-commercial" or ND material.
- Example sentences in grammar lessons are written by you. Practice sentences come from Tatoeba and keep their author credits.
- Credit every new source in `NOTICE.md` and in the pack's `credits`.

**Voices and recordings: commercially clean only**

- A recording is usable only if that file carries its own CC0, CC BY or CC BY-SA license. Recordings with no reuse license, or NC/ND terms, are skipped.
- A TTS voice is usable only if the code, the model weights **and** the training data all allow commercial use. For example, Kokoro-82M (Apache-2.0) is fine. Piper voices fine-tuned from the lessac or ryan English checkpoints are not, because that base data isn't openly licensed, and voices trained on non-commercial data are out too.
- GPL or MPL tools (Piper, Coqui TTS) may be run as tools at build time, but are not shipped.
- Name the speaker or voice, license and source for every clip. `data/audio/credits.json`, `/credits/` and `NOTICE.md` must stay in sync.

## Set up locally

You need Node 20 or newer (`.nvmrc` pins 22 for local work) and npm.

```bash
git clone https://github.com/rchrdchn/lingua-mastery && cd lingua-mastery
npm install
npm run build             # typecheck + bundle + Eleventy + postbuild checks
npm run serve             # local preview at http://localhost:8080/
npm test                  # engine unit tests (every pack must produce valid exercises)
npm run check             # internal links + 2 inbound links per sitemap URL
npm run verify            # Playwright run-through with system Chrome (PW_CHANNEL=chromium for Playwright's own)
```

To change pack data you also need the raw sources:

```bash
npm run data:fetch        # downloads raw sources into data/raw/ (about 1.5 GB of downloads, not committed)
npm run data:build        # rebuilds data/packs/*.json  (or: node --max-old-space-size=7000 scripts/data/build-packs.mjs es fr)
```

You only need `data:fetch` if you change the pack builder, overrides, grammar or add a language, because each of those needs a pack rebuild. Fetch once.

**Heads-up:** `npm run build` rewrites `lastmod.json`. Run `git checkout lastmod.json` before committing unless your change really updates page content.

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

**Example:** suppose the Spanish word *creo* showed the wrong meaning because the builder picked the lemma *crear*. You would add `"creo": "creer"` under `_lemma` in `content/gloss-overrides/es.json`, rebuild the `es` pack, run the checks, and commit `content/gloss-overrides/es.json` plus `data/packs/es.json`. (That fix is already in the file, so use it as a pattern.)

## Adding a grammar lesson

Add an object to `content/grammar/<lang>.mjs`. This example is based on the `negation` lesson in `content/grammar/fr.mjs`. Copy its shape for a new lesson, with a new `id` and `slug`:

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

Then rebuild the pack (`node --max-old-space-size=7000 scripts/data/build-packs.mjs fr`), run `npm test && npm run build`, and open `/learn/?pack=fr` and the lesson page to check it.

## Translations and base languages

The **base language** is the language explanations and the app interface are shown in. The English pack can be taught from Spanish, Portuguese or Chinese (`Base` in `src/engine/types.ts` is `en | es | pt | zh`); the other packs use English.

- **App interface strings:** `src/engine/i18n.ts`. Fix a string in every base language you can, and keep placeholders as they are.
- **Grammar lessons for the English pack:** `content/grammar/en.mjs` needs `title`, `summary`, `body` and example `tr` in `es`, `pt` and `zh`.
- **ESL word translations:** `content/en-overrides.json` (see Small fixes).
- **Site copy** (hub intros, level blurbs, FAQs): `lib/langs.js`.

Write translations yourself, or use an openly licensed source. Don't paste machine translation without checking it by hand.

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
7. **Audio:** add the language to the audio pipeline (see [Audio and voices](#audio-and-voices)) with a voice that passes the licensing rule, and credit every source in `NOTICE.md`. Until clips exist, the browser voice is the fallback.
8. **Check by hand:** open `/learn/?pack=ja`, do the placement quiz and one lesson, and skim 30 word pages for bad meanings.

A new **base language** (teaching English from French, say) means: add the code to the `Base` type in `src/engine/types.ts`, UI strings in `src/engine/i18n.ts`, glosses into that language for the pack's items (`g.fr`), sentence translations (`tr.fr`), and grammar text in that language.

## Audio and voices

Listen buttons play pre-built clips from `src/a/<pack>/`. The README's [Audio and voices](README.md#audio-and-voices) section explains the pipeline in `scripts/audio/` step by step.

- **Report a bad clip** with a Data fix issue: the page URL, the word or sentence, and what sounds wrong.
- **Propose a voice or recording source** in an issue before running the pipeline. Include its license, the model card or dataset, and why it beats the current one. Voices are compared with Whisper large-v3 scoring and on `/audio-test/`.
- **Rebuilding audio** needs separate Python environments with Piper, Kokoro or Coqui, and `ffmpeg`. Each script's first lines document its usage. Commit the changed bundles in `src/a/<pack>/` together with `data/audio/credits.json`, and run `node scripts/audio-check.mjs` after `npm run build`.

## Code changes

- Engine logic lives in `src/engine/` (pure TypeScript, no DOM except `audio.ts` and `store.ts`). Add a test in `test/engine.test.ts` for behaviour changes.
- The app is plain DOM in `src/app/`; pages are Nunjucks templates in `src/pages/` and `src/_includes/`.
- Keep the site fast and static: no frameworks, no trackers, no accounts.
- Style: match the code around you. TypeScript must pass `npm run typecheck`. Copy uses short paragraphs and plain words.
- Test on a phone-size screen, including iPhone Safari, for anything visual.
- Affiliate settings live only in `src/_data/affiliates.json`. Don't add other affiliate or ad links, and never deploy a `TUTOR_PREVIEW=1` build.

## Branches and pull requests

1. Fork the repo and create a branch from `ux`, for example `data/es-creer-lemma` or `fix/review-timer`.
2. Keep one fix or one feature per pull request.
3. Write clear commit messages that say what changed and why, for example "Spanish: map creo to creer in gloss overrides".
4. Open the pull request against **`ux`**. Changes are previewed at [ux.linguamagna.pages.dev](https://ux.linguamagna.pages.dev), then the maintainer merges `ux` into `main`, which deploys the live site.
5. Fill in the pull request template.

Checks to run before every pull request:

```bash
npm test && npm run build && npm run check
git checkout lastmod.json    # unless page content really changed
```

## Pull request checklist

- [ ] `npm test && npm run build && npm run check` pass.
- [ ] New content is original or from a compatible open license (no CC BY-NC, ND or proprietary material).
- [ ] New sources, recordings or voices are credited in `NOTICE.md` and the pack `credits`.
- [ ] Any new voice or recording meets the commercially clean rule.
- [ ] Regenerated `data/packs/<lang>.json` (and audio bundles, if changed) are included.
- [ ] `lastmod.json` is reverted unless page content changed.
- [ ] No secrets, tokens or account IDs.
- [ ] Checked on a phone-size screen if anything visual changed.

## Licensing of contributions

By contributing you agree that:

- **Code** is released under MIT ([`LICENSE`](LICENSE)).
- **Content** (packs, grammar lessons, translations, overrides, page copy, synthesized audio) is released under CC BY-SA 4.0 ([`LICENSE-CONTENT`](LICENSE-CONTENT)).
- Third-party material you add keeps its own license, and you've credited it in `NOTICE.md`.
- You wrote the contribution yourself, or have the right to contribute it under these terms.

## Never commit secrets

No API tokens, account IDs, `.env` files or credentials. Deploys use the Cloudflare Pages Git integration, so the repo needs none. If you add a script that needs a key, read it from an environment variable and document it.

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

## Be kind

Be kind and patient in issues and reviews. Everyone here is learning something.
