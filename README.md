# Lingua Magna

**Don't just learn a language. Master it.** Lingua Magna is Latin for "great language". Free, open source, mastery-based language courses that run in the browser: **Mandarin Chinese** (HSK 3.0 levels 1-2), **Spanish** (2,000 words, A1-B1), **English for Spanish, Portuguese and Chinese speakers**, and starter courses in **French, Italian, Portuguese and German**.

Think "Math Academy for languages": a placement quiz, a skill graph where each concept unlocks only once its prerequisites are mastered, FSRS spaced review, and mastery checks. No accounts. Progress lives in the learner's browser.

On top of the app there is a free SEO layer generated from the same data: a hub per language, level pages, a page for every word and Mandarin character, and a page for every grammar lesson, all linking into practice.

**Open source:** code is MIT ([`LICENSE`](LICENSE)); course content and pack data are CC BY-SA 4.0 ([`LICENSE-CONTENT`](LICENSE-CONTENT)). Every third-party dataset and license is in [`NOTICE.md`](NOTICE.md). Want to fix a word or add a language? See [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## What it does

| Part | What the learner gets |
|---|---|
| **Placement** (`/learn/?pack=zh&placement=1`) | Each level is split into two bands. 5 questions per band; 4 right marks the band (and everything before it) as mastered and seeds review cards. Stops at the first failed band. |
| **Skill graph** | Concepts are groups of 8-10 words, grammar lessons, and for Mandarin tones and stroke skills. Each lists prerequisites. The map on the dashboard shows status per concept. |
| **Mastery** | Ported from Mathua (MIT): unseen, learning, practicing, mastered, decaying. Mastered = a streak of correct answers (6-8) at an average speed under the concept's time target. 14 days unseen = decaying. |
| **Scheduler** | Keeps working the frontier of unlocked concepts (in-progress first, then by level and graph depth so word tracks interleave), with about 30% of each 10-exercise session from due reviews. A 5-question mastery check every 50 XP. |
| **Spaced review** | Every word (and drawn character) has its own FSRS card via `ts-fsrs`. Grade comes from correctness and speed. |
| **Exercises** | Recognition (word to meaning), recall (meaning to word; typed for Latin-script languages, accent-tolerant), cloze from real Tatoeba sentences, listening via `speechSynthesis` when the browser has a voice, Mandarin tone drills (single tones, neutral tone, tone pairs, sandhi), Hanzi Writer stroke quizzes. |
| **Base language** | The English pack can be taught from Spanish, Portuguese or Chinese. Glosses, sentence translations, grammar explanations and the whole app UI switch with the base. Other packs use English. |
| **Local-first** | `localStorage` keys `lm:v1:<pack>:<base>` and `lm:settings`. Export / import / reset in settings. |

## Counts (v1)

| Pack | Concepts | Words | Characters | Grammar | Sentences | Pages (indexed) |
|---|---|---|---|---|---|---|
| Mandarin (`zh`) | 176 (5 foundations) | 1,221 | 599 | 16 | 3,475 | 1,845 (1,587) |
| Spanish (`es`) | 219 | 2,000 | | 14 | 6,171 | 2,018 (1,973) |
| English ESL (`en`, bases es/pt/zh) | 91 | 800 | | 8 | 2,529 | 811 (802) |
| French (`fr`) | 67 | 600 | | 6 | 1,886 | 609 (607) |
| Italian (`it`) | 67 | 600 | | 6 | 1,901 | 609 (605) |
| Portuguese (`pt`) | 67 | 600 | | 6 | 1,892 | 609 (603) |
| German (`de`) | 68 | 600 | | 6 | 1,876 | 609 (603) |

Word pages with fewer than 2 example sentences, and character pages used by fewer than 2 words, are `noindex` (thin-page rule) and left out of the sitemap.

## How it is built

```
scripts/data/fetch.mjs        downloads raw sources to data/raw/   (gitignored, ~1.5 GB of downloads)
scripts/data/build-packs.mjs  raw sources + content/ -> data/packs/<id>.json   (committed)
content/grammar/<id>.mjs      original grammar lessons (CC BY-SA 4.0)
content/en-overrides.json     hand-checked ESL translations
src/engine/*.ts               the engine: graph, mastery, scheduler, review (FSRS), exercises, placement, session, store, speech, i18n
src/app/main.ts               the /learn/ app (plain DOM)   -> bundled to src/assets/app.js
src/app/strokes.ts            stroke animation on character pages -> src/assets/strokes.js
scripts/bundle.mjs            esbuild bundle + copies Hanzi Writer stroke JSON for the pack's characters to src/assets/strokes/
src/_data/lm.js               turns packs + lib/langs.js copy into page data
src/pages/*.njk               hub, level, word, character and grammar templates (Eleventy pagination)
lib/seo.js                    shared title/description/breadcrumb helpers (same as the other sites)
scripts/postbuild.mjs         real lastmod from content hashes (lastmod.json), fails on long titles / double escaping
scripts/check.mjs             internal link check;  scripts/inlinks.mjs: every sitemap URL has 2+ inbound links
scripts/verify.mjs            Playwright run-through (placement -> lesson -> review), fails on console errors
test/engine.test.ts           engine unit tests, including "every concept in every pack yields valid exercises"
```

Stack: Eleventy 3 (Nunjucks), TypeScript + esbuild, ts-fsrs, Hanzi Writer. No framework, no backend.

SEO: answer-first intros, a visible "Updated" date that matches JSON-LD `dateModified` and sitemap `lastmod`, one JSON-LD graph per page (Organization + WebSite, plus Course on hubs, CollectionPage + ItemList on levels, DefinedTerm on word and character pages, LearningResource on lessons, FAQPage where shown), BreadcrumbList from the visible crumbs, `sitemap.xml`, `llms.txt`, `feed.xml`, and a `robots.txt` that welcomes all crawlers including AI bots. Each course page lists its sources and licenses in the footer.

## Run it

```bash
npm install
npm run build      # typecheck, bundle, Eleventy (~7,100 pages, ~20 s), postbuild checks
npm run serve      # http://localhost:8080/
npm test           # engine tests
npm run check      # links + inbound links
npm run verify     # Playwright with the system Chrome (PW_CHANNEL=chromium to use Playwright's own)
npm run dev        # Eleventy dev server (rerun `npm run engine` after TypeScript changes)
```

## How content and data update

- **Packs are committed.** Cloudflare builds never download sources; they build from `data/packs/*.json`.
- **To refresh or change data:** `npm run data:fetch` (once, or when a source releases an update) then `npm run data:build` (or one pack: `node --max-old-space-size=7000 scripts/data/build-packs.mjs es`). Commit the regenerated JSON. The builder is deterministic, so diffs show real changes.
- **Gloss quality:** `npm run data:lint` checks the top 600 words of each pack for grammar-note or overlong primary glosses (also part of `npm test`). Hand fixes live in `content/gloss-overrides/<lang>.json` and `content/en-overrides.json` (CC BY-SA 4.0).
- **Grammar and copy:** edit `content/grammar/<id>.mjs` or `lib/langs.js`, rebuild the pack (grammar) or just the site (copy).
- **Suggested routine:** refresh Tatoeba and Wiktionary data every 3-6 months (both grow continuously). HSK lists and frequency lists change rarely.
- `lastmod.json` is committed so "Updated" dates only move when a page's content really changes.

## Deploy (Cloudflare Pages)

Same setup as the other sites: a Cloudflare Pages project connected to the GitHub repo.

- **Live preview:** https://linguamagna.pages.dev (Cloudflare Pages project `linguamagna`). Every push to `main` deploys automatically. The repo is still named `lingua-mastery`, and the old project at https://lingua-mastery.pages.dev keeps running until it is retired.
- Production branch `main`, build command `npm run build`, output directory `_site`, environment variable `NODE_VERSION=20` (set in the Pages project; it takes precedence over `.nvmrc`, which pins Node 22 for local work). The build runs on Node 20 or newer.
- `url` in `src/_data/site.json`, the `Sitemap:` line in `src/robots.txt` and every canonical URL use `https://linguamagna.pages.dev`. When a real domain is chosen, change those two files and rebuild; canonicals, sitemap, feed and `llms.txt` follow `site.json`.
- Keep Bot Fight Mode off so AI crawlers can read the site.
- After a deploy is live, `npm run indexnow` pings IndexNow with only the changed URLs (set `indexNowKey` in `site.json` and add the key file first).
- No secrets live in the repo. The Git integration needs none.

Optional settings in `src/_data/site.json`: `cfAnalyticsToken` (Cloudflare Web Analytics), `newsletterUrl` (the signup block is a placeholder until then), `repoUrl` (the footer's source code link; set to https://github.com/rchrdchn/lingua-mastery).

## Notes and known limits

- The Mandarin lists follow the **HSK 3.0 standard published in 2021** (500 + 772 words) via ivankra/hsk30, not a later exam syllabus.
- Glosses for the European packs come from Wiktionary and are mostly good, but some very common function words still have odd or overlong first senses. Fixes go in Wiktionary upstream or as overrides.
- Listening drills only appear when the browser has a voice for the language (most desktop and mobile browsers do; headless browsers usually do not).
- Portuguese mixes Brazilian and European usage, as the sources do.
