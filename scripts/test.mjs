// Bundles test/*.test.ts with esbuild and runs them with node:test.
import { build } from 'esbuild'; import fs from 'node:fs'; import { spawnSync } from 'node:child_process';
const files = fs.readdirSync('test').filter(f => f.endsWith('.test.ts'));
fs.mkdirSync('.tmp-test', { recursive: true });
await build({ entryPoints: files.map(f => `test/${f}`), bundle: true, platform: 'node', format: 'esm', outdir: '.tmp-test', outExtension: { '.js': '.mjs' }, packages: 'external', logLevel: 'warning' });
const r = spawnSync(process.execPath, ['--test', ...files.map(f => `.tmp-test/${f.replace(/\.ts$/, '.mjs')}`)], { stdio: 'inherit' });
fs.rmSync('.tmp-test', { recursive: true, force: true });
process.exit(r.status ?? 1);
