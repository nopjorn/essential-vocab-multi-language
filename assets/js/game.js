// Game modes and the results screen. Games run full screen (the tab bar is hidden).
import { settings, wordKey, getProgress, record, undoRecord, getRecords, saveRecord, saveStars, noteRound, logSession, getStats, todayAnswers, MAX_BOX, MASTERED_BOX } from './store.js';
import { state, h, fill, render, shuffle, say, speakerBtn, termBlock, readingText, answerOf, groupTitle, cachedLang, nameOf } from './core.js';
import { icon, MODE_ICON } from './icons.js';
import { speechSupported } from './speech.js';
import { sfx, buzz } from './sound.js';
import { dayTotals, streak } from './progress.js';
import { badgeList, earnedIds } from './badges.js';
import { totalXP, playerLevel, syncQuests, dailyQuests, milestones, unlockedIds } from './engage.js';

export const MODES = ['mix', 'flash', 'quiz', 'reverse', 'listen', 'type', 'match', 'survival'];
const HEARTS = 3; // survival: wrong answers allowed before the run ends
const MATCH_PAIRS = 6;
const SWIPE_RATIO = 0.28; // fraction of the card width that counts as a decision

let onExit = () => {};
export function setExitHandler(fn) {
  onExit = fn;
}

// ---------- word selection ----------

export function itemsFor(vocab, setIds) {
  const items = [];
  for (const set of vocab.sets) {
    if (!setIds.includes(set.id)) continue;
    for (const w of set.words) {
      items.push({
        key: wordKey(vocab.code, set.id, w.term),
        lang: vocab.code,
        term: w.term,
        reading: w.reading || '',
        roman: w.roman || '',
        answer: answerOf(w),
        note: w.note ? w.note[settings.target] || w.note.th || '' : '',
        setId: set.id,
      });
    }
  }
  return items;
}

// Weighted sampling without replacement: words in low boxes and unseen words come up more often.
export function pickItems(items, count) {
  const n = count > 0 ? Math.min(count, items.length) : items.length;
  return items
    .map((it) => {
      const p = getProgress(it.key);
      const w = (MAX_BOX - p.b + 1) * (p.t ? 1 : 1.5);
      return { it, k: Math.pow(Math.random(), 1 / w) };
    })
    .sort((a, b) => b.k - a.k)
    .slice(0, n)
    .map((x) => x.it);
}

// Distractors must differ from the correct item in both the term and the answer,
// so homonyms (e.g. 눈 eye / 눈 snow) and shared meanings never produce two right options.
function distractors(item, pool, n = 3) {
  const out = [];
  const seenT = new Set([item.term]);
  const seenA = new Set([item.answer]);
  const take = (list) => {
    for (const x of shuffle(list)) {
      if (out.length >= n) return;
      if (seenT.has(x.term) || seenA.has(x.answer)) continue;
      out.push(x);
      seenT.add(x.term);
      seenA.add(x.answer);
    }
  };
  take(pool.filter((x) => x.setId === item.setId)); // same set first: harder
  take(pool);
  return out;
}

// ---------- shell ----------

// `mode` overrides the chosen mode for one round (e.g. review rounds that must not be survival).
export function startGame(items, pool, { mode = settings.mode } = {}) {
  // The game replaces whatever page is showing: stop that page's pending async render.
  state.navId++;
  document.body.classList.add('in-game');
  const survival = mode === 'survival';
  const session = {
    mode,
    lang: settings.lang,
    items,
    pool,
    i: 0,
    correct: 0,
    wrong: [],
    mastered: new Map(), // words that reached the mastered box in this round
    combo: 0, // correct answers in a row
    bestCombo: 0,
    comboEl: h('span', { class: 'combo', role: 'status' }),
    history: [], // graded answers, newest last (flashcard undo)
    matchRecord: null, // seconds, when a match round set a new personal best
    badgesBefore: earnedIds(settings.lang),
    before: todayAnswers(settings.lang),
    xpBefore: totalXP(),
    milestonesBefore: new Set(milestones(settings.lang).keys()),
    unlocksBefore: unlockedIds(),
    questsBefore: dailyQuests(settings.lang).filter((q) => q.done).length,
    startedAt: Date.now(),
    // survival: items grows as questions are asked; queue holds the words still to come
    hearts: survival ? HEARTS : null,
    queue: [],
  };
  if (survival) session.items = [];
  if (session.mode === 'match') playMatch(session);
  else playNext(session);
}

function exitGame() {
  onKeys(null);
  onExit();
}

// Survival shows hearts where the other modes show the progress bar.
function heartsEl(session) {
  const t = state.t;
  return h('div', { class: 'hearts', role: 'img', 'aria-label': `${t.heartsLeft} ${session.hearts}/${HEARTS}` },
    Array.from({ length: HEARTS }, (_, i) =>
      h('span', { class: `heart${i < session.hearts ? ' on' : ''}` }, icon('heart', { size: 22, fill: i < session.hearts }))));
}

