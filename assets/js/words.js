// Word list of one set (#/words/<lang>/<setId>), opened from the list icon on a Home set row.
import { settings, wordKey, getProgress, setKnown, MASTERED_BOX } from './store.js';
import { state, h, render, nameOf, loadLang, setUiLang, pageHead, groupTitle, readingText, answerOf, speakerBtn, exampleOf, exampleBlock } from './core.js';
import { playSet } from './practice.js';
import { icon } from './icons.js';

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
  const set = vocab.sets.find((x) => x.id === setId);
  if (!set) {
    render(pageHead(t.practiceTitle, { back }), h('p', { class: 'empty' }, t.noSet));
    return;
  }

  const isKnown = (w) => getProgress(wordKey(code, set.id, w.term)).b >= MASTERED_BOX;
  const subText = () => `${set.words.length} ${t.words} · ${t.mastered} ${set.words.filter(isKnown).length}`;
  const sub = h('p', { class: 'page-sub words-sub' }, subText());

  const practiceSet = () => playSet(vocab, set.id);

  // Tap to mark a word as already known (mastered); tap again to put it back to new.
  const knownBtn = (word) => {
    const btn = h('button', { class: 'known-btn', type: 'button', 'aria-label': t.markKnown },
      h('span', { class: 'check-circle', 'aria-hidden': 'true' }, icon('check', { size: 16 })));
    const sync = () => {
      const on = isKnown(word);
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', String(on));
    };
    btn.onclick = () => {
      setKnown(wordKey(code, set.id, word.term), !isKnown(word));
      sync();
      sub.textContent = subText();
    };
    sync();
    return btn;
  };

  render(
    pageHead(`${set.icon} ${nameOf(set.name)}`, { back }),
    sub,
    h('div', { class: 'words-actions' },
      h('button', { class: 'btn primary', type: 'button', onclick: practiceSet }, icon('play', { size: 16, fill: true }), t.practiceThisSet)),
    groupTitle(t.wordList),
    h('ul', { class: 'group list' }, set.words.map((word) => {
      const note = word.note?.[settings.target] || word.note?.th;
      return h('li', { class: 'row word-row' },
        h('span', { class: 'rv-term' }, h('span', { lang: code }, word.term), readingText(word) ? h('small', {}, readingText(word)) : null),
        h('span', { class: 'rv-answer' }, answerOf(word), note ? h('small', { class: 'muted block' }, note) : null),
        word.example ? h('div', { class: 'rv-example' }, exampleBlock(exampleOf(word), { lang: code })) : null,
        knownBtn(word),
        speakerBtn(word.term, { lang: code }));
    })),
  );
}
