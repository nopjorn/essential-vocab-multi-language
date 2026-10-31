// Shared state and DOM helpers used by every screen.
import { uiFor } from './i18n.js';
import { settings } from './store.js';
import { speak, unlock, speechSupported } from './speech.js';
import { icon } from './icons.js';
import { unlockSound } from './sound.js';

export const state = {
  index: null, // data/languages.json
  t: uiFor(settings.target),
  // Bumped on every navigation; async screens compare it after awaiting so a
  // slow, outdated render never replaces the page the user moved on to.
  navId: 0,
};
const vocabCache = new Map();
let audioUnlocked = false;

export const screen = document.getElementById('screen');

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// replaceChildren() would print null/false as text, so drop them first.
export function fill(el, ...nodes) {
  el.replaceChildren(...nodes.flat(Infinity).filter((n) => n != null && n !== false));
}

export function render(...nodes) {
  fill(screen, ...nodes);
  window.scrollTo(0, 0);
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function nameOf(obj) {
  return (obj && (obj[settings.target] || obj.th || obj.en)) || '';
}

export async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

export async function loadIndex() {
  state.index = await fetchJSON('data/languages.json');
  return state.index;
}

export async function loadLang(code) {
  if (vocabCache.has(code)) return vocabCache.get(code);
  const meta = state.index.learn.find((l) => l.code === code);
  const data = await fetchJSON(`data/${meta.file}`);
  vocabCache.set(code, data);
  return data;
}

// Already loaded vocabulary, for code that can't await (e.g. badges on the results screen).
export function cachedLang(code) {
  return vocabCache.get(code) || null;
}

export function loadAllLangs() {
  return Promise.all(state.index.learn.map((l) => loadLang(l.code)));
}

export function langMeta(code) {
  return state.index.learn.find((l) => l.code === code);
}

// Word sets belong to level 1 (beginner), 2 (everyday) or 3 (intermediate).
export const levelOf = (set) => set.level || 1;

// Translation shown for a word: the chosen target if present, else Thai.
export function answerOf(word) {
  return word.tr[settings.target] || word.tr.th;
}

export function setUiLang() {
  state.t = uiFor(settings.target);
  document.documentElement.lang = settings.target;
}

export function ensureAudio() {
  if (!audioUnlocked) {
    unlock();
    unlockSound();
    audioUnlocked = true;
  }
}

export function speechTag(code = settings.lang) {
  return vocabCache.get(code)?.speech || code;
}

// A lone Hangul letter is read out by name or not at all on many voices, so say it inside a
// syllable instead: consonant + ㅏ (ㄱ → 가), vowel with a silent ㅇ (ㅏ → 아).
const CHOSEONG = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNGSEONG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
function spokenForm(text) {
  if (text.length !== 1) return text;
  const lead = CHOSEONG.indexOf(text);
  const vowel = JUNGSEONG.indexOf(text);
  if (lead < 0 && vowel < 0) return text;
  return String.fromCharCode(0xac00 + (lead >= 0 ? lead * 588 : 11 * 588 + vowel * 28));
}

export function say(text, code = settings.lang) {
  speak(code === 'ko' ? spokenForm(text) : text, speechTag(code));
}

export function speakerBtn(text, { big = false, lang = settings.lang } = {}) {
  if (!speechSupported) return null;
  return h('button', {
    class: big ? 'speaker big' : 'speaker',
    type: 'button',
    'aria-label': state.t.tapToListen,
    onclick: (e) => {
      e.stopPropagation();
      ensureAudio();
      say(text, lang);
    },
  }, icon('speaker', { size: big ? 44 : 22 }));
}

// iOS-style large page title, optionally with a back link above it.
export function pageHead(title, { sub, back } = {}) {
  return h('header', { class: 'page-head' },
    back ? h('a', { class: 'back-link', href: back.href }, icon('chevronLeft', { size: 20 }), back.label) : null,
    h('h1', { class: 'page-title' }, title),
    sub ? h('p', { class: 'page-sub' }, sub) : null,
  );
}

// Section title of an inset grouped list, with optional trailing actions.
export function groupTitle(text, ...actions) {
  return h('div', { class: 'group-title' }, h('span', {}, text), actions.length ? h('span', { class: 'group-actions' }, actions) : null);
}

// Kana reading (Japanese) and romanization, shown under the word.
export function readingText(item) {
  return [item.reading, item.roman].filter(Boolean).join(' · ');
}

export function termBlock(item, { size = 'xl', reading = settings.showRoman, lang = settings.lang } = {}) {
  const r = reading ? readingText(item) : '';
  return h('div', { class: `term term-${size}` },
    h('span', { class: 'term-text', lang }, item.term),
    r ? h('span', { class: 'roman' }, r) : null,
  );
}

let toastTimer = null;
export function toast(message, { action, onAction, sticky = false } = {}) {
  const root = document.getElementById('toast');
  fill(root,
    h('div', { class: 'toast', role: 'status' },
      h('span', { class: 'toast-msg' }, message),
      action ? h('button', { class: 'toast-btn', type: 'button', onclick: () => { root.replaceChildren(); onAction?.(); } }, action) : null,
      h('button', { class: 'toast-close', type: 'button', 'aria-label': 'close', onclick: () => root.replaceChildren() }, icon('close', { size: 18 })),
    ),
  );
  clearTimeout(toastTimer);
  if (!sticky) toastTimer = setTimeout(() => root.replaceChildren(), 6000);
}