function topBar(session, label, extra = null) {
  const t = state.t;
  const total = session.items.length;
  const pct = Math.round((session.i / total) * 100);
  if (session.hearts !== null) {
    session.heartsEl = heartsEl(session);
    return h('div', { class: 'game-top' },
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': t.quit, onclick: exitGame }, icon('close')),
      session.heartsEl,
      session.comboEl,
      h('span', { class: 'counter survival-score', title: t.score }, icon('check', { size: 16 }), String(session.correct)),
      extra,
    );
  }
  return h('div', { class: 'game-top' },
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': t.quit, onclick: exitGame }, icon('close')),
    h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(session.i) },
      h('div', { class: 'progress-fill', style: `width:${pct}%` })),
    session.comboEl,
    h('span', { class: 'counter' }, label ?? `${Math.min(session.i + 1, total)}/${total}`),
    extra,
  );
}

const COMBO_STEP = 5; // every 5 in a row gets a burst and a fanfare

// The combo chip is one node reused across questions, so it can animate as answers come in.
function updateCombo(session, bump = false) {
  const n = session.combo;
  const el = session.comboEl;
  el.classList.toggle('on', n >= 2);
  el.classList.toggle('hot', n >= COMBO_STEP * 2);
  el.setAttribute('aria-label', `${state.t.combo} ${n}`);
  fill(el, icon('flame', { size: 16 }), h('b', {}, `×${n}`));
  if (!bump || n < 2) return;
  el.classList.remove('bump');
  void el.offsetWidth; // restart the animation
  el.classList.add('bump');
  if (n % COMBO_STEP === 0 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const burst = h('div', { class: 'combo-burst', 'aria-hidden': 'true' }, icon('flame', { size: 26 }), state.t.comboBurst.replace('{n}', n));
    document.body.append(burst);
    setTimeout(() => burst.remove(), 1100);
  }
}

function grade(session, item, ok) {
  const wasMastered = getProgress(item.key).b >= MASTERED_BOX;
  const entry = {
    item,
    ok,
    hadMastered: session.mastered.has(item.key),
    wasWrong: session.wrong.includes(item),
    combo: session.combo,
    bestCombo: session.bestCombo,
  };
  entry.undo = record(item.key, ok);
  session.history.push(entry);
  if (!wasMastered && getProgress(item.key).b >= MASTERED_BOX) session.mastered.set(item.key, item);
  else if (!ok) session.mastered.delete(item.key);
  if (ok) session.correct++;
  else if (!session.wrong.includes(item)) session.wrong.push(item);
  session.combo = ok ? session.combo + 1 : 0;
  session.bestCombo = Math.max(session.bestCombo, session.combo);
  updateCombo(session, ok);
  if (!ok && session.hearts !== null) {
    session.hearts = Math.max(0, session.hearts - 1);
    const el = heartsEl(session);
    el.classList.add('lose');
    session.heartsEl?.replaceWith(el);
    session.heartsEl = el;
  }
}

// Takes back the last graded answer (progress, daily stats and this round's tallies).
function undoLast(session) {
  const e = session.history.pop();
  if (!e) return false;
  undoRecord(e.undo);
  if (e.ok) session.correct--;
  if (!e.wasWrong) session.wrong = session.wrong.filter((x) => x !== e.item);
  if (e.hadMastered) session.mastered.set(e.item.key, e.item);
  else session.mastered.delete(e.item.key);
  session.combo = e.combo;
  session.bestCombo = e.bestCombo;
  updateCombo(session);
  session.i--;
  return true;
}

function cheer(session, ok) {
  if (!ok) {
    sfx('bad');
    buzz();
  } else sfx(session.combo >= COMBO_STEP && session.combo % COMBO_STEP === 0 ? 'combo' : 'ok');
}

// Mixed mode picks a mode per word: typing only once a word is partly known (box 2+).
function mixMode(item) {
  const modes = ['quiz', 'reverse'];
  if (speechSupported) modes.push('listen');
  if (getProgress(item.key).b >= 2) modes.push('type', 'type');
  return modes[Math.floor(Math.random() * modes.length)];
}

function modePill(session, mode) {
  if (session.mode !== 'mix' && session.mode !== 'survival') return null;
  return h('div', { class: 'mode-pill' }, icon(MODE_ICON[mode], { size: 16 }), state.t.modes[mode][0]);
}

// Survival gets harder as the score grows: more question types, typing last.
function survivalMode(session, item) {
  const n = session.correct;
  const modes = ['quiz'];
  if (n >= 5) modes.push('reverse');
  if (n >= 12 && speechSupported) modes.push('listen');
  if (n >= 20 && getProgress(item.key).b >= 1) modes.push('type');
  return modes[Math.floor(Math.random() * modes.length)];
}

// Next survival word: work through the pool in weighted order, refilling it when it runs out,
// and never the same word twice in a row.
function nextSurvivalItem(session) {
  if (!session.queue.length) session.queue = pickItems(session.pool, session.pool.length);
  const last = session.items.at(-1);
  if (session.queue[0] === last && session.queue.length > 1) session.queue.push(session.queue.shift());
  return session.queue.shift();
}

function playNext(session) {
  if (session.hearts !== null) {
    if (session.hearts <= 0) return showResults(session);
    if (session.i >= session.items.length) session.items.push(nextSurvivalItem(session));
    const item = session.items[session.i];
    const mode = survivalMode(session, item);
    const view = mode === 'type' ? typeView : choiceView;
    return view(session, item, () => {
      session.i++;
      playNext(session);
    }, mode);
  }
  if (session.i >= session.items.length) return showResults(session);
  const item = session.items[session.i];
  const advance = () => {
    session.i++;
    playNext(session);
  };
  const mode = session.mode === 'mix' ? mixMode(item) : session.mode;
  const view = { flash: flashView, quiz: choiceView, reverse: choiceView, listen: choiceView, type: typeView }[mode];
  view(session, item, advance, mode);
}

