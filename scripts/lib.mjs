// Helpers shared by the maintenance scripts.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const path = (...p) => join(ROOT, ...p);
export const readJSON = (...p) => JSON.parse(readFileSync(path(...p), 'utf8'));

export function readVersion() {
  const src = readFileSync(path('version.js'), 'utf8');
  const m = src.match(/APP_VERSION\s*=\s*'(\d+)\.(\d+)\.(\d+)'/);
  if (!m) throw new Error('APP_VERSION not found in version.js');
  return { src, version: `${m[1]}.${m[2]}.${m[3]}`, parts: m.slice(1, 4).map(Number) };
}

// CHANGELOG.md is generated from data/changelog.json (the single source of truth).
export function renderChangelogMd(log) {
  const out = [
    '# Changelog',
    '',
    '<!-- Generated from data/changelog.json by `node scripts/bump-version.mjs --sync`. Do not edit by hand. -->',
    '',
  ];
  for (const v of log) {
    out.push(`## [${v.version}] - ${v.date}`, '');
    for (const c of v.changes.th) out.push(`- ${c}`);
    out.push('', '<details><summary>English</summary>', '');
    for (const c of v.changes.en) out.push(`- ${c}`);
    out.push('', '</details>', '');
  }
  return out.join('\n');
}

// Short content hash of a vocabulary file. languages.json stores it as "rev", the app loads
// data/<file>?rev=<rev>, and the service worker keeps vocabulary per rev, so a deploy only makes
// people download the languages whose words actually changed.
export function vocabRev(file) {
  return createHash('sha256').update(readFileSync(path('data', file))).digest('hex').slice(0, 10);
}

// What languages.json repeats from a vocabulary file (see stamp-vocab.mjs).
export function vocabFacts(file) {
  const vocab = readJSON('data', file);
  return { speech: vocab.speech, words: vocab.sets.reduce((n, s) => n + s.words.length, 0), rev: vocabRev(file) };
}
