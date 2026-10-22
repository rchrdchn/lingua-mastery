# NOTICE: licenses and third-party credits

Lingua Magna has two licenses:

| What | Where | License |
|---|---|---|
| Code: engine, app, site templates, build scripts, tests | `src/engine/`, `src/app/`, `src/**/*.njk`, `scripts/`, `lib/`, `test/`, config files | MIT, see [`LICENSE`](LICENSE) |
| Content: language-pack data, grammar lessons, word overrides, page copy | `data/packs/*.json`, `content/`, `lib/langs.js` text, `src/*.md` | CC BY-SA 4.0, see [`LICENSE-CONTENT`](LICENSE-CONTENT) |

The pack data is CC BY-SA 4.0 because it is built from CC BY-SA sources (CC-CEDICT, Wiktionary, FrequencyWords lists). If you reuse it, keep the attribution below and share changes under the same license. Tatoeba sentences inside the packs stay under CC BY 2.0 FR, and each sentence carries its author (`a`) and translators (`ta`); keep those credits when you show a sentence.

## Third-party datasets

| Source | Used for | License | Link |
|---|---|---|---|
| ivankra/hsk30 | HSK 3.0 (2021 standard) word lists, levels 1-2, pinyin, part of speech | MIT | https://github.com/ivankra/hsk30 |
| CC-CEDICT | Mandarin English definitions, numbered pinyin, measure words, traditional forms; Chinese glosses for the English (ESL) pack | CC BY-SA 4.0 | https://cc-cedict.org/ |
| Tatoeba | Example sentences, translations, authors (all packs) | CC BY 2.0 FR | https://tatoeba.org/ (downloads: https://tatoeba.org/downloads) |
| Wiktionary via kaikki.org (Wiktextract) | Glosses, part of speech, IPA, inflected forms (es, fr, it, pt, de); English Wiktionary translation tables (Spanish, Portuguese, Mandarin) and reverse glosses for the English pack | CC BY-SA 4.0 (and GFDL) | https://kaikki.org/ |
| FrequencyWords (Hermit Dave), from OpenSubtitles 2018 | Frequency ranks for es, fr, it, pt, de, en | Lists CC BY-SA 4.0, code MIT | https://github.com/hermitdave/FrequencyWords |
| Make Me a Hanzi stroke data, via hanzi-writer-data | Stroke order graphics, stroke counts | Arphic Public License (`ARPHICPL.TXT`, copied next to the stroke files at build time) | https://github.com/skishore/makemeahanzi, https://github.com/chanind/hanzi-writer-data |
| Unihan (Unicode) | Not used in v1. Listed so contributors know it is a vetted option for readings and radicals (Unicode License). | Unicode License v3 | https://www.unicode.org/charts/unihan.html |

## Audio

All listen buttons play pre-generated MP3 clips stored in `src/a/` (built by `scripts/audio/`). Two sources:

| Source | Used for | License | Link |
|---|---|---|---|
| Lingua Libre recordings on Wikimedia Commons | Single-word audio for Spanish, French, Italian and German where a recording exists. Each word page names the speaker, license and Commons file; `data/audio/credits.json` lists every file. | Per file: CC BY-SA 4.0, CC BY 4.0 or CC0. Clips were trimmed, loudness-normalized and re-encoded; modified CC BY-SA recordings stay CC BY-SA 4.0. | https://lingualibre.org/ , https://commons.wikimedia.org/wiki/Category:Lingua_Libre_pronunciation |
| Piper text-to-speech (run offline at build time) | All other words, all characters and all sentences. Mandarin words are synthesized from the pack's own pinyin; Mandarin sentences use g2pW readings with known words forced to their dictionary pinyin. | Piper is GPL-3.0 (used as a tool only; not shipped). Voices: zh_CN chaowen (CC0 dataset), es_ES davefx (CC0), en_US LJSpeech high (public domain), fr_FR SIWIS (CC BY 4.0), it_IT serena high (CC BY 4.0), pt_BR faber (CC0), de_DE Thorsten high (CC0). | https://github.com/OHF-Voice/piper1-gpl , https://huggingface.co/rhasspy/piper-voices |

The synthesized clips are released with the content under CC BY-SA 4.0. The SIWIS (CC BY 4.0, University of Edinburgh / Idiap) and serena (CC BY 4.0) voice datasets are credited here and on `/credits/`.

## Software

| Package | Used for | License |
|---|---|---|
| Hanzi Writer | Stroke animations and writing quizzes | MIT |
| ts-fsrs | FSRS spaced review scheduling | MIT |
| Eleventy | Static site build | MIT |
| esbuild | Bundling the TypeScript app | MIT |
| TypeScript | Type checking | Apache-2.0 |
| Playwright | End-to-end check (dev only) | Apache-2.0 |

## Ideas

The mastery model (concept graph with prerequisites, mastery states unseen / learning / practicing / mastered / decaying, streak plus speed thresholds, a review share in each session and periodic mastery checks) is adapted from **Mathua** (MIT), https://github.com/chuma-beep/mathua. No Mathua code or content is copied; Mathua's math content is CC BY-NC and is not used.

## Original content

Grammar lessons in `content/grammar/`, hand-checked translations in `content/en-overrides.json`, gloss fixes in `content/gloss-overrides/` and the page copy were written for this project and are CC BY-SA 4.0.