let keyHandler = null;
export function onKeys(fn) {
  if (keyHandler) document.removeEventListener('keydown', keyHandler);
  keyHandler = fn;
  if (fn) document.addEventListener('keydown', fn);
}

function noteEl(item) {
  return item.note ? h('p', { class: 'note' }, icon('info', { size: 16 }), h('span', {}, item.note)) : null;
}

function readingSmall(item) {
  const r = settings.showRoman ? readingText(item) : '';
  return r ? h('small', {}, r) : null;
}

function verdict(ok) {
  const t = state.t;
  return h('strong', { class: `verdict ${ok ? 'ok' : 'ng'}` }, icon(ok ? 'check' : 'close', { size: 20 }), ok ? t.correct : t.wrong);
}

// ---------- flashcards: tap to flip, swipe right = known, left = not yet ----------

function flashView(session, item, advance) {
  const t = state.t;
  let flipped = false;
  let busy = false;

  const front = h('div', { class: 'face front' }, termBlock(item), h('span', { class: 'flip-hint' }, t.tapToFlip));
  const back = h('div', { class: 'face back' },
    h('div', { class: 'answer-big' }, item.answer),
    termBlock(item, { size: 'md', reading: true }),
    noteEl(item),
  );
  const stampKnow = h('div', { class: 'stamp stamp-know', 'aria-hidden': 'true' }, icon('check', { size: 20 }), t.swipeKnow);
  const stampAgain = h('div', { class: 'stamp stamp-again', 'aria-hidden': 'true' }, icon('close', { size: 20 }), t.swipeAgain);
  const card = h('div', { class: 'flashcard', role: 'button', tabindex: '0', 'aria-label': t.flip },
    h('div', { class: 'flash-inner' }, front, back),
    stampKnow,
    stampAgain,
    h('div', { class: 'flash-speaker' }, speakerBtn(item.term)),
  );
  const hasNext = session.i + 1 < session.items.length;
  const deck = h('div', { class: 'deck' }, hasNext ? h('div', { class: 'deck-next', 'aria-hidden': 'true' }) : null, card);

  function setPos(x, y) {
    card.style.transform = x || y ? `translate(${x}px, ${y * 0.25}px) rotate(${x / 20}deg)` : '';
    const p = Math.min(1, Math.abs(x) / (deck.clientWidth * SWIPE_RATIO));
    stampKnow.style.opacity = x > 0 ? p : 0;
    stampAgain.style.opacity = x < 0 ? p : 0;
  }

  function flip() {
    if (busy) return;
    flipped = !flipped;
    card.classList.toggle('flipped', flipped);
  }

  function decide(ok) {
    if (busy) return;
    busy = true;
    const w = deck.clientWidth;
    card.classList.remove('dragging');
    card.classList.add('fly');
    stampKnow.style.opacity = ok ? 1 : 0;
    stampAgain.style.opacity = ok ? 0 : 1;
    card.style.transform = `translate(${ok ? w * 1.4 : -w * 1.4}px, 20px) rotate(${ok ? 22 : -22}deg)`;
    grade(session, item, ok);
    cheer(session, ok);
    setTimeout(advance, 280);
  }

  function undo() {
    if (busy || !undoLast(session)) return;
    sfx('tap');
    playNext(session);
  }
  const undoBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': t.undo, title: t.undo, disabled: !session.history.length, onclick: undo }, icon('undo'));

  // Pointer drag (touch, pen and mouse). Small movement = tap = flip.
  let drag = null;
  card.addEventListener('pointerdown', (e) => {
    if (busy || e.target.closest('.speaker')) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0, t: performance.now() };
    card.setPointerCapture(e.pointerId);
    card.classList.add('dragging');
  });
  card.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dx = e.clientX - drag.x;
    drag.dy = e.clientY - drag.y;
    setPos(drag.dx, drag.dy);
  });
  const release = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { dx, dy, t: t0 } = drag;
    drag = null;
    card.classList.remove('dragging');
    if (e.type === 'pointercancel') return setPos(0, 0);
    const speed = Math.abs(dx) / Math.max(1, performance.now() - t0);
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
      setPos(0, 0);
      flip();
    } else if (Math.abs(dx) > deck.clientWidth * SWIPE_RATIO || (speed > 0.6 && Math.abs(dx) > 40)) {
      decide(dx > 0);
    } else {
      setPos(0, 0);
    }
  };
  card.addEventListener('pointerup', release);
  card.addEventListener('pointercancel', release);

  const actions = h('div', { class: 'swipe-actions' },
    h('button', { class: 'round-btn bad', type: 'button', 'aria-label': t.forgot, onclick: () => decide(false) },
      icon('close', { size: 28 }), h('span', {}, t.forgot)),
    h('button', { class: 'round-btn neutral small', type: 'button', 'aria-label': t.flip, onclick: flip },
      icon('flip', { size: 22 }), h('span', {}, t.flip)),
    h('button', { class: 'round-btn good', type: 'button', 'aria-label': t.remembered, onclick: () => decide(true) },
      icon('check', { size: 28 }), h('span', {}, t.remembered)),
  );

  render(h('div', { class: 'game game-flash' }, topBar(session, null, undoBtn), deck, h('p', { class: 'swipe-hint' }, t.swipeHint), actions));
  onKeys((e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
    else if (e.key === '1' || e.key === 'ArrowLeft') decide(false);
    else if (e.key === '2' || e.key === 'ArrowRight') decide(true);
    else if (e.key === 'z' || e.key === 'Backspace') undo();
  });
  if (settings.autoSpeak) say(item.term);
}

