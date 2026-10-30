// Last build step: tag outbound links in every built page (rules in outbound-utm.mjs).
//   node scripts/tag-outbound.mjs <outDir> <site domain> [alias host ...]
// Re-scans after the pass and fails the build if anything is still untagged.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tagHtml } from './outbound-utm.mjs';

async function* htmlFiles(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* htmlFiles(p);
    else if (e.name.endsWith('.html')) yield p;
  }
}

export async function tagDir(dir, opts, { write = true } = {}) {
  let files = 0, links = 0;
  for await (const f of htmlFiles(dir)) {
    const src = await readFile(f, 'utf8');
    const { html, count } = tagHtml(src, opts);
    if (count) { files++; links += count; if (write) await writeFile(f, html); }
  }
  return { files, links };
}

const [dir, site, ...aliases] = process.argv.slice(2);
if (!dir || !site) { console.error('usage: tag-outbound.mjs <outDir> <site> [alias ...]'); process.exit(2); }
const opts = { site, aliases };
const { files, links } = await tagDir(dir, opts);
const left = await tagDir(dir, opts, { write: false });
if (left.links) { console.error(`tag-outbound: ${left.links} outbound links still untagged`); process.exit(1); }
console.log(`tag-outbound: tagged ${links} outbound links in ${files} pages (utm_source=${site.replace(/^www\./, '')})`);
