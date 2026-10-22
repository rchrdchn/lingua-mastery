// Bundles the TypeScript engine + app into src/assets/*.js with esbuild, and
// copies Hanzi Writer stroke data for every character in the Mandarin pack to
// src/assets/strokes/ (Arphic Public License, see /credits/).
import { build, context } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const watch = process.argv.includes('--watch');
const opts = { entryPoints: { app: 'src/app/main.ts', strokes: 'src/app/strokes.ts', site: 'src/app/site.ts' }, bundle: true, minify: !watch, sourcemap: true, format: 'esm', target: 'es2020', outdir: 'src/assets', logLevel: 'info' };

// Stroke data.
const zh = JSON.parse(fs.readFileSync('data/packs/zh.json', 'utf8'));
const chars = new Set([...(zh.chars || []).map(c => c.c), ...zh.concepts.flatMap(c => c.chars || [])]);
const srcDir = path.dirname(require.resolve('hanzi-writer-data/package.json'));
const outDir = 'src/assets/strokes';
fs.mkdirSync(outDir, { recursive: true });
let n = 0, missing = [];
for (const c of chars) {
  const f = path.join(srcDir, `${c}.json`);
  if (fs.existsSync(f)) { fs.copyFileSync(f, path.join(outDir, `${c}.json`)); n++; } else missing.push(c);
}
fs.copyFileSync(path.join(srcDir, 'ARPHICPL.TXT'), path.join(outDir, 'ARPHICPL.TXT'));
console.log(`strokes: ${n} characters copied${missing.length ? `, missing: ${missing.join('')}` : ''}`);

if (watch) { const ctx = await context(opts); await ctx.watch(); } else await build(opts);
