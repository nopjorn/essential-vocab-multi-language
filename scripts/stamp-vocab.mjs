// Writes each vocabulary file's content hash into data/languages.json ("rev").
// Run after changing any data/vocab/*.json:  node scripts/stamp-vocab.mjs
// (validate.mjs fails when a rev is out of date). Keeps the one-language-per-line layout.
import { readFileSync, writeFileSync } from 'node:fs';
import { path, vocabRev } from './lib.mjs';

const file = path('data', 'languages.json');
let changed = 0;
const out = readFileSync(file, 'utf8').split('\n').map((line) => {
  const m = line.match(/^(\s*)(\{"code": .*\})(,?)$/);
  if (!m) return line;
  const lang = JSON.parse(m[2]);
  if (!lang.file) return line;
  const rev = vocabRev(lang.file);
  if (lang.rev !== rev) changed++;
  const { rev: _old, ...rest } = lang;
  const entries = Object.entries({ ...rest, rev }).map(([k, v]) => `${JSON.stringify(k)}: ${fmt(v)}`);
  return `${m[1]}{${entries.join(', ')}}${m[3]}`;
});
function fmt(v) {
  return v && typeof v === 'object' ? `{${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${fmt(x)}`).join(', ')}}` : JSON.stringify(v);
}
writeFileSync(file, out.join('\n'));
console.log(changed ? `languages.json: ${changed} rev(s) updated` : 'languages.json: revs up to date');
