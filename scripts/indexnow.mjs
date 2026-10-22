// IndexNow: send only the URLs that postbuild found new, changed or removed (.indexnow.json).
// Run after the deploy is live: npm run indexnow   (npm run indexnow -- --all resends the whole sitemap)
import { readFileSync, existsSync } from 'node:fs';
const site = JSON.parse(readFileSync(new URL('../src/_data/site.json', import.meta.url)));
let urls;
if (process.argv.includes('--all')) urls = [...readFileSync(new URL('../_site/sitemap.xml', import.meta.url), 'utf8').matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
else { const f = new URL('../.indexnow.json', import.meta.url); urls = existsSync(f) ? JSON.parse(readFileSync(f)).urls : []; }
if (!urls.length) { console.log('IndexNow: nothing changed, nothing sent'); process.exit(0); }
const host = new URL(site.url).host;
for (let i = 0; i < urls.length; i += 10000) {
  const r = await fetch('https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key: site.indexNowKey, keyLocation: `${site.url}/${site.indexNowKey}.txt`, urlList: urls.slice(i, i + 10000) }) });
  console.log('IndexNow', r.status, urls.slice(i, i + 10000).length, 'urls');
}
