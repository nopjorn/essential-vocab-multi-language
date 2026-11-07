// Writes facts derived from each vocabulary file into data/languages.json: its content hash ("rev"),
// word count ("words") and speech tag ("speech"), so pages that only need those (Progress overview,
// Settings voice check) don't download every language.
// Run after changing any data/vocab/*.json:  node scripts/stamp-vocab.mjs
// (validate.mjs fails when they are out of date). Keeps the one-language-per-line layout.
import { readFileSync, writeFileSync } from 'node:fs';
import { path, vocabRev, vocabFacts } from './lib.mjs';

const file = path('data', 'languages.json');
let changed = 0;
const out = readFileSync(file, 'utf8').split('\n').map((line) => {
  const m = line.match(/^(\s*)(\{"code": .*\})(,?)$/);
  if (!m) return line;
  const lang = JSON.parse(m[2]);
  if (!lang.file) return line;
  const facts = vocabFacts(lang.file);
  if (Object.entries(facts).some(([k, v]) => lang[k] !== v)) changed++;
  const { rev: _r, words: _w, speech: _s, ...rest } = lang;
  const entries = Object.entries({ ...rest, ...facts }).map(([k, v]) => `${JSON.stringify(k)}: ${fmt(v)}`);
  return `${m[1]}{${entries.join(', ')}}${m[3]}`;
});
function fmt(v) {
  return v && typeof v === 'object' ? `{${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${fmt(x)}`).join(', ')}}` : JSON.stringify(v);
}
writeFileSync(file, out.join('\n'));
console.log(changed ? `languages.json: ${changed} language(s) updated` : 'languages.json: up to date');
