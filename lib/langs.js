// Per-language copy for the SEO layer: hub intros, level blurbs and FAQs.
// Pack data (words, sentences, concepts) comes from data/packs/*.json; this file
// only holds the human-written text around it. Keep paragraphs short, answer first.
module.exports = {
  zh: {
    adj: 'Mandarin', learnName: 'Mandarin Chinese', levelSlug: { foundations: 'foundations', hsk1: 'hsk-1', hsk2: 'hsk-2' },
    hubIntro: 'Learn Mandarin Chinese for free with a mastery course built on the official HSK 3.0 word lists for levels 1 and 2. You start with tones and pinyin, then unlock words, characters and grammar only once you have mastered what they build on.',
    hubMore: [
      'Every word comes with pinyin, a plain English meaning, real example sentences from Tatoeba and the characters it is written with. Characters have stroke order animations and writing drills.',
      'Practice runs in your browser. Spaced review schedules each word to come back right before you would forget it. Progress stays on your device, with no account.',
    ],
    levels: {
      foundations: 'The sound system first: the four tones, the neutral tone, tone pairs, third tone sandhi and the basic stroke order rules.',
      hsk1: 'HSK 1 covers about 500 everyday words: pronouns, numbers, family, food, time and the most common verbs. It is enough for simple, slow conversations.',
      hsk2: 'HSK 2 adds about 770 words for daily life: shopping, travel, weather, health and describing people and things.',
    },
    faqs: [
      { q: 'How many words are in HSK 1 and HSK 2?', a: 'In the HSK 3.0 standard (2021), level 1 has 500 words and level 2 adds 772. This course follows those lists.' },
      { q: 'Do I need to learn characters to learn Mandarin?', a: 'You can start with pinyin, but reading needs characters. This course shows characters from day one, with pinyin, and adds stroke order drills for the most common ones.' },
      { q: 'Is it really free?', a: 'Yes. The course, the word pages and the practice engine are free. Progress is saved in your browser, so there is nothing to sign up for.' },
      { q: 'Which HSK version is this?', a: 'The word lists follow the HSK 3.0 standard published in 2021 (levels 1 and 2). The exam syllabus announced for later years may differ slightly.' },
    ],
  },
  es: {
    adj: 'Spanish', learnName: 'Spanish', levelSlug: { a1: 'a1', a2: 'a2', b1: 'b1' },
    hubIntro: 'Learn Spanish for free with a mastery course: the 2,000 most used Spanish words in frequency order, with original grammar lessons that unlock as you master the words they need.',
    hubMore: [
      'Each word has its English meaning, real example sentences with translations and its level. Grammar lessons cover the core: ser and estar, gender, articles, present tense, the past, questions and more.',
      'Practice runs in your browser with spaced review, so words come back right before you would forget them. Progress stays on your device.',
    ],
    levels: {
      a1: 'A1 is the first 500 words, the ones that make up most of everyday speech: pronouns, the key verbs ser, estar, tener and ir, and common connectors.',
      a2: 'A2 adds the next 750 words for routines, places, food, family and describing things.',
      b1: 'B1 adds 750 more words for opinions, plans, feelings and longer conversations.',
    },
    faqs: [
      { q: 'How many Spanish words do I need?', a: 'The 500 most frequent words cover a large share of everyday speech, and about 2,000 words cover most daily conversation. This course takes you through those 2,000 in order.' },
      { q: 'Is this course free?', a: 'Yes. Every lesson and word page is free and progress is saved in your browser, with no account.' },
      { q: 'Are the levels official CEFR levels?', a: 'The A1, A2 and B1 bands here are frequency based: they group words by how common they are. They line up roughly with CEFR, but they are not an official certification.' },
    ],
  },
  en: {
    adj: 'English', learnName: 'English', levelSlug: { a1: 'a1', a2: 'a2' },
    hubIntro: 'Learn English for free if you speak Spanish, Portuguese or Chinese. The course teaches the 800 most used English words, with translations into your language and grammar lessons explained in your language.',
    hubMore: [
      'Pick the language you speak when you start practicing. Explanations, translations and the app itself switch to that language.',
      'Every word page shows the meaning in Spanish, Portuguese and Chinese, with real example sentences and their translations.',
    ],
    levels: {
      a1: 'A1 is the first 400 words: pronouns, be and have, everyday verbs and the most common little words that hold sentences together.',
      a2: 'A2 adds 400 more words for daily life, work, travel and describing people and things.',
    },
    faqs: [
      { q: 'Can I learn English from Spanish, Portuguese or Chinese here?', a: 'Yes. Choose your language when you start. Translations, grammar explanations and the app interface switch to it. ¿Hablas español? Elige Español. Fala português? Escolha Português. 说中文？选择中文。' },
      { q: 'Is it free?', a: 'Yes, and there is no account. Progress is saved in your browser.' },
    ],
  },
  fr: {
    adj: 'French', learnName: 'French', levelSlug: { a1: 'a1', a2: 'a2' },
    hubIntro: 'Learn French for free with a mastery course: the 600 most used French words in frequency order, real example sentences and short grammar lessons that unlock as you go.',
    hubMore: ['This is a starter course. It covers the core words and the first grammar points, with more on the way.', 'Practice runs in your browser with spaced review. Progress stays on your device.'],
    levels: { a1: 'A1 is the first 300 words, the backbone of everyday French.', a2: 'A2 adds the next 300 words for daily life.' },
    faqs: [
      { q: 'Is this French course free?', a: 'Yes. Every page and the practice engine are free, with no account.' },
    ],
  },
  it: {
    adj: 'Italian', learnName: 'Italian', levelSlug: { a1: 'a1', a2: 'a2' },
    hubIntro: 'Learn Italian for free with a mastery course: the 600 most used Italian words in frequency order, real example sentences and short grammar lessons that unlock as you go.',
    hubMore: ['This is a starter course. It covers the core words and the first grammar points, with more on the way.', 'Practice runs in your browser with spaced review. Progress stays on your device.'],
    levels: { a1: 'A1 is the first 300 words, the backbone of everyday Italian.', a2: 'A2 adds the next 300 words for daily life.' },
    faqs: [
      { q: 'Is this Italian course free?', a: 'Yes. Every page and the practice engine are free, with no account.' },
    ],
  },
  pt: {
    adj: 'Portuguese', learnName: 'Portuguese', levelSlug: { a1: 'a1', a2: 'a2' },
    hubIntro: 'Learn Portuguese for free with a mastery course: the 600 most used Portuguese words in frequency order, real example sentences and short grammar lessons that unlock as you go.',
    hubMore: ['This is a starter course. Words and sentences mix Brazilian and European usage, as they appear in the sources.', 'Practice runs in your browser with spaced review. Progress stays on your device.'],
    levels: { a1: 'A1 is the first 300 words, the backbone of everyday Portuguese.', a2: 'A2 adds the next 300 words for daily life.' },
    faqs: [
      { q: 'Is this Portuguese course free?', a: 'Yes. Every page and the practice engine are free, with no account.' },
      { q: 'Is it Brazilian or European Portuguese?', a: 'Both appear. The word list and sentences come from mixed sources, and grammar notes point out the main differences.' },
    ],
  },
  de: {
    adj: 'German', learnName: 'German', levelSlug: { a1: 'a1', a2: 'a2' },
    hubIntro: 'Learn German for free with a mastery course: the 600 most used German words in frequency order, real example sentences and short grammar lessons that unlock as you go.',
    hubMore: ['This is a starter course. It covers the core words and the first grammar points, with more on the way.', 'Practice runs in your browser with spaced review. Progress stays on your device.'],
    levels: { a1: 'A1 is the first 300 words, the backbone of everyday German.', a2: 'A2 adds the next 300 words for daily life.' },
    faqs: [
      { q: 'Is this German course free?', a: 'Yes. Every page and the practice engine are free, with no account.' },
    ],
  },
};
