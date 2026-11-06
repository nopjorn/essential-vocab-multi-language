// Placement test: a few "pick the meaning" questions per level (1 → 3) that suggest where to start.
// It only reads the vocabulary: answers are not recorded as progress.
import { state, h, render, shuffle, levelOf, levelLabel, termBlock, answerOf, ensureAudio } from './core.js';
import { icon } from './icons.js';
import { sfx } from './sound.js';
import { suggestLevel, PER_LEVEL, STOP } from './rules.js';

function questions(vocab, level) {
  const words = vocab.sets.filter((s) => levelOf(s) === level).flatMap((s) => s.words);
  return shuffle(words).slice(0, PER_LEVEL).map((w) => {
    const answer = answerOf(w);
    const wrong = [];
    for (const x of shuffle(words)) {
      if (wrong.length >= 3) break;
      const a = answerOf(x);
      if (x.term !== w.term && a !== answer && !wrong.includes(a)) wrong.push(a);
    }
    return { word: w, answer, options: shuffle([answer, ...wrong]) };
  });
}


// Runs the test full screen; onDone(level) when the player takes the suggestion, onCancel() otherwise.
export function runPlacement(vocab, { hasLetters = false, onDone, onCancel }) {
  const t = state.t;
  state.navId++;
  document.body.classList.add('in-game');
  ensureAudio();
  const levels = [1, 2, 3].filter((lv) => vocab.sets.some((s) => levelOf(s) === lv));
  const scores = {};
  let li = 0;
  let qs = questions(vocab, levels[0]);
  let qi = 0;
  const total = levels.length * PER_LEVEL;
  let asked = 0;

  const leave = (fn) => {
    document.body.classList.remove('in-game');
    fn();
  };

  function nextLevel() {
    const lv = levels[li];
    if ((scores[lv] ?? 0) <= STOP || li + 1 >= levels.length) return result();
    li++;
    qs = questions(vocab, levels[li]);
    qi = 0;
    ask();
  }

  function ask() {
    if (qi >= qs.length) return nextLevel();
    const q = qs[qi];
    const lv = levels[li];
    let done = false;
    const pick = (opt, btn) => {
      if (done) return;
      done = true;
      const ok = opt === q.answer;
      if (ok) scores[lv] = (scores[lv] || 0) + 1;
      sfx(ok ? 'ok' : 'bad');
      if (btn) btn.classList.add(ok ? 'right' : 'wrong');
      buttons.forEach((b, i) => {
        b.disabled = true;
        if (q.options[i] === q.answer) b.classList.add('right');
      });
      qi++;
      asked++;
      setTimeout(ask, ok ? 450 : 900);
    };
    const buttons = q.options.map((opt, i) =>
      h('button', { class: 'option', type: 'button', onclick: (e) => pick(opt, e.currentTarget) },
        h('span', { class: 'opt-key' }, i + 1), h('span', {}, opt)));
    render(h('div', { class: 'game choice placement' },
      h('div', { class: 'game-top' },
        h('h1', { class: 'sr-only' }, t.placementTitle),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': t.quit, onclick: () => leave(onCancel) }, icon('close')),
        h('div', { class: 'progress', role: 'progressbar', 'aria-label': state.t.roundProgress, 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(asked) },
          h('div', { class: 'progress-fill', style: `width:${(asked / total) * 100}%` })),
        h('span', { class: 'counter' }, levelLabel(t, lv))),
      h('div', { class: 'mode-pill' }, icon('target', { size: 16 }), t.placementTitle),
      h('div', { class: 'prompt' }, termBlock({ term: q.word.term, reading: q.word.reading || '', roman: q.word.roman || '' }, { lang: vocab.code })),
      h('div', { class: 'feedback' }),
      h('div', { class: 'options' }, buttons),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => pick(null, null) }, t.dontKnow)),
    ));
  }

  function result() {
    const level = suggestLevel(scores, hasLetters);
    sfx('done');
    render(h('div', { class: 'game placement-result' },
      h('section', { class: 'results' },
        h('span', { class: 'away-ic big', 'aria-hidden': 'true' }, icon('target', { size: 30 })),
        h('h1', { class: 'welcome-title' }, t.placementResult),
        h('p', { class: 'result-msg' }, level === 0 ? t.levelLetters : `${levelLabel(t, level)} · ${t.levelNames[level]}`),
        h('p', { class: 'muted' }, level === 0 ? t.placementLetters : t.levelDesc[level]),
        h('ul', { class: 'group list placement-scores' }, levels.map((lv) =>
          h('li', { class: 'row' },
            h('span', { class: 'row-text' }, h('span', { class: 'row-label' }, levelLabel(t, lv))),
            h('span', { class: 'row-value' }, levels.indexOf(lv) <= li ? `${scores[lv] || 0}/${PER_LEVEL}` : t.placementSkipped)))),
        h('div', { class: 'actions stack' },
          h('button', { class: 'btn primary wide', type: 'button', onclick: () => leave(() => onDone(level)) }, icon('check', { size: 18 }), t.placementUse),
          h('button', { class: 'btn wide', type: 'button', onclick: () => leave(onCancel) }, t.back)))));
  }

  ask();
}
