// Word list of one set (#/words/<lang>/<setId>), opened from the list icon on a Home set row,
// and "My words" (#/words/<lang>/saved): the words starred across all sets of a language.
import { settings, wordKey, getProgress, setKnown, isLeech, savedKeys, MASTERED_BOX } from './store.js';
import { state, h, render, nameOf, loadLang, setUiLang, pageHead, groupTitle, readingText, answerOf, speakerBtn, exampleOf, exampleBlock, saveBtn, ensureAudio, toast } from './core.js';
import { playSet } from './practice.js';
import { itemsFor, startGame } from './game.js';
import { icon } from './icons.js';

export const SAVED_ID = 'saved'; // no word set uses this id

// Starred words of a language as { set, word }, newest first; keys whose word no longer exists are skipped.
export function savedEntries(vocab) {
  const sets = new Map(vocab.sets.map((s) => [s.id, s]));
  return savedKeys(vocab.code).slice().reverse().flatMap((key) => {
    const [, setId, term] = key.split('|');
    const word = sets.get(setId)?.words.find((w) => w.term === term);
    return word ? [{ set: sets.get(setId), word }] : [];
  });
}

// Plays the starred words: flashcards when there are too few for the choice modes.
export function playSaved(vocab) {
  const keys = new Set(savedKeys(vocab.code));
  const pool = itemsFor(vocab, vocab.sets.map((s) => s.id));
  const items = pool.filter((it) => keys.has(it.key));
  if (!items.length) return toast(state.t.savedEmpty);
  ensureAudio();
  settings.lang = vocab.code;
  const mode = items.length < 4 ? 'flash' : settings.mode === 'survival' ? 'mix' : settings.mode;
  startGame(items, pool, { mode });
}

export async function renderWords(code, setId) {
  setUiLang();
  const t = state.t;
  const nav = state.navId;
  const back = { href: '#/', label: t.back };

  let vocab;
  try {
    vocab = await loadLang(code);
    if (nav !== state.navId) return;
  } catch (err) {
    console.error(err);
    render(pageHead(t.practiceTitle, { back }), h('div', { class: 'card error' }, t.loadError));
    return;
  }
  const mine = setId === SAVED_ID;
  const set = mine ? null : vocab.sets.find((x) => x.id === setId);
  if (!mine && !set) {
    render(pageHead(t.practiceTitle, { back }), h('p', { class: 'empty' }, t.noSet));
    return;
  }
  const entries = mine ? savedEntries(vocab) : set.words.map((word) => ({ set, word }));
  const keyOf = (e) => wordKey(code, e.set.id, e.word.term);

  const isKnown = (e) => getProgress(keyOf(e)).b >= MASTERED_BOX;
  const subText = () => `${entries.length} ${t.words} · ${t.mastered} ${entries.filter(isKnown).length}`;
  const sub = h('p', { class: 'page-sub words-sub' }, subText());

  const practice = () => (mine ? playSaved(vocab) : playSet(vocab, set.id));

  // Tap to mark a word as already known (mastered); tap again to put it back to new.
  const knownBtn = (e) => {
    const btn = h('button', { class: 'known-btn', type: 'button', 'aria-label': t.markKnown },
      h('span', { class: 'check-circle', 'aria-hidden': 'true' }, icon('check', { size: 16 })));
    const sync = () => {
      const on = isKnown(e);
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', String(on));
    };
    btn.onclick = () => {
      setKnown(keyOf(e), !isKnown(e));
      sync();
      sub.textContent = subText();
    };
    sync();
    return btn;
  };

  // Whole set at once, for people who already know a topic: every word to mastered, or all back to new.
  const allKnown = () => entries.every(isKnown);
  const setAllBtn = mine ? null : h('button', {
    class: 'btn',
    type: 'button',
    onclick: () => {
      const on = !allKnown();
      if (!confirm((on ? t.knowAllConfirm : t.unknowAllConfirm).replace('{n}', entries.length))) return;
      for (const e of entries) if (isKnown(e) !== on) setKnown(keyOf(e), on);
      renderWords(code, setId);
    },
  }, icon(allKnown() ? 'undo' : 'check', { size: 16 }), allKnown() ? t.unknowAll : t.knowAll);

  render(
    pageHead(mine ? t.myWords : `${set.icon} ${nameOf(set.name)}`, { back }),
    sub,
    entries.length
      ? h('div', { class: 'words-actions' },
          h('button', { class: 'btn primary', type: 'button', onclick: practice }, icon('play', { size: 16, fill: true }), mine ? t.practiceSaved : t.practiceThisSet),
          setAllBtn)
      : null,
    groupTitle(t.wordList),
    entries.length
      ? h('ul', { class: 'group list' }, entries.map((e) => {
          const { word } = e;
          const note = word.note?.[settings.target] || word.note?.th;
          return h('li', { class: 'row word-row' },
            h('span', { class: 'rv-term' }, h('span', { lang: code }, word.term), readingText(word) ? h('small', {}, readingText(word)) : null),
            h('span', { class: 'rv-answer' }, answerOf(word), note ? h('small', { class: 'muted block' }, note) : null,
              mine ? h('small', { class: 'muted block' }, `${e.set.icon} ${nameOf(e.set.name)}`) : null,
              isLeech(getProgress(keyOf(e))) ? h('span', { class: 'leech-chip' }, t.leechChip) : null),
            saveBtn(keyOf(e)),
            knownBtn(e),
            speakerBtn(word.term, { lang: code }),
            word.example ? h('div', { class: 'rv-example' }, exampleBlock(exampleOf(word), { lang: code })) : null);
        }))
      : h('p', { class: 'empty' }, icon('star', { size: 20 }), t.savedEmpty),
  );
}
