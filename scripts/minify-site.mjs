// Minifies the JSON files of a built site in place (pages.yml runs it on _site before upload).
// The repository keeps one word per line so diffs stay readable; visitors get the compact form.
//   node scripts/minify-site.mjs _site
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node scripts/minify-site.mjs <site dir>');
  process.exit(1);
}
let before = 0;
let after = 0;
const walk = (d) => {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.json')) {
      const src = readFileSync(p, 'utf8');
      const out = JSON.stringify(JSON.parse(src));
      writeFileSync(p, out);
      before += Buffer.byteLength(src);
      after += Buffer.byteLength(out);
    }
  }
};
walk(join(dir, 'data'));
console.log(`JSON: ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB`);
