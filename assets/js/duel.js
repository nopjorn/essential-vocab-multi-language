// Two players on one device (iPad on the table): the screen splits in two, the top half turned
// round for the player opposite. Both see the same word; the first right tap scores. A wrong tap
// locks that player out of the question. Nothing is recorded: two people share one profile here.
import { settings } from './store.js';
import { state, h, fill, render, shuffle, termBlock, say, ensureAudio, fadeNextRender } from './core.js';
import { distractors, exitGame, confetti, onKeys } from './game.js';
import { icon } from './icons.js';
import { sfx } from './sound.js';

export const DUEL_QUESTIONS = 10;

export function startDuel(items, pool) {
  const t = state.t;
  state.navId++;
  fadeNextRender(false);
  document.body.classList.add('in-game');
  ensureAudio();
  onKeys(null);
  const words = shuffle(items).slice(0, DUEL_QUESTIONS);
  const score = [0, 0];
  let q = 0;

  function ask() {
    if (q >= words.length) return finish();
    const item = words[q];
    const options = shuffle([item, ...distractors(item, pool)]);
    const locked = [false, false];
    let done = false;
    const halves = [0, 1].map((p) => {
      const buttons = options.map((opt) =>
        h('button', { class: 'option duel-opt', type: 'button', onclick: (e) => pick(p, opt, e.currentTarget) }, h('span', {}, opt.answer)));
      return {
        buttons,
        el: h('section', { class: `duel-half p${p + 1}`, 'aria-label': t.duelPlayer.replace('{n}', p + 1) },
          h('div', { class: 'duel-bar' },
            h('span', { class: 'duel-name' }, t.duelPlayer.replace('{n}', p + 1)),
            h('span', { class: 'duel-score' }, String(score[p])),
            h('span', { class: 'muted' }, `${q + 1}/${words.length}`)),
          termBlock(item, { size: 'md', reading: settings.showRoman }),
          h('div', { class: 'duel-options' }, buttons)),
      };
    });
    function pick(p, opt, btn) {
      if (done || locked[p]) return;
      if (opt === item) {
        done = true;
        score[p]++;
        sfx('ok');
        btn.classList.add('right', 'pop');
        halves[1 - p].buttons[options.indexOf(opt)].classList.add('right');
        halves[p].el.classList.add('won');
        setTimeout(next, 900);
        return;
      }
      locked[p] = true;
      sfx('bad');
      btn.classList.add('wrong');
      halves[p].el.classList.add('locked');
      if (locked[0] && locked[1]) {
        done = true;
        for (const half of halves) half.buttons[options.indexOf(item)].classList.add('reveal-right');
        setTimeout(next, 1400);
      }
    }
    render(h('div', { class: 'duel' },
      halves[1].el,
      h('div', { class: 'duel-mid' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': t.quit, onclick: exitGame }, icon('close')),
        h('h1', { class: 'sr-only' }, t.duelTitle)),
      halves[0].el));
    if (settings.autoSpeak) say(item.term);
  }

  function next() {
    q++;
    ask();
  }

  function finish() {
    const winner = score[0] === score[1] ? 0 : score[0] > score[1] ? 1 : 2;
    sfx('done');
    const result = (p) => h('section', { class: `duel-half p${p + 1} duel-end${winner === p + 1 ? ' won' : ''}` },
      h('strong', {}, winner === 0 ? t.duelDraw : winner === p + 1 ? t.duelYouWin : t.duelYouLose),
      h('b', { class: 'duel-final' }, `${score[p]} : ${score[1 - p]}`));
    const actions = h('div', { class: 'duel-mid' },
      h('button', { class: 'btn primary', type: 'button', onclick: () => startDuel(items, pool) }, icon('repeat', { size: 16 }), t.playAgain),
      h('button', { class: 'btn', type: 'button', onclick: exitGame }, t.done));
    render(h('div', { class: 'duel' }, winner ? confetti() : null, result(1), actions, result(0)));
  }

  ask();
}
