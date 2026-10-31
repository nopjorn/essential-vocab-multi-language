// Home tab: language switch, progress summary, game mode and word sets, plus
// startPractice() for the Start button in the middle of the tab bar.
// App-wide options (translation, question count, theme…) live in the Settings tab.
import { settings, saveSettings, wordKey, getProgress, todayAnswers, MASTERED_BOX } from './store.js';
import { state, h, fill, render, nameOf, levelOf, levelLabel, loadLang, setUiLang, ensureAudio, pageHead, groupTitle, toast } from './core.js';
import { speechSupported } from './speech.js';
import { MODES, itemsFor, pickItems, startGame } from './game.js';
import { langSummary, dayTotals, streak } from './progress.js';
import { icon, MODE_ICON } from './icons.js';
import { isIOS, isStandalone } from './app-info.js';

const QUICK_COUNT = 5;

// Sets chosen for a language; new users start with its first two sets.
function chosenIds(vocab) {
  return settings.sets[vocab.code] || vocab.sets.slice(0, 2).map((x) => x.id);
}

// Start a round with the current language, mode and sets. The Start button lives in
// the tab bar, so this can run from any tab; when the selection can't make a round,
// it sends the user Home to fix it.
export async function startPractice({ count = settings.count } = {}) {
  const t = state.t;
  ensureAudio(); // iOS only allows speech after a tap, so unlock it before awaiting
  const nav = state.navId;
  let vocab;
  try {
    vocab = await loadLang(settings.lang);
  } catch (err) {
    console.error(err);
    return toast(t.loadError);
  }
  if (nav !== state.navId) return;
  if (settings.mode === 'listen' && !speechSupported) settings.mode = 'quiz';
  const items = itemsFor(vocab, chosenIds(vocab));
  const problem = !items.length ? t.pickSet : settings.mode !== 'flash' && items.length < 4 ? t.notEnough : null;
  if (problem) {
    if (location.hash && location.hash !== '#/') location.hash = '#/';
    return toast(problem);
  }
  startGame(pickItems(items, count), items);
}

// Plays one set on its own without changing the selection (recommended card, word list).
export function playSet(vocab, setId) {
  ensureAudio(); // iOS only allows speech after a tap
  settings.lang = vocab.code;
  if (settings.mode === 'listen' && !speechSupported) settings.mode = 'quiz';
  saveSettings();
  const items = itemsFor(vocab, [setId]);
  startGame(pickItems(items, settings.count), items);
}

// Next set on the learning path: the first unfinished set already started, else the first
// unfinished one, looking at the shown level first.
function nextSet(info, level) {
  const open = info.filter((x) => x.mastered < x.total);
  const order = [...open.filter((x) => levelOf(x.set) === level), ...open.filter((x) => levelOf(x.set) !== level)];
  return order.find((x) => x.seen > 0) || order[0] || null;
}

