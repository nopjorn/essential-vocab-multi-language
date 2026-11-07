import test from 'node:test';
import assert from 'node:assert/strict';
import { freshStore } from './setup.mjs';

const KEY = 'ja|food|水';

test('a right answer moves a word up one box and sets its due date', async () => {
  const { store } = await freshStore();
  store.record(KEY, true);
  const p = store.getProgress(KEY);
  assert.equal(p.b, 1);
  assert.equal(p.c, 1);
  assert.equal(p.d - p.t, store.INTERVAL_DAYS[1] * 864e5);
  assert.equal(store.isDue(p), false);
});

test('a wrong answer sends the word back to box 0, due at once', async () => {
  const { store } = await freshStore();
  for (let i = 0; i < 3; i++) store.record(KEY, true);
  store.record(KEY, false);
  const p = store.getProgress(KEY);
  assert.equal(p.b, 0);
  assert.equal(p.w, 1);
  assert.equal(store.isDue(p, p.t), true);
});

test('undoRecord restores the word and the daily counts', async () => {
  const { store } = await freshStore();
  const undo = store.record(KEY, true);
  assert.equal(store.todayAnswers('ja'), 1);
  assert.equal(store.todayNew('ja'), 1);
  store.undoRecord(undo);
  assert.equal(store.getProgress(KEY).t, 0);
  assert.equal(store.todayAnswers('ja'), 0);
  assert.equal(store.todayNew('ja'), 0);
});

test('only the first answer of a word counts as new', async () => {
  const { store } = await freshStore();
  store.record(KEY, true);
  store.record(KEY, false);
  store.record('ja|food|肉', false);
  assert.equal(store.todayAnswers('ja'), 3);
  assert.equal(store.todayNew('ja'), 2);
});

test('a word marked as known is not new when it is answered later', async () => {
  const { store } = await freshStore();
  store.setKnown(KEY, true);
  assert.equal(store.getProgress(KEY).b, store.MASTERED_BOX);
  store.record(KEY, true);
  assert.equal(store.todayNew('ja'), 0);
});

test('isLeech: often wrong and not more often right', () => freshStore().then(({ store }) => {
  assert.equal(store.isLeech({ b: 0, c: 1, w: 4, t: 1 }), true);
  assert.equal(store.isLeech({ b: 0, c: 5, w: 4, t: 1 }), false);
  assert.equal(store.isLeech({ b: 0, c: 0, w: 3, t: 1 }), false);
  assert.equal(store.isLeech({ b: 3, c: 0, w: 6, t: 1 }), false);
}));

test('older progress without a due date falls back to last seen + interval', async () => {
  const { store } = await freshStore();
  const p = { b: 2, c: 2, w: 0, t: 1000 };
  assert.equal(store.dueAt(p), 1000 + store.INTERVAL_DAYS[2] * 864e5);
  assert.equal(store.dueAt({ b: 0, c: 0, w: 0, t: 0 }), 0);
});

test('My words: star, unstar, and keep them per language', async () => {
  const { store, saved } = await freshStore();
  assert.equal(store.toggleSaved(KEY), true);
  assert.equal(store.toggleSaved('ko|food|물'), true);
  assert.equal(store.isSaved(KEY), true);
  assert.deepEqual(store.savedKeys('ja'), [KEY]);
  assert.equal(store.toggleSaved(KEY), false);
  assert.deepEqual(saved('evocab.saved.v1'), { ja: [], ko: ['ko|food|물'] });
});

test('settings keep their defaults for keys an older version never saved', async () => {
  const { store } = await freshStore({ 'evocab.settings.v1': { lang: 'ko', count: 20 } });
  assert.equal(store.settings.lang, 'ko');
  assert.equal(store.settings.count, 20);
  assert.equal(store.settings.introNew, true);
  assert.equal(store.settings.newPerDay, 0);
  assert.equal(store.settings.speechRate, 'normal');
  assert.equal(store.settings.textSize, 'normal');
  assert.equal(store.firstRun, false);
});

test('a device with nothing saved is a first run', async () => {
  const { store } = await freshStore();
  assert.equal(store.firstRun, true);
});

test('export and import round trip, merging instead of replacing', async () => {
  const a = await freshStore();
  a.store.record(KEY, true);
  a.store.toggleSaved(KEY);
  a.store.saveRecord('ja', 'combo', 7);
  const backup = JSON.parse(JSON.stringify(a.store.exportData('1.19.0')));

  const b = await freshStore();
  b.store.record('ja|food|肉', false);
  assert.equal(b.store.importData(backup), 1);
  assert.equal(b.store.getProgress(KEY).b, 1);
  assert.equal(b.store.getProgress('ja|food|肉').w, 1, 'own answers are kept');
  assert.equal(b.store.isSaved(KEY), true);
  assert.equal(b.store.getRecords('ja').combo, 7);
});

test('import rejects files that are not a backup', async () => {
  const { store } = await freshStore();
  assert.equal(store.importData({ hello: 1 }), null);
  assert.equal(store.importData({ format: 'evocab-backup', v: 2, progress: {} }), null);
});

test('resetLanguage clears one language and keeps the others and My words', async () => {
  const { store } = await freshStore();
  store.record(KEY, true);
  store.record('ko|food|물', true);
  store.toggleSaved(KEY);
  store.resetLanguage('ja');
  assert.equal(store.getProgress(KEY).t, 0);
  assert.equal(store.getProgress('ko|food|물').b, 1);
  assert.equal(store.isSaved(KEY), true);
});

test('saveRecord keeps the best: lower match time, higher combo', async () => {
  const { store } = await freshStore();
  assert.equal(store.saveRecord('en', 'match', 30), true);
  assert.equal(store.saveRecord('en', 'match', 40), false);
  assert.equal(store.saveRecord('en', 'match', 25), true);
  assert.equal(store.saveRecord('en', 'combo', 5), true);
  assert.equal(store.saveRecord('en', 'combo', 4), false);
});

test('langProgress counts one language from storage without its word list', async () => {
  const { store } = await freshStore();
  for (let i = 0; i < 3; i++) store.record(KEY, true);
  store.record('ja|food|肉', false);
  store.record('ko|food|물', true);
  assert.deepEqual(store.langProgress('ja'), { mastered: 1, learning: 1, c: 3, w: 1 });
  assert.deepEqual(store.langProgress('zh'), { mastered: 0, learning: 0, c: 0, w: 0 });
});

test('bonus XP and boss wins add up and survive a backup round trip', async () => {
  const a = await freshStore();
  a.store.addBonusXP(50);
  a.store.addBonusXP(5);
  a.store.noteBoss('ja');
  assert.equal(a.store.getStats().xp, 55);
  assert.equal(a.store.getRecords('ja').bosses, 1);
  const b = await freshStore();
  b.store.addBonusXP(10);
  b.store.importData(JSON.parse(JSON.stringify(a.store.exportData('x'))));
  assert.equal(b.store.getStats().xp, 55, 'the larger lifetime total wins');
  assert.equal(b.store.getRecords('ja').bosses, 1);
});
