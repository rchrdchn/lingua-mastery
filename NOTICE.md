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

All listen buttons play pre-generated MP3 clips stored in `src/a/` (built by `scripts/audio/`). Sources:

| Source | Used for | License | Link |
|---|---|---|---|
| Lingua Libre recordings on Wikimedia Commons | Single-word audio for Spanish, English (General American speakers only), Portuguese (Brazilian speakers only, checked for Brazilian /ti di/ palatalization; European Portuguese speakers are left out; 12 more words from Brazilian `Pt-br-<word>.ogg` uploads on Commons), French (France French speakers only, checked for the absence of Quebec /ti ty di dy/ affrication; 1 word from a Shtooka `Fr-<word>.ogg` upload, CC BY 2.0 FR), Italian (26 more words from `It-<word>.ogg` uploads on Commons, 12 of them Shtooka-project recordings by Marta Carbone, CC BY 3.0 US), German and Mandarin where a recording exists. Each word page names the speaker, license and Commons file; `data/audio/credits.json` lists every file. | Per file: CC BY-SA 4.0, CC BY 4.0 or CC0. Clips were trimmed, loudness-normalized and re-encoded; modified CC BY-SA recordings stay CC BY-SA 4.0. | https://lingualibre.org/ , https://commons.wikimedia.org/wiki/Category:Lingua_Libre_pronunciation |
| Shtooka project recordings on Wikimedia Commons (files named `Zh-<pinyin>.ogg`) | Mandarin single words and characters where a recording exists, matched on the course's own tone-marked pinyin (homophones share a clip). Speakers: Wei Gao (Beijing), Yue Tan (Liaoning), Xudong Yang (Henan). Learner uploads and Taiwan-Mandarin Lingua Libre speakers are skipped. | Wei Gao: CC BY 2.0 FR; Yue Tan: CC BY-SA 3.0 US; Xudong Yang: CC BY 2.0. Modified CC BY-SA clips stay CC BY-SA. | https://commons.wikimedia.org/wiki/Category:Chinese_pronunciation |
| Kokoro-82M v1.1-zh text-to-speech, voice zf_002 (run offline at build time) | Mandarin words without a recording and all Mandarin sentences. Words are synthesized from the pack's own pinyin with rule-based tone sandhi (3rd tone, 一, 不); sentences use the model's frontend (jieba, pypinyin, tone sandhi) with known words forced to their dictionary pinyin. Chosen over MeloTTS, CosyVoice2 and Piper by a Whisper comparison (see `/audio-test/`). | Apache-2.0 (model and voices). Per the model card, the 100 Chinese voices were trained on data LongMaoData granted to the model authors free of charge; some crowdsourced synthetic English data was also in the training mix. | https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh |
| Kokoro-82M v1.0 text-to-speech, voice em_alex (run offline at build time) | Spanish words without a recording and all Spanish sentences. Chosen over four Piper and Kokoro voices by Whisper large-v3 scoring (see /audio-test/). | Apache-2.0 | https://huggingface.co/hexgrad/Kokoro-82M |
| Kokoro-82M v1.0 text-to-speech, voice af_heart (run offline at build time) | English words without a recording and English sentences without a Tatoeba recording. Chosen over six Kokoro, six Piper and one MeloTTS voice by Whisper large-v3 scoring (see /audio-test/). | Apache-2.0 | https://huggingface.co/hexgrad/Kokoro-82M |
| Tatoeba sentence recordings | English, French and Italian sentences where a Tatoeba audio file carries its own CC BY or CC BY-SA license (English: rul, Them, Auride, amychang, all checked as North American; French: vlecomte, France French; Italian: NM1). Clips without a reuse license, or with NC/ND terms, are skipped. `data/audio/credits.json` lists each clip. | Per clip: CC BY 4.0 or CC BY-SA 4.0. | https://tatoeba.org/ |
| Kokoro-82M v1.0 text-to-speech, voice pf_dora (run offline at build time) | Brazilian Portuguese words without a recording and all Portuguese sentences. Chosen over two other Kokoro and four Piper pt_BR voices by Whisper large-v3 scoring (see /audio-test/). | Apache-2.0 | https://huggingface.co/hexgrad/Kokoro-82M |
| Kokoro-82M v1.0 text-to-speech, voice ff_siwis (run offline at build time) | French words without a recording and French sentences without a Tatoeba recording. Second by Whisper large-v3 scoring (see /audio-test/) behind Piper fr_FR tom, which was not used because its fine-tuning base checkpoint is undocumented; every other Piper fr_FR voice was fine-tuned from the lessac or ryan English voices, whose base data is not openly licensed, or was unintelligible (MLS). | Apache-2.0 | https://huggingface.co/hexgrad/Kokoro-82M |
| Piper text-to-speech (run offline at build time) | Italian words without a recording and Italian sentences without a Tatoeba recording (voice it_IT serena high, chosen over serena medium, riccardo x_low and Kokoro if_sara / im_nicola by Whisper large-v3 scoring, see /audio-test/; paola was skipped as a lessac fine-tune); all German words and sentences (de_DE Thorsten high). | Piper is GPL-3.0 (used as a tool only; not shipped). Voices: it_IT serena high, trained from scratch on the CC BY 4.0 synthetic dataset committa/serena-synthetic-it-27h (generated with Qwen3-TTS, Apache-2.0); de_DE Thorsten high (CC0). | https://github.com/OHF-Voice/piper1-gpl , https://huggingface.co/rhasspy/piper-voices |

The synthesized clips are released with the content under CC BY-SA 4.0. The serena (CC BY 4.0) voice dataset is credited here and on `/credits/`.

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
