// npm run data:lint  -> lists flagged primary glosses in the top words of every pack; exits 1 if any.
import fs from 'node:fs';
import { lintPack, LINT_TOP } from './gloss-lint.mjs';
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['es', 'en', 'fr', 'it', 'pt', 'de'];
let total = 0;
for (const id of ids) {
  const pack = JSON.parse(fs.readFileSync(`data/packs/${id}.json`, 'utf8'));
  const bad = lintPack(pack);
  total += bad.length;
  console.log(`${id}: ${bad.length} flagged in top ${LINT_TOP}`);
  for (const b of bad) console.log(`  ${b.word} [${b.base}] ${b.reason}: ${b.gloss}`);
}
process.exit(total ? 1 : 0);
