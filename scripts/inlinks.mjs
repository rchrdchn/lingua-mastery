// Every URL in the sitemap needs at least 2 inbound internal links from other pages (SEO playbook rule).
import fs from 'node:fs'; import path from 'node:path';
const OUT = path.resolve('_site'); const site = JSON.parse(fs.readFileSync('src/_data/site.json', 'utf8'));
const urls = [...fs.readFileSync(path.join(OUT, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].replace(site.url, ''));
const count = new Map(urls.map(u => [u, new Set()]));
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => { const p = path.join(d, e.name); return e.isDirectory() ? (e.name === 'assets' ? [] : walk(p)) : e.name.endsWith('.html') ? [p] : []; });
for (const f of walk(OUT)) {
  const from = '/' + path.relative(OUT, f).replace(/index\.html$/, '');
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/href="(\/[^"#?]*)"/g)) { const u = m[1]; if (u !== from && count.has(u)) count.get(u).add(from); }
}
const weak = [...count].filter(([u, s]) => u !== '/' && s.size < 2);
console.log(weak.length ? `${weak.length} sitemap URLs with <2 inbound links:\n` + weak.slice(0, 30).map(([u, s]) => `${u} (${s.size})`).join('\n') : `All ${urls.length} sitemap URLs have 2+ inbound links`);
process.exit(weak.length ? 1 : 0);
