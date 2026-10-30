// /llms.txt: a plain-text map of the site for AI assistants and crawlers.
module.exports = class {
  data() { return { permalink: '/llms.txt', eleventyExcludeFromCollections: true }; }
  render({ lm, site }) {
    const L = [`# ${site.name}`, '', `> ${site.tagline} Free mastery-based language courses: Mandarin Chinese (HSK 3.0 levels 1-2), Spanish (2,000 words, A1-B1), English for Spanish, Portuguese and Chinese speakers, and starter courses in French, Italian, Portuguese and German. Placement quiz, mastery-gated lessons, FSRS spaced review. Runs in the browser, no account.`, '',
      'Every word page gives the meaning, pronunciation (pinyin for Mandarin), level, frequency rank and real example sentences from Tatoeba with translations and author credit. Grammar pages are original lessons with examples.', '', '## Courses'];
    for (const p of lm.packs) {
      L.push(`- [Learn ${p.adj}](${site.url}${p.hubUrl}): ${p.counts.words} words${p.counts.chars ? `, ${p.counts.chars} characters` : ''}, ${p.counts.grammar} grammar lessons, ${p.counts.concepts} concepts.`);
      for (const l of p.levels) L.push(`  - [${p.adj} ${l.name}](${site.url}${l.url})${l.words ? `: ${l.words} words` : ''}`);
    }
    L.push('', '## Grammar lessons');
    for (const g of lm.grammar) L.push(`- [${g.pack.adj}: ${g.t}](${site.url}${g.url})`);
    L.push('', '## Site', `- [Practice app](${site.url}/learn/)`, `- [About and method](${site.url}/about/)`, `- [Credits and licenses](${site.url}/credits/)`, `- [Privacy](${site.url}/privacy/): no accounts; progress stays in your browser; cookie-free page-view counts only`, `- [RSS feed](${site.url}/feed.xml)`, `- [Sitemap](${site.url}/sitemap.xml)`, `- [Full text of the course hubs, levels and grammar lessons](${site.url}/llms-full.txt)`, '',
      'Word pages follow /<language>/words/<word>/ and Mandarin characters /mandarin/characters/<character>/. Content licenses: Tatoeba CC BY 2.0 FR, CC-CEDICT and Wiktionary-derived data CC BY-SA 4.0, original lessons CC BY-SA 4.0.', '');
    return L.join('\n');
  }
};
