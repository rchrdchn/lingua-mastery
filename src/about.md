---
layout: base.njk
title: "About Lingua Magna and how the courses work"
description: "How the courses are built: mastery gating, placement, spaced review with FSRS, the data sources and what is free. No account, progress stays in your browser."
kind: AboutPage
permalink: /about/
---
<p class="crumbs"><a href="/">Home</a> / About</p>

# About Lingua Magna

<p class="lead">Lingua Magna ("great language" in Latin) is a free set of language courses built on one idea: don't just learn a language, master it. In practice: learn each piece until you have mastered it, then unlock what builds on it. It runs entirely in your browser.</p>

{% updated %}

## How the engine works

Each course is a graph of small concepts. A concept is a group of 8 to 10 words, a grammar point, or for Mandarin a tone or stroke skill. Every concept lists the concepts it needs first.

A concept is mastered when you get a streak of answers right at a comfortable speed. The streak and the time target are set per concept. A wrong answer resets the streak.

Every word has its own review card, scheduled with the open FSRS algorithm. About 30% of each session is review. Every 50 XP there is a short mastery check on older material, and concepts you have not seen for 14 days are marked for review.

The engine design follows the open source Mathua project (MIT license), a mastery-learning system for math. The code here is new and written for languages.

## Exercise types

- **Recognition:** see a word, pick its meaning.
- **Recall:** see a meaning, pick or type the word. Typing accepts missing accents with a gentle note.
- **Cloze:** fill the gap in a real sentence.
- **Listening:** hear a word, pick its meaning. Uses your browser's built-in voices when one exists for the language.
- **Tones (Mandarin):** pick the right tone marks, including tone changes.
- **Writing (Mandarin):** draw characters stroke by stroke.

## Where the content comes from

Word lists, dictionaries and sentences come from open sources: the HSK 3.0 list, CC-CEDICT, Wiktionary (via Kaikki), frequency lists built from OpenSubtitles, and Tatoeba sentences. Grammar lessons are written for this site. See [credits](/credits/) for every source and license.

{% if site.showFeedbackLink and site.repoUrl %}<h2 id="feedback">Feedback</h2>

<p>Spotted a wrong translation, a bad recording or a bug? <a href="{{ site.repoUrl }}/issues/new/choose" rel="noopener">Feedback / report an issue</a>. Each word page also has a "Report a problem with this word" link that fills in the word for you.</p>
{% endif %}
<h2 id="open-source">Open source</h2>

The whole project is open source. The engine, app and site code are MIT licensed. The course content (word data, grammar lessons, translations) is CC BY-SA 4.0, so you can reuse and adapt it as long as you credit the sources and share changes under the same license. Tatoeba sentences keep their CC BY 2.0 FR license and author credits.

Contributions are welcome, especially fixes to word meanings, new grammar lessons and new language packs. The repository includes a guide to adding a language.

## Your data

There are no accounts. Progress lives in your browser's local storage. You can export it to a file from the practice settings. See [privacy](/privacy/).
