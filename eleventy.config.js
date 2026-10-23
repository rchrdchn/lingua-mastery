// Eleventy config. Pages are generated from data/packs/*.json through src/_data/lm.js.
const seo = require('./lib/seo.js');
const site = require('./src/_data/site.json');

module.exports = function (c) {
  c.addPassthroughCopy({ 'src/assets': 'assets' });
  c.addPassthroughCopy({ 'data/packs': 'packs' });
  c.addPassthroughCopy({ 'src/a': 'a' });
  // Audio bundle path for an owner (word, character, lesson, demo), only if the file exists.
  const { bundlePath, bundleUrl, audioVersions } = require('./lib/audiokey.js');
  c.addGlobalData('audioV', () => audioVersions(['zh', 'es', 'en', 'fr', 'it', 'pt', 'de']));
  const fsA = require('node:fs');
  const have = {};
  const files = pack => (have[pack] ||= new Set(fsA.existsSync(`src/a/${pack}`) ? fsA.readdirSync(`src/a/${pack}`) : []));
  c.addFilter('apath', (pack, owner) => { const p = bundlePath(pack, owner); return files(pack).has(p.split('/').pop()) ? bundleUrl(pack, owner) : ''; });
  ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'og.png', 'site.webmanifest', '_headers', '_redirects', 'robots.txt'].forEach(f => c.addPassthroughCopy('src/' + f));
  c.addWatchTarget('src/assets/');

  c.addFilter('json', v => JSON.stringify(v).replace(/</g, '\\u003c'));
  c.addFilter('seoTitle', s => seo.seoTitle(s));
  c.addFilter('seoDesc', s => seo.seoDesc(s));
  c.addFilter('xml', s => seo.plain(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
  c.addFilter('first', (s, n = 60) => { const t = String(s || '').split(';')[0].trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t; });
  c.addFilter('sitemapPages', ps => ps.filter(p => p.url && p.url.endsWith('/') && !p.data.noindex && !(p.data.w && p.data.w.noindex) && !(p.data.ch && p.data.ch.noindex)).sort((a, b) => a.url === '/' ? -1 : b.url === '/' ? 1 : a.url.localeCompare(b.url)));
  // Highlight the first occurrence of a word in a sentence (HTML-escaped).
  c.addFilter('hl', (s, w) => {
    const esc = x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const t = String(s || ''), i = w ? t.toLowerCase().indexOf(String(w).toLowerCase()) : -1;
    return i < 0 ? esc(t) : esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + w.length)) + '</mark>' + esc(t.slice(i + w.length));
  });
  c.addFilter('rfc822', d => new Date(d).toUTCString());
  c.addShortcode('updated', () => '<p class="upd">Updated <time datetime="__LASTMOD_ISO__">__LASTMOD__</time></p>');

  // One JSON-LD graph per page: Organization + WebSite by @id, then the page node.
  // Hubs are Course + CollectionPage, level pages are CollectionPage with an ItemList,
  // word pages are DefinedTerm pages, grammar pages are LearningResource articles.
  c.addFilter('pageGraph', d => {
    const url = site.url + d.url;
    const org = { '@type': 'Organization', '@id': site.url + '/#org', name: site.name, url: site.url + '/' };
    const web = { '@type': 'WebSite', '@id': site.url + '/#website', name: site.name, url: site.url + '/', publisher: { '@id': org['@id'] }, inLanguage: 'en' };
    const pg = { '@type': d.kind || 'WebPage', '@id': url + '#webpage', url, name: seo.seoTitle(d.title), description: seo.seoDesc(d.description), isPartOf: { '@id': web['@id'] }, inLanguage: 'en', dateModified: '__LASTMOD_ISO__' };
    const g = [org, web, pg];
    if (d.items && d.items.length) pg.mainEntity = { '@type': 'ItemList', numberOfItems: d.items.length, itemListElement: d.items.slice(0, 500).map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, url: site.url + x.url })) };
    if (d.course) g.push({ '@type': 'Course', '@id': url + '#course', name: d.course.name, description: seo.seoDesc(d.description), provider: { '@id': org['@id'] }, inLanguage: d.course.inLanguage, isAccessibleForFree: true, educationalLevel: d.course.level, url,
      offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD', category: 'Free' }, hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'online', courseWorkload: 'PT10M' } });
    if (d.term) { g.push({ '@type': 'DefinedTerm', '@id': url + '#term', name: d.term.name, description: d.term.description, inLanguage: d.term.lang, inDefinedTermSet: { '@type': 'DefinedTermSet', name: d.term.set, url: site.url + d.term.setUrl } }); pg.mainEntity = { '@id': url + '#term' }; }
    if (d.lesson) g.push({ '@type': 'LearningResource', '@id': url + '#lesson', name: d.lesson.name, learningResourceType: 'Lesson', educationalLevel: d.lesson.level, inLanguage: 'en', isAccessibleForFree: true, teaches: d.lesson.teaches, publisher: { '@id': org['@id'] }, license: 'https://creativecommons.org/licenses/by-sa/4.0/' });
    if (d.faqs && d.faqs.length) g.push({ '@type': 'FAQPage', '@id': url + '#faq', mainEntity: d.faqs.map(x => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })) });
    return JSON.stringify({ '@context': 'https://schema.org', '@graph': g }).replace(/</g, '\\u003c');
  });
  c.addTransform('crumbsLd', function (html) {
    if (!(this.page.outputPath || '').endsWith('.html')) return html;
    const ld = seo.crumbsLd(html, this.page.url, site.url);
    return ld ? html.replace('</head>', ld + '</head>') : html;
  });
  return { dir: { input: 'src', includes: '_includes', data: '_data', output: '_site' }, markdownTemplateEngine: 'njk', htmlTemplateEngine: 'njk' };
};