export async function renderPractice() {
  setUiLang();
  const t = state.t;
  const nav = state.navId;

  let vocab;
  try {
    vocab = await loadLang(settings.lang);
    if (nav !== state.navId) return;
  } catch (err) {
    console.error(err);
    render(pageHead(t.practiceTitle), h('div', { class: 'card error' }, t.loadError, ' ', h('button', { class: 'btn', onclick: renderPractice }, '↻')));
    return;
  }
  const code = vocab.code;
  if (settings.mode === 'listen' && !speechSupported) settings.mode = 'quiz';

  const chosen = new Set(chosenIds(vocab));
  const persistSets = () => {
    settings.sets[code] = [...chosen];
    saveSettings();
  };

  // ---- language switch ----
  const langSwitch = h('div', { class: 'lang-switch', role: 'tablist', 'aria-label': t.practiceSub },
    state.index.learn.map((l) => {
      const active = l.code === code;
      return h('button', {
        type: 'button',
        role: 'tab',
        class: `lang-opt${active ? ' active' : ''}`,
        'aria-selected': String(active),
        onclick: () => {
          if (active) return;
          settings.lang = l.code;
          saveSettings();
          renderPractice();
        },
      }, h('span', { class: 'flag', 'aria-hidden': 'true' }, l.flag), h('span', { class: 'lang-opt-name' }, nameOf(l.name)));
    }),
  );

  // ---- progress summary for this language (footer of the Today card) ----
  const s = langSummary(vocab);
  const answered = s.c + s.w;
  const summary = h('a', { class: 'today-foot', href: `#/progress/${code}` },
    h('span', { class: 'today-foot-text' },
      h('span', {}, `${t.mastered} `, h('b', {}, s.mastered.toLocaleString()), ` / ${s.total.toLocaleString()} ${t.words}`),
      h('span', { class: 'meter' }, h('span', { class: 'meter-fill', style: `width:${s.total ? (s.mastered / s.total) * 100 : 0}%` }))),
    h('span', { class: 'chip-stat', title: t.accuracy }, icon('target', { size: 15 }), answered ? `${Math.round((s.c / answered) * 100)}%` : '–'),
    icon('chevronRight', { size: 18, cls: 'chev' }),
  );

  // ---- today: daily goal ring, streak and one-tap start ----
  const goal = settings.dailyGoal;
  const done = todayAnswers(code);
  const goalPct = goal ? Math.min(100, Math.round((done / goal) * 100)) : 0;
  const days = streak(dayTotals(code));
  const todayCard = h('section', { class: 'today-card' },
    h('div', { class: `goal-ring${goal && done >= goal ? ' done' : ''}${done >= 100 ? (done >= 1000 ? ' d4' : ' d3') : ''}`, style: `--p:${goalPct}`, role: 'img', 'aria-label': `${t.todayGoal} ${done}/${goal}` },
      h('b', {}, goal ? `${done}` : '–'), goal ? h('span', {}, `/${goal}`) : null),
    h('div', { class: 'today-text' },
      h('strong', {}, goal && done >= goal ? t.goalReached : done ? t.todayKeepGoing : t.todayStart),
      h('span', { class: 'today-sub' }, icon('flame', { size: 15 }), days ? `${days} ${t.days}` : t.streakStart)),
    h('div', { class: 'today-actions' },
      h('button', { class: 'btn primary', type: 'button', onclick: () => startPractice() }, icon('play', { size: 16, fill: true }), t.continueBtn),
      h('button', { class: 'btn', type: 'button', onclick: () => startPractice({ count: QUICK_COUNT }) }, icon('clock', { size: 16 }), t.quickN.replace('{n}', QUICK_COUNT))),
    summary,
  );

  // ---- what Start will play (the button itself is in the tab bar) ----
  const setsFoot = h('p', { class: 'group-foot sets-foot' });
  const refreshFoot = () => {
    const words = vocab.sets.filter((x) => chosen.has(x.id)).reduce((n, x) => n + x.words.length, 0);
    const q = settings.mode === 'match' || settings.count === 0 ? words : Math.min(settings.count, words);
    setsFoot.textContent = chosen.size
      ? t.setsSummary.replace('{sets}', chosen.size).replace('{words}', words.toLocaleString()).replace('{q}', q)
      : t.pickSet;
  };

  // ---- game modes ----
  const modeDesc = h('p', { class: 'mode-desc-line' }, t.modes[settings.mode][1]);
  const modeTiles = MODES.map((m) =>
    h('button', {
      type: 'button',
      role: 'radio',
      class: `mode-tile${settings.mode === m ? ' active' : ''}`,
      'aria-checked': String(settings.mode === m),
      disabled: m === 'listen' && !speechSupported,
      onclick: () => {
        settings.mode = m;
        saveSettings();
        modeTiles.forEach((b, i) => {
          b.classList.toggle('active', MODES[i] === m);
          b.setAttribute('aria-checked', String(MODES[i] === m));
        });
        modeDesc.textContent = t.modes[m][1];
        refreshFoot();
      },
    },
    h('span', { class: 'mode-ic' }, icon(MODE_ICON[m], { size: 26 })),
    m === 'mix'
      ? h('span', { class: 'mode-text' }, h('span', { class: 'mode-name' }, t.modes[m][0], h('span', { class: 'mini-badge' }, t.recommended)), h('span', { class: 'mode-sub' }, t.modes[m][1]))
      : h('span', { class: 'mode-name' }, t.modes[m][0])),
  );
  modeTiles[0].classList.add('mode-mix');

  // ---- word sets, one level at a time ----
  const levels = [...new Set(vocab.sets.map(levelOf))].sort((a, b) => a - b);
  let level = settings.level[code];
  if (!levels.includes(level)) level = levelOf(vocab.sets.find((x) => chosen.has(x.id)) || vocab.sets[0]);

  const rowsByLevel = new Map(levels.map((lv) => [lv, []]));
  const allRows = [];
  const hay = new Map(); // row → lowercase set names, terms and translations, for search
  const info = [];
  for (const set of vocab.sets) {
    const total = set.words.length;
    let mastered = 0;
    let seen = 0;
    for (const w of set.words) {
      const p = getProgress(wordKey(code, set.id, w.term));
      if (p.b >= MASTERED_BOX) mastered++;
      if (p.t) seen++;
    }
    info.push({ set, total, mastered, seen });
    const complete = mastered === total;
    const row = h('label', { class: `row set-row${complete ? ' complete' : ''}` },
      h('input', {
        type: 'checkbox',
        class: 'sr-only',
        checked: chosen.has(set.id),
        'data-set': set.id,
        onchange: (e) => {
          if (e.target.checked) chosen.add(set.id);
          else chosen.delete(set.id);
          persistSets();
          refreshFoot();
        },
      }),
      h('span', { class: 'set-ic', 'aria-hidden': 'true' }, set.icon,
        complete ? h('span', { class: 'set-crown' }, icon('crown', { size: 12 })) : null),
      h('span', { class: 'row-text' },
        h('span', { class: 'row-label' }, nameOf(set.name)),
        h('span', { class: 'row-sub' }, complete ? `${total} ${t.words} · ${t.setComplete}` : `${total} ${t.words} · ${t.mastered} ${mastered}`),
        h('span', { class: 'meter thin' }, h('span', { class: 'meter-fill', style: `width:${total ? (mastered / total) * 100 : 0}%` })),
      ),
      // Inside the label, so stop the tap from toggling the checkbox.
      h('a', {
        class: 'set-words',
        href: `#/words/${code}/${set.id}`,
        'aria-label': `${t.wordList}: ${nameOf(set.name)}`,
        onclick: (e) => e.stopPropagation(),
      }, icon('list', { size: 20 })),
      h('span', { class: 'check-circle', 'aria-hidden': 'true' }, icon('check', { size: 16 })),
    );
    rowsByLevel.get(levelOf(set)).push(row);
    allRows.push(row);
    hay.set(row, [set.name.th, set.name.en, ...set.words.flatMap((w) => [w.term, w.reading, w.roman, ...Object.values(w.tr)])]
      .filter(Boolean).join('\n').toLowerCase());
  }

  const setsList = h('div', { class: 'group list sets-list' });
  const levelInfo = h('p', { class: 'level-info' });
  // Search matches set names and the words inside them, across all levels.
  const search = h('input', {
    type: 'search',
    class: 'set-search',
    placeholder: t.searchSets,
    'aria-label': t.searchSets,
    enterkeyhint: 'search',
    autocomplete: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
    oninput: () => showLevel(),
  });
  let visible = [];
  const showLevel = () => {
    const q = search.value.trim().toLowerCase();
    levelSeg?.classList.toggle('dim', !!q);
    if (q) {
      visible = allRows.filter((row) => hay.get(row).includes(q));
      levelInfo.textContent = t.searchFound.replace('{n}', visible.length);
      fill(setsList, visible.length ? visible : h('p', { class: 'empty' }, t.searchNone));
      return;
    }
    const sets = vocab.sets.filter((x) => levelOf(x) === level);
    const words = sets.reduce((n, x) => n + x.words.length, 0);
    levelInfo.textContent = t.levelInfo
      .replace('{name}', t.levelNames[level])
      .replace('{sets}', sets.length)
      .replace('{words}', words.toLocaleString());
    visible = rowsByLevel.get(level);
    fill(setsList, visible);
  };
  const levelSeg = levels.length > 1
    ? h('div', { class: 'segmented level-seg', role: 'radiogroup', 'aria-label': t.level },
        levels.map((lv) =>
          h('label', {},
            h('input', {
              type: 'radio',
              name: 'level',
              value: lv,
              checked: lv === level,
              onchange: () => {
                level = lv;
                settings.level[code] = lv;
                saveSettings();
                search.value = '';
                showLevel();
              },
            }),
            h('span', {}, levelLabel(t, lv)))))
    : null;

  // Select all / clear act on the rows being shown (the level, or the search results).
  const setAll = (on) => {
    for (const row of visible) {
      const input = row.querySelector('input');
      input.checked = on;
      if (on) chosen.add(input.dataset.set);
      else chosen.delete(input.dataset.set);
    }
    persistSets();
    refreshFoot();
  };

  const setsTitle = groupTitle(t.chooseSets,
    h('button', { class: 'text-btn', type: 'button', onclick: () => setAll(true) }, t.selectAll),
    h('button', { class: 'text-btn', type: 'button', onclick: () => setAll(false) }, t.selectNone));
  setsTitle.classList.add('sets-title');

  // ---- recommended next set ----
  const rec = nextSet(info, level);
  const recCard = rec
    ? h('button', { class: 'next-card', type: 'button', onclick: () => playSet(vocab, rec.set.id) },
        h('span', { class: 'set-ic', 'aria-hidden': 'true' }, rec.set.icon),
        h('span', { class: 'row-text' },
          h('span', { class: 'next-label' }, icon('sparkles', { size: 14 }), t.nextUp),
          h('span', { class: 'row-label' }, nameOf(rec.set.name)),
          h('span', { class: 'row-sub' }, `${levelLabel(t, levelOf(rec.set))} · ${t.mastered} ${rec.mastered}/${rec.total}`),
          h('span', { class: 'meter thin' }, h('span', { class: 'meter-fill', style: `width:${(rec.mastered / rec.total) * 100}%` }))),
        h('span', { class: 'next-play', 'aria-hidden': 'true' }, icon('play', { size: 18, fill: true })),
        h('span', { class: 'sr-only' }, t.practiceThisSet))
    : null;

  showLevel();
  refreshFoot();

  render(
    pageHead(t.practiceTitle, { sub: t.practiceSub }),
    langSwitch,
    todayCard,
    recCard,
    isIOS() && !isStandalone()
      ? h('a', { class: 'install-card', href: '#/help/install' },
          h('span', { class: 'row-icon blue' }, icon('share', { size: 18 })),
          h('span', { class: 'row-text' }, h('span', { class: 'row-label' }, t.installTitle), h('span', { class: 'row-sub' }, t.installSub)),
          icon('chevronRight', { size: 18, cls: 'chev' }))
      : null,
    groupTitle(t.chooseMode),
    h('div', { class: 'mode-grid', role: 'radiogroup', 'aria-label': t.chooseMode }, modeTiles),
    modeDesc,
    h('section', { class: 'sets-col' },
      setsTitle,
      h('label', { class: 'search-box' }, icon('search', { size: 18 }), search),
      levelSeg,
      levelInfo,
      setsList,
      setsFoot),
  );
}
