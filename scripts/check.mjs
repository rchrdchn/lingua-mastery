// Internal link check over _site: every href="/..." must resolve to a built file.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('../_site/', import.meta.url).pathname, bad = [];
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') ? [p] : []; });
for (const f of walk(root)) for (const m of readFileSync(f, 'utf8').matchAll(/href="(\/[^"#?]*)/g)) {
  const u = m[1], p = join(root, u, u.endsWith('/') ? 'index.html' : '');
  if (!existsSync(p)) bad.push(`${f.replace(root, '/')} -> ${u}`);
}
console.log(bad.length ? bad.join('\n') : 'All internal links OK');
process.exit(bad.length ? 1 : 0);
