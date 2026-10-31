// Checks vocabulary data, versioning and offline cache list.
// Run with `node scripts/validate.mjs` (CI runs it before every deploy).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { path, readJSON, readVersion, renderChangelogMd } from './lib.mjs';

const errors = [];
const warnings = [];

// ---------- vocabulary ----------
const index = readJSON('data', 'languages.json');
const targetCodes = index.translate.map((x) => x.code);

for (const lang of index.learn) {
  const vocab = readJSON('data', lang.file);
  const where = (...p) => [lang.code, ...p].join(' › ');

  if (vocab.code !== lang.code) errors.push(`${where()}: code mismatch (${vocab.code})`);
  if (!vocab.speech) errors.push(`${where()}: missing "speech" language tag`);
  if (!vocab.license) errors.push(`${where()}: missing "license"`);

  const setIds = new Set();
  const seenTerms = new Map(); // term → { set, th } across the whole language
  const perLevel = {};
  let total = 0;
  // translations available for this language = those present on every word
  const available = new Set(targetCodes.filter((c) => c !== lang.code));

  for (const set of vocab.sets) {
    if (setIds.has(set.id)) errors.push(`${where(set.id)}: duplicate set id`);
    setIds.add(set.id);
    if (!set.name?.th) errors.push(`${where(set.id)}: missing Thai set name`);
    if (set.words.length < 4) errors.push(`${where(set.id)}: needs at least 4 words`);
    if (![0, 1, 2, 3].includes(set.level)) errors.push(`${where(set.id)}: "level" must be 0 (letters), 1, 2 or 3`);
    perLevel[set.level] = (perLevel[set.level] || 0) + set.words.length;

    const terms = new Set();
    const answers = new Map();
    for (const w of set.words) {
      total++;
      if (!w.term) errors.push(`${where(set.id)}: word without term`);
      if (terms.has(w.term)) errors.push(`${where(set.id, w.term)}: duplicate term in set`);
      terms.add(w.term);
      // A word may appear in two sets only as a homonym (different meaning, with a note).
      const prev = seenTerms.get(w.term);
      if (prev && prev.set !== set.id) {
        if (prev.th === w.tr?.th || !w.note) errors.push(`${where(set.id, w.term)}: already in ${prev.set}; keep one, or add a note if it is a different word`);
      } else if (!prev) seenTerms.set(w.term, { set: set.id, th: w.tr?.th });
      if (!w.tr?.th) errors.push(`${where(set.id, w.term)}: missing Thai translation`);
      if (w.reading === w.term) warnings.push(`${where(set.id, w.term)}: reading equals term, omit it`);
      for (const c of [...available]) if (!w.tr?.[c]) available.delete(c);
      for (const [c, text] of Object.entries(w.tr || {})) {
        const k = `${c}:${text}`;
        if (answers.has(k)) warnings.push(`${where(set.id)}: "${answers.get(k)}" and "${w.term}" share ${c} translation "${text}"`);
        else answers.set(k, w.term);
      }
    }
  }
  const levels = Object.entries(perLevel).map(([lv, n]) => (lv === '0' ? `letters ${n}` : `L${lv} ${n}`)).join(' / ');
  console.log(`${lang.code}: ${vocab.sets.length} sets, ${total} words (${levels}), translations: ${[...available].join(', ') || '(none)'}`);
}

// ---------- version & changelog ----------
const { version } = readVersion();
const log = readJSON('data', 'changelog.json');
if (log[0]?.version !== version) errors.push(`changelog: newest entry is ${log[0]?.version}, but version.js says ${version}`);
const seen = new Set();
for (const v of log) {
  if (seen.has(v.version)) errors.push(`changelog: duplicate version ${v.version}`);
  seen.add(v.version);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date || '')) errors.push(`changelog ${v.version}: bad date`);
  for (const l of ['th', 'en']) {
    if (!v.changes?.[l]?.length) errors.push(`changelog ${v.version}: no "${l}" changes written`);
  }
}
const md = existsSync(path('CHANGELOG.md')) ? readFileSync(path('CHANGELOG.md'), 'utf8') : '';
if (md !== renderChangelogMd(log)) errors.push('CHANGELOG.md is out of date: run `node scripts/bump-version.mjs --sync`');
console.log(`version: ${version}, changelog entries: ${log.length}`);

// ---------- guide ----------
const { GUIDE } = await import('../assets/js/guide.js');
const ids = (l) => (GUIDE[l] || []).map((s) => s.id).join(',');
if (ids('th') !== ids('en')) errors.push('guide: Thai and English sections differ');

// ---------- offline cache list ----------
const sw = readFileSync(path('sw.js'), 'utf8');
const mustCache = [
  'index.html', 'version.js', 'manifest.webmanifest', 'assets/css/style.css',
  ...readdirSync(path('assets/js')).filter((f) => f.endsWith('.js')).map((f) => `assets/js/${f}`),
  'data/languages.json', 'data/changelog.json',
  ...index.learn.map((l) => `data/${l.file}`),
];
for (const f of mustCache) {
  if (!sw.includes(`'${f}'`)) errors.push(`sw.js: CORE is missing '${f}'`);
}
const html = readFileSync(path('index.html'), 'utf8');
for (const m of html.matchAll(/(?:href|src)="(assets\/[^"]+)"/g)) {
  if (!existsSync(path(m[1]))) errors.push(`index.html references missing file ${m[1]}`);
}

for (const w of warnings) console.warn(`warn: ${w}`);
for (const e of errors) console.error(`error: ${e}`);
if (errors.length) process.exit(1);
console.log('OK');
