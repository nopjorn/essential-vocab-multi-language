import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, acceptedAnswers, suggestLevel, PASS, STOP } from '../../assets/js/rules.js';

test('normalize ignores case, spaces, punctuation and notes in brackets', () => {
  assert.equal(normalize('  Good Morning! '), 'goodmorning');
  assert.equal(normalize('bus (city)'), 'bus');
  assert.equal(normalize('こんにちは。'), 'こんにちは');
});

test('Japanese accepts kanji, kana and romaji with or without macrons', () => {
  const ok = acceptedAnswers({ term: '学校', reading: 'がっこう', roman: 'gakkō' });
  for (const typed of ['学校', 'がっこう', 'gakkō', 'gakko', 'gakkou', 'gakkoo']) assert.ok(ok.includes(normalize(typed)), typed);
  assert.ok(!ok.includes(normalize('gako')));
});

test('Chinese accepts characters and pinyin with or without tone marks', () => {
  const ok = acceptedAnswers({ term: '你好', roman: 'nǐ hǎo' });
  for (const typed of ['你好', 'nǐ hǎo', 'ni hao', 'nihao']) assert.ok(ok.includes(normalize(typed)), typed);
});

test('Korean accepts Hangul and romanization', () => {
  const ok = acceptedAnswers({ term: '물', roman: 'mul' });
  assert.ok(ok.includes('물') && ok.includes('mul'));
});

test('placement: start one level above the highest level passed', () => {
  assert.equal(suggestLevel({ 1: PASS - 1 }, false), 1);
  assert.equal(suggestLevel({ 1: PASS, 2: STOP }, false), 2);
  assert.equal(suggestLevel({ 1: 6, 2: 6, 3: 3 }, false), 3);
  assert.equal(suggestLevel({ 1: 6, 2: 6, 3: 6 }, false), 3);
});

test('placement: a level is passed only after the ones below it', () => {
  assert.equal(suggestLevel({ 1: 3, 2: 6 }, false), 1);
});

test('placement: letters first when level 1 is mostly missed in a language with letters', () => {
  assert.equal(suggestLevel({ 1: STOP }, true), 0);
  assert.equal(suggestLevel({ 1: STOP }, false), 1);
  assert.equal(suggestLevel({ 1: STOP + 1 }, true), 1);
});