// ---------- multiple choice (quiz / reverse / listen) ----------

function choiceView(session, item, advance, mode) {
  const t = state.t;
  const options = shuffle([item, ...distractors(item, session.pool)]);
  let answered = false;

  let prompt;
  if (mode === 'quiz') prompt = h('div', { class: 'prompt' }, termBlock(item), speakerBtn(item.term));
  else if (mode === 'reverse') prompt = h('div', { class: 'prompt' }, h('div', { class: 'answer-big' }, item.answer));
  else prompt = h('div', { class: 'prompt listen' }, speakerBtn(item.term, { big: true }), h('span', { class: 'flip-hint' }, t.tapToListen));

  const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
  const nextBtn = h('button', { class: 'btn primary wide hidden', type: 'button', onclick: () => advance() }, t.next, icon('chevronRight', { size: 20 }));

  const buttons = options.map((opt, idx) => {
    const label = mode === 'reverse'
      ? h('span', { class: 'opt-term' }, h('span', { lang: settings.lang }, opt.term), readingSmall(opt))
      : h('span', {}, opt.answer);
    return h('button', { class: 'option', type: 'button', onclick: () => choose(opt, idx) },
      h('span', { class: 'opt-key' }, idx + 1), label);
  });

  function choose(opt, idx) {
    if (answered) return;
    answered = true;
    const ok = opt === item;
    grade(session, item, ok);
    cheer(session, ok);
    buttons.forEach((b, i) => {
      b.disabled = true;
      if (options[i] === item) b.classList.add('right', ok ? 'pop' : 'reveal-right');
      else if (i === idx) b.classList.add('wrong');
    });
    fill(feedback,
      verdict(ok),
      mode !== 'quiz' || !ok ? h('div', { class: 'reveal' }, termBlock(item, { size: 'md', reading: true }), h('span', { class: 'eq' }, '='), h('span', {}, item.answer)) : null,
      noteEl(item),
    );
    if (mode !== 'quiz' || settings.autoSpeak) say(item.term);
    if (ok) setTimeout(() => advance(), item.note ? 1600 : 900);
    else nextBtn.classList.remove('hidden');
  }

  // Feedback sits between the prompt and the options, so on phones the options stay
  // at the bottom of the screen within thumb reach.
  render(h('div', { class: 'game choice' },
    topBar(session),
    modePill(session, mode),
    prompt,
    feedback,
    h('div', { class: 'options' }, buttons),
    h('div', { class: 'actions' }, nextBtn),
  ));

  onKeys((e) => {
    const n = Number(e.key);
    if (!answered && n >= 1 && n <= options.length) choose(options[n - 1], n - 1);
    else if (answered && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); advance(); }
  });
  if (mode === 'listen' || (mode === 'quiz' && settings.autoSpeak)) say(item.term);
}

// ---------- typing ----------

export function normalize(s) {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[\s?!.,'’"\-–~〜・、。？！「」]/g, '');
}

// Romanization variants: with macrons, without them, and long vowels doubled (ō → ou / oo).
function romanVariants(r) {
  if (!r) return [];
  const plain = r.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const long = r.replace(/ō/g, 'ou').replace(/ū/g, 'uu').replace(/ā/g, 'aa').replace(/ē/g, 'ei').replace(/ī/g, 'ii');
  const longO = r.replace(/ō/g, 'oo');
  return [r, plain, long, longO];
}

export function acceptedAnswers(item) {
  return [...new Set([item.term, item.reading, ...romanVariants(item.roman)].filter(Boolean).map(normalize))];
}

// "_ _ _" clue: the first character of the word (and of its romanization), one blank per other character.
function clueOf(item) {
  const blanks = (s) => Array.from(s).map((c, i) => (i === 0 ? c : c === ' ' ? '\u2003' : '_')).join(' ');
  return item.roman ? `${blanks(item.term)} · ${blanks(item.roman)}` : blanks(item.term);
}

function typeView(session, item, advance, mode) {
  const t = state.t;
  let answered = false;
  const input = h('input', {
    class: 'type-input',
    type: 'text',
    lang: settings.lang,
    placeholder: t.typeHere,
    autocomplete: 'off',
    autocapitalize: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
    enterkeyhint: 'done',
  });
  const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
  const checkBtn = h('button', { class: 'btn primary', type: 'submit' }, t.check);
  const skipBtn = h('button', { class: 'btn', type: 'button', onclick: () => check(true) }, t.dontKnow);
  const clue = h('p', { class: 'type-clue', 'aria-live': 'polite' });
  const hintBtn = h('button', {
    class: 'btn',
    type: 'button',
    onclick: () => {
      if (answered) return;
      hintBtn.disabled = true;
      clue.textContent = clueOf(item);
      input.focus({ preventScroll: true });
    },
  }, icon('bulb', { size: 18 }), t.hint);

  function check(skip = false) {
    if (answered) return advance();
    const v = normalize(input.value);
    if (!v && !skip) return input.focus();
    answered = true;
    const ok = !skip && acceptedAnswers(item).includes(v);
    grade(session, item, ok);
    cheer(session, ok);
    input.readOnly = true;
    input.classList.add(ok ? 'right' : 'wrong', ok ? 'pop' : 'shake');
    fill(feedback,
      verdict(ok),
      h('div', { class: 'reveal' }, termBlock(item, { size: 'md', reading: true }), speakerBtn(item.term)),
      noteEl(item),
    );
    say(item.term);
    checkBtn.textContent = t.next;
    skipBtn.classList.add('hidden');
    hintBtn.classList.add('hidden');
    checkBtn.focus({ preventScroll: true });
  }

  const form = h('form', {
    class: 'type-form',
    onsubmit: (e) => {
      e.preventDefault();
      check();
    },
  }, input, clue, h('div', { class: 'actions two' }, hintBtn, skipBtn, checkBtn));

  render(h('div', { class: 'game' },
    topBar(session),
    modePill(session, mode),
    h('div', { class: 'prompt' }, h('div', { class: 'answer-big' }, item.answer)),
    form,
    h('p', { class: 'hint center' }, t.typeHint),
    feedback,
  ));
  onKeys(null);
  // iOS only opens the keyboard on focus during a user gesture; this still
  // focuses the field on iPad with a hardware keyboard.
  input.focus({ preventScroll: true });
}

// ---------- matching ----------

function playMatch(session) {
  const t = state.t;
  const rounds = [];
  for (let i = 0; i < session.items.length; i += MATCH_PAIRS) rounds.push(session.items.slice(i, i + MATCH_PAIRS));
  // the last round needs at least 2 pairs to be a game
  if (rounds.length > 1 && rounds[rounds.length - 1].length < 2) {
    rounds[rounds.length - 2].push(...rounds.pop());
  }
  let r = 0;
  let doneCount = 0;

  function playRound() {
    if (r >= rounds.length) {
      session.i = session.items.length;
      return showResults(session);
    }
    const pairs = rounds[r];
    const missed = new Set();
    let left = pairs.length;
    let selL = null;
    let selR = null;
    let bar;

    // Round timer; only full rounds (MATCH_PAIRS pairs) count toward the personal best.
    const startedAt = performance.now();
    const best = getRecords(session.lang).match;
    const timeEl = h('b', {}, '0.0');
    const timer = h('div', { class: 'match-timer' },
      icon('clock', { size: 16 }), timeEl, h('span', {}, t.sec),
      pairs.length === MATCH_PAIRS && best ? h('span', { class: 'muted' }, ` · ${t.best} ${best.toFixed(1)} ${t.sec}`) : null);
    const elapsed = () => Math.round((performance.now() - startedAt) / 100) / 10;
    const tick = setInterval(() => {
      if (!timer.isConnected) return clearInterval(tick); // the player left the game
      timeEl.textContent = elapsed().toFixed(1);
    }, 100);

    const mk = (item, side) => {
      const b = h('button', {
        class: `tile ${side}`,
        type: 'button',
        lang: side === 'l' ? settings.lang : settings.target,
        onclick: () => pick(b, item, side),
      },
      side === 'l' ? [h('span', {}, item.term), readingSmall(item)] : item.answer);
      return b;
    };
    const lefts = shuffle(pairs).map((it) => mk(it, 'l'));
    const rights = shuffle(pairs).map((it) => mk(it, 'r'));

    const topBarMatch = () => {
      session.i = doneCount;
      return topBar(session, `${t.round} ${r + 1}/${rounds.length}`);
    };

    function pick(btn, item, side) {
      if (btn.disabled) return;
      if (side === 'l') {
        if (selL) selL.btn.classList.remove('sel');
        selL = { btn, item };
        say(item.term);
      } else {
        if (selR) selR.btn.classList.remove('sel');
        selR = { btn, item };
      }
      btn.classList.add('sel');
      if (!selL || !selR) return;

      const a = selL;
      const b = selR;
      selL = selR = null;
      if (a.item === b.item) {
        [a.btn, b.btn].forEach((x) => {
          x.classList.remove('sel');
          x.classList.add('matched');
          x.disabled = true;
        });
        grade(session, a.item, !missed.has(a.item));
        // A late match of a missed word still sounds right: the miss already played the buzzer.
        sfx(session.combo >= COMBO_STEP && session.combo % COMBO_STEP === 0 ? 'combo' : 'ok');
        doneCount++;
        left--;
        const nb = topBarMatch();
        bar.replaceWith(nb);
        bar = nb;
        if (left === 0) {
          clearInterval(tick);
          const secs = elapsed();
          timeEl.textContent = secs.toFixed(1);
          const isRecord = pairs.length === MATCH_PAIRS && saveRecord(session.lang, 'match', secs);
          if (isRecord) {
            session.matchRecord = secs;
            timer.classList.add('record');
            fill(timer, icon('trophy', { size: 18 }), h('b', {}, `${t.newRecord} ${secs.toFixed(1)} ${t.sec}`));
            sfx('combo');
          }
          setTimeout(() => { r++; playRound(); }, isRecord ? 1400 : 500);
        }
      } else {
        missed.add(a.item);
        session.combo = 0;
        updateCombo(session);
        [a.btn, b.btn].forEach((x) => {
          x.classList.remove('sel');
          x.classList.add('shake');
          setTimeout(() => x.classList.remove('shake'), 400);
        });
        sfx('bad');
        buzz(60);
      }
    }

    bar = topBarMatch();
    render(h('div', { class: 'game' },
      bar,
      timer,
      h('div', { class: 'match-grid' }, h('div', { class: 'match-col' }, lefts), h('div', { class: 'match-col' }, rights)),
    ));
    onKeys(null);
  }
  playRound();
}

// ---------- results ----------

function scoreRing(pct) {
  const NS = 'http://www.w3.org/2000/svg';
  const R = 52;
  const C = 2 * Math.PI * R;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('class', 'ring');
  svg.setAttribute('aria-hidden', 'true');
  const track = document.createElementNS(NS, 'circle');
  const bar = document.createElementNS(NS, 'circle');
  for (const c of [track, bar]) {
    c.setAttribute('cx', '60');
    c.setAttribute('cy', '60');
    c.setAttribute('r', String(R));
  }
  track.setAttribute('class', 'ring-track');
  bar.setAttribute('class', 'ring-bar');
  bar.setAttribute('stroke-dasharray', `0 ${C}`);
  svg.append(track, bar);
  // Grow from empty on the next frame so the CSS transition has a start value.
  requestAnimationFrame(() => requestAnimationFrame(() => bar.setAttribute('stroke-dasharray', `${(C * pct) / 100} ${C}`)));
  return svg;
}

// Counts a number up inside `el` (skipped when the user prefers reduced motion).
function countUp(el, to, suffix = '') {
  el.textContent = `${to}${suffix}`;
  if (!to || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const t0 = performance.now();
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / 900);
    el.textContent = `${Math.round(to * (1 - Math.pow(1 - k, 3)))}${suffix}`;
    if (k < 1 && el.isConnected) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const CONFETTI_COLORS = ['#f5b84a', '#5b75f6', '#3ccf73', '#ff5c66', '#a78bfa'];

// A short burst of falling pieces; pointer-events:none so it never blocks taps.
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  return h('div', { class: 'confetti', 'aria-hidden': 'true' },
    Array.from({ length: 28 }, (_, i) => h('i', {
      style: `left:${(i * 37) % 100}%;background:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};animation-delay:${(i % 7) * 0.08}s;--drift:${((i * 53) % 80) - 40}px`,
    })));
}

// 3 stars for a perfect round, 2 from 80%, 1 from 50%.
export function starsFor(correct, total) {
  if (!total) return 0;
  const p = correct / total;
  return p >= 1 ? 3 : p >= 0.8 ? 2 : p >= 0.5 ? 1 : 0;
}

export function starRow(n, { size = 16, cls = '' } = {}) {
  return h('span', { class: `stars ${cls}`.trim(), role: 'img', 'aria-label': `${n}/3 ${state.t.starsUnit}` },
    [0, 1, 2].map((i) => h('span', { class: `star${i < n ? ' on' : ''}`, style: `--i:${i}` }, icon('star', { size, fill: i < n }))));
}

// Best stars per word set from this round: sets with at least 4 questions in it count.
function roundStars(session) {
  if (session.mode === 'survival') return [];
  const bySet = new Map();
  for (const e of session.history) {
    const x = bySet.get(e.item.setId) || { n: 0, c: 0 };
    x.n++;
    if (e.ok) x.c++;
    bySet.set(e.item.setId, x);
  }
  const vocab = cachedLang(session.lang);
  const improved = [];
  for (const [setId, { n, c }] of bySet) {
    const stars = n >= 4 ? starsFor(c, n) : 0;
    if (stars && saveStars(session.lang, setId, stars)) {
      const set = vocab?.sets.find((x) => x.id === setId);
      if (set) improved.push({ set, stars });
    }
  }
  return improved;
}

// Player level bar: grows from where it was before the round; on a level up it refills.
function xpBar(before, after) {
  const t = state.t;
  const a = playerLevel(before);
  const b = playerLevel(after);
  const up = b.level > a.level;
  const fillEl = h('span', { class: 'xp-fill', style: `width:${up ? 0 : a.pct}%` });
  requestAnimationFrame(() => requestAnimationFrame(() => (fillEl.style.width = `${b.pct}%`)));
  return h('div', { class: `xp-box${up ? ' up' : ''}` },
    h('div', { class: 'xp-head' },
      h('span', { class: 'xp-level' }, icon('trophy', { size: 16 }), t.levelShort.replace('{n}', b.level)),
      h('b', {}, `+${after - before} XP`),
      h('span', { class: 'muted' }, `${after - b.from}/${b.to - b.from}`)),
    h('span', { class: 'xp-bar' }, fillEl),
    up ? h('p', { class: 'xp-up' }, icon('sparkles', { size: 16 }), t.levelUp.replace('{n}', b.level)) : null);
}

function questBox(lang, justDone) {
  const t = state.t;
  const quests = dailyQuests(lang);
  return h('div', { class: `quest-box${justDone ? ' done' : ''}` },
    h('strong', {}, icon(justDone ? 'gift' : 'target', { size: 18 }), justDone ? t.questsDone : t.questsTitle),
    h('ul', { class: 'quest-mini' }, quests.map((q) =>
      h('li', { class: q.done ? 'done' : '' },
        h('span', { class: 'quest-check', 'aria-hidden': 'true' }, q.done ? icon('check', { size: 14 }) : null),
        h('span', { class: 'quest-text' }, q.text),
        h('span', { class: 'quest-count' }, `${q.have}/${q.need}`)))));
}

// Full-screen celebration for milestones crossed in this round (shown once: next round
// starts from the new total). Tap the button or the backdrop to close it.
function milestoneOverlay(list) {
  const t = state.t;
  const ICON = { mastered: 'sparkles', answers: 'quiz', level: 'layers' };
  const close = () => {
    overlay.remove();
    onKeys(null);
  };
  const overlay = h('div', { class: 'milestone', role: 'dialog', 'aria-modal': 'true', 'aria-label': t.milestoneTitle, onclick: (e) => e.target === overlay && close() },
    h('div', { class: 'milestone-card' },
      confetti(),
      h('span', { class: 'milestone-ic' }, icon(ICON[list[0].kind], { size: 40 })),
      h('p', { class: 'milestone-kicker' }, t.milestoneTitle),
      list.map((m) => h('h2', {}, t.milestoneNames[m.kind].replace('{n}', m.kind === 'level' ? levelName(m.n) : m.n.toLocaleString()))),
      h('p', { class: 'milestone-sub' }, t.milestoneSub),
      h('button', { class: 'btn primary big', type: 'button', onclick: close }, t.milestoneOk)));
  document.body.append(overlay);
  sfx('done');
  overlay.querySelector('button').focus({ preventScroll: true });
  onKeys((e) => {
    if (e.key === 'Escape' || e.key === 'Enter') {
      e.preventDefault();
      close();
    }
  });
}

function levelName(lv) {
  const t = state.t;
  return lv === 0 ? t.levelLetters : t.levelN.replace('{n}', lv);
}

function showResults(session) {
  const t = state.t;
  onKeys(null);
  const survival = session.mode === 'survival';
  const lang = session.lang;
  const total = session.items.length;
  const pct = total ? Math.round((session.correct / total) * 100) : 0;
  const secs = Math.round((Date.now() - session.startedAt) / 1000);
  const prev = getStats().sessions.filter((x) => x.lang === lang && x.n && x.mode !== 'survival').at(-1);
  const prevPct = prev && !survival ? Math.round((prev.c / prev.n) * 100) : null;
  const mastered = [...session.mastered.values()];
  logSession({ lang, mode: session.mode, n: total, c: session.correct, s: secs, t: Date.now(), b: session.bestCombo, m: mastered.length });
  noteRound(lang, { mode: session.mode, n: total, c: session.correct });
  // Only call it a record when there was one to beat, not on the very first game.
  const records = getRecords(lang);
  const prevCombo = records.combo || 0;
  const prevSurvival = records.survival || 0;
  const comboRecord = session.bestCombo >= 2 && saveRecord(lang, 'combo', session.bestCombo) && prevCombo > 0;
  const survivalRecord = survival && session.correct > 0 && saveRecord(lang, 'survival', session.correct) && prevSurvival > 0;
  const starsImproved = roundStars(session);
  const questJustDone = syncQuests(lang);
  const newBadges = badgeList(lang).filter((b) => b.earned && !session.badgesBefore.has(b.id));
  const newMilestones = [...milestones(lang)].filter(([id]) => !session.milestonesBefore.has(id)).map(([, m]) => m);
  const xpAfter = totalXP();
  const levelUp = playerLevel(xpAfter).level > playerLevel(session.xpBefore).level;
  const newUnlocks = [...unlockedIds()].filter((id) => !session.unlocksBefore.has(id));
  const message = survival
    ? t.survivalOver.replace('{n}', session.correct)
    : pct >= 90 ? t.resultGreat : pct >= 60 ? t.resultGood : t.resultKeep;

  const goal = settings.dailyGoal;
  const today = todayAnswers(lang);
  const goalJustMet = goal > 0 && session.before < goal && today >= goal;
  const days = streak(dayTotals(lang));
  const diff = prevPct === null ? null : pct - prevPct;
  const stars = survival || total < 4 ? null : starsFor(session.correct, total);

  const pctNum = h('b', {}, survival ? String(session.correct) : `${pct}%`);
  const badges = h('div', { class: 'result-badges' },
    diff ? h('span', { class: `chip ${diff > 0 ? 'up' : 'down'}` }, `${diff > 0 ? '▲' : '▼'} ${Math.abs(diff)}% ${t.vsLast}`) : null,
    days ? h('span', { class: 'chip' }, icon('flame', { size: 14 }), `${days} ${t.days}`) : null,
    goal > 0 ? h('span', { class: `chip${today >= goal ? ' up' : ''}` }, icon('target', { size: 14 }), t.goalToday.replace('{n}', today).replace('{goal}', goal)) : null,
    survivalRecord ? h('span', { class: 'chip gold' }, icon('heart', { size: 14 }), t.survivalRecord.replace('{n}', session.correct)) : null,
    survival && !survivalRecord && prevSurvival ? h('span', { class: 'chip' }, icon('trophy', { size: 14 }), `${t.best} ${getRecords(lang).survival}`) : null,
    comboRecord ? h('span', { class: 'chip gold' }, icon('bolt', { size: 14 }), t.comboRecord.replace('{n}', session.bestCombo)) : null,
    session.matchRecord ? h('span', { class: 'chip gold' }, icon('trophy', { size: 14 }), `${t.newRecord} ${session.matchRecord.toFixed(1)} ${t.sec}`) : null,
  );
  const badgeBox = newBadges.length
    ? h('div', { class: 'badge-box' },
        h('strong', {}, icon('medal', { size: 18 }), t.newBadges),
        h('div', { class: 'badge-chips' }, newBadges.map((b) =>
          h('span', { class: 'badge-chip' }, h('span', { class: `row-icon ${b.color}` }, icon(b.icon, { size: 16 })), b.name))))
    : null;
  const starsBox = starsImproved.length
    ? h('div', { class: 'stars-box' },
        h('strong', {}, icon('star', { size: 18, fill: true }), t.newStars),
        h('ul', {}, starsImproved.map(({ set, stars: n }) =>
          h('li', {}, h('span', { 'aria-hidden': 'true' }, set.icon), h('span', { class: 'stars-set' }, nameOf(set.name)), starRow(n)))))
    : null;
  const unlockBox = newUnlocks.length
    ? h('div', { class: 'badge-box unlock-box' },
        h('strong', {}, icon('gift', { size: 18 }), t.newUnlocks),
        h('div', { class: 'badge-chips' }, newUnlocks.map((id) =>
          h('a', { class: 'badge-chip', href: '#/settings' }, h('span', { class: 'row-icon indigo' }, icon('palette', { size: 16 })), t.lookNames[id]))))
    : null;
  const celebrate = goalJustMet || pct === 100 || newBadges.length > 0 || comboRecord || survivalRecord || !!session.matchRecord || questJustDone || levelUp;
  if (celebrate && !newMilestones.length) sfx('done');
  const masteredBox = mastered.length
    ? h('div', { class: 'mastered-box' },
        h('strong', {}, icon('sparkles', { size: 18 }), t.newMastered.replace('{n}', mastered.length)),
        h('div', { class: 'mastered-words' }, mastered.slice(0, 12).map((it) => h('span', { class: 'word-chip', lang: it.lang }, it.term))))
    : null;

  const reviewList = session.wrong.length
    ? h('ul', { class: 'group list' }, session.wrong.map((it) =>
        h('li', { class: 'row' },
          h('span', { class: 'rv-term' }, h('span', { lang: it.lang }, it.term), readingSmall(it)),
          h('span', { class: 'rv-answer' }, it.answer),
          speakerBtn(it.term, { lang: it.lang }),
        )))
    : h('p', { class: 'empty' }, icon('check', { size: 20 }), t.perfect);

  render(h('div', { class: 'results' },
    h('div', { class: 'game-top' },
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': t.done, onclick: exitGame }, icon('close')),
      h('span', { class: 'top-title' }, t.resultTitle),
      h('span', { class: 'icon-btn-spacer' }),
    ),
    h('section', { class: 'result-hero' },
      celebrate ? confetti() : null,
      h('div', { class: 'ring-wrap' }, scoreRing(survival ? Math.min(100, (session.correct / Math.max(1, getRecords(lang).survival || 1)) * 100) : pct),
        h('div', { class: 'ring-label' }, pctNum, h('span', {}, survival ? t.survivalScore : t.accuracy))),
      stars !== null ? starRow(stars, { size: 30, cls: 'big' }) : null,
      h('p', { class: 'result-msg' }, goalJustMet ? t.goalReached : message),
      badges,
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('b', {}, `${session.correct}/${total}`), h('span', {}, t.score)),
        h('div', { class: 'stat' }, h('b', {}, `${secs} ${t.sec}`), h('span', {}, t.time)),
        h('div', { class: 'stat' }, h('b', {}, `×${session.bestCombo}`), h('span', {}, t.bestCombo)),
      ),
    ),
    xpBar(session.xpBefore, xpAfter),
    questBox(lang, questJustDone),
    unlockBox,
    badgeBox,
    starsBox,
    masteredBox,
    groupTitle(t.reviewWrong),
    reviewList,
    h('div', { class: 'actions stack' },
      session.wrong.length
        ? h('button', { class: 'btn primary big', type: 'button', onclick: () => startGame(shuffle(session.wrong), session.pool, { mode: survival ? 'mix' : session.mode }) }, icon('repeat', { size: 20 }), t.practiceWrong)
        : null,
      h('button', {
        class: `btn big${session.wrong.length ? '' : ' primary'}`,
        type: 'button',
        onclick: () => startGame(survival ? [] : pickItems(session.pool, settings.count), session.pool, { mode: session.mode }),
      }, icon('play', { size: 18, fill: true }), t.playAgain),
      h('button', { class: 'btn ghost', type: 'button', onclick: exitGame }, t.done),
    ),
  ));
  countUp(pctNum, survival ? session.correct : pct, survival ? '' : '%');
  if (newMilestones.length) milestoneOverlay(newMilestones);
}
