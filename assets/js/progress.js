// Progress page: overview across all languages, and a detail view per language.
import { settings, saveSettings, wordKey, getProgress, getStats, dayKey, MASTERED_BOX } from './store.js';
import { state, h, render, nameOf, levelOf, levelLabel, loadAllLangs, loadLang, langMeta, answerOf, speakerBtn, readingText, pageHead, groupTitle } from './core.js';
import { itemsFor, startGame } from './game.js';
import { icon, MODE_ICON } from './icons.js';
import { badgeList } from './badges.js';
import { playerLevel, questDays } from './engage.js';

const CHART_DAYS = 14;

// ---------- data ----------

export function langSummary(vocab) {
  let fresh = 0;
  let learning = 0;
  let mastered = 0;
  let c = 0;
  let w = 0;
  const sets = vocab.sets.map((set) => {
    const s = { set, fresh: 0, learning: 0, mastered: 0, total: set.words.length };
    for (const word of set.words) {
      const p = getProgress(wordKey(vocab.code, set.id, word.term));
      c += p.c;
      w += p.w;
      if (!p.t) s.fresh++;
      else if (p.b >= MASTERED_BOX) s.mastered++;
      else s.learning++;
    }
    fresh += s.fresh;
    learning += s.learning;
    mastered += s.mastered;
    return s;
  });
  return { vocab, sets, fresh, learning, mastered, total: fresh + learning + mastered, c, w };
}

export function dayTotals(lang) {
  const out = {};
  for (const [day, langs] of Object.entries(getStats().days)) {
    let a = 0;
    let c = 0;
    for (const [code, v] of Object.entries(langs)) {
      if (lang && code !== lang) continue;
      a += v[0];
      c += v[1];
    }
    if (a) out[day] = [a, c];
  }
  return out;
}

// Streak freezes: every FREEZE_EVERY days played in a row earn one (kept up to FREEZE_MAX).
// A missed day while on a streak uses one up instead of breaking the streak. Everything is
// worked out from the daily stats, so nothing extra is stored and backups carry it along.
export const FREEZE_EVERY = 7;
export const FREEZE_MAX = 2;

// { days: current streak, best: longest ever, freezes: held now, frozen: Set of days saved by
// a freeze, today: played today }. Today not played yet doesn't break the streak.
export function streakInfo(totals) {
  const today = dayKey();
  const first = Object.keys(totals).sort()[0];
  const info = { days: 0, best: 0, freezes: 0, frozen: new Set(), today: !!totals[today] };
  if (!first) return info;
  let toward = 0;
  const [y, m, dd] = first.split('-').map(Number);
  for (const d = new Date(y, m - 1, dd); ; d.setDate(d.getDate() + 1)) {
    const key = dayKey(d);
    if (key > today) break;
    if (totals[key]) {
      info.days++;
      info.best = Math.max(info.best, info.days);
      if (++toward >= FREEZE_EVERY) {
        toward = 0;
        info.freezes = Math.min(FREEZE_MAX, info.freezes + 1);
      }
    } else if (key !== today) {
      if (info.days > 0 && info.freezes > 0) {
        info.freezes--;
        info.frozen.add(key);
      } else {
        info.days = 0;
        toward = 0;
      }
    }
  }
  return info;
}

export function streak(totals) {
  return streakInfo(totals).days;
}

function locale() {
  return settings.target === 'th' ? 'th-TH' : 'en-US';
}

function pct(a, b) {
  return b ? Math.round((a / b) * 100) : 0;
}

// ---------- pieces ----------

function tile(ic, value, label, sub) {
  return h('div', { class: 'tile-stat' },
    h('span', { class: 'tile-ic' }, icon(ic, { size: 18 })),
    h('b', {}, value), h('span', {}, label), sub ? h('small', {}, sub) : null);
}

// New / learning / mastered as one stacked bar with a legend carrying the counts.
function distribution(s, { legend = true } = {}) {
  const t = state.t;
  const parts = [
    ['mastered', s.mastered, t.statusMastered],
    ['learning', s.learning, t.statusLearning],
    ['fresh', s.fresh, t.statusNew],
  ];
  const bar = h('div', { class: 'dist', role: 'img', 'aria-label': parts.map(([, n, l]) => `${l} ${n}`).join(', ') },
    parts.filter(([, n]) => n > 0).map(([k, n, l]) =>
      h('span', { class: `seg seg-${k}`, style: `flex-grow:${n}`, title: `${l}: ${n}` })),
  );
  if (!legend) return bar;
  return h('div', {},
    bar,
    h('div', { class: 'legend' }, parts.map(([k, n, l]) =>
      h('span', { class: 'legend-item' }, h('i', { class: `swatch seg-${k}` }), `${l} `, h('b', {}, n)))),
  );
}

// Answers per day for the last CHART_DAYS days. Tapping/hovering a bar shows its numbers.
function activityChart(totals) {
  const t = state.t;
  const days = [];
  const d = new Date();
  d.setDate(d.getDate() - (CHART_DAYS - 1));
  for (let i = 0; i < CHART_DAYS; i++) {
    const key = dayKey(d);
    const [a, c] = totals[key] || [0, 0];
    days.push({ key, date: new Date(d), a, c });
    d.setDate(d.getDate() + 1);
  }
  const max = Math.max(1, ...days.map((x) => x.a));
  const caption = h('p', { class: 'chart-caption', 'aria-live': 'polite' }, t.tapBar);
  const fmt = (x) => `${x.date.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' })} · ${x.a} ${t.answersUnit}${x.a ? ` · ${t.accuracy} ${pct(x.c, x.a)}%` : ''}`;
  const show = (x, el) => {
    caption.textContent = fmt(x);
    el.parentElement.querySelectorAll('.col.active').forEach((c) => c.classList.remove('active'));
    el.classList.add('active');
  };
  const cols = days.map((x, i) => {
    const el = h('button', {
      class: `col${x.key === dayKey() ? ' today' : ''}`,
      type: 'button',
      'aria-label': fmt(x),
      onpointerenter: () => show(x, el),
      onfocus: () => show(x, el),
      onclick: () => show(x, el),
    },
    h('span', { class: 'col-bar', style: `height:${x.a ? Math.max(4, (x.a / max) * 100) : 0}%` }),
    h('span', { class: 'col-label' }, i % 2 === (CHART_DAYS - 1) % 2 ? x.date.getDate() : ''));
    return el;
  });
  return h('div', { class: 'chart' },
    h('div', { class: 'chart-head' }, h('span', {}, t.answersPerDay), h('span', { class: 'muted' }, `${t.max} ${max}`)),
    h('div', { class: 'cols' }, cols),
    caption,
  );
}

function tabs(active) {
  const t = state.t;
  return h('nav', { class: 'tabs', 'aria-label': t.progressTitle },
    h('a', { href: '#/progress', class: active ? '' : 'active', 'aria-current': active ? null : 'page' }, t.overview),
    state.index.learn.map((l) =>
      h('a', { href: `#/progress/${l.code}`, class: active === l.code ? 'active' : '', 'aria-current': active === l.code ? 'page' : null },
        `${l.flag} ${nameOf(l.name)}`)),
  );
}

// ---------- overview ----------

export async function renderProgress(lang) {
  const t = state.t;
  if (lang && !langMeta(lang)) lang = null;
  const nav = state.navId;
  let vocabs;
  try {
    vocabs = lang ? [await loadLang(lang)] : await loadAllLangs();
    if (nav !== state.navId) return;
  } catch (err) {
    console.error(err);
    render(pageHead(t.progressTitle), h('div', { class: 'card error' }, t.loadError));
    return;
  }
  if (lang) return renderLang(langSummary(vocabs[0]));

  const sums = vocabs.map(langSummary);
  const all = sums.reduce((a, s) => ({
    total: a.total + s.total, mastered: a.mastered + s.mastered, seen: a.seen + s.total - s.fresh, c: a.c + s.c, w: a.w + s.w,
  }), { total: 0, mastered: 0, seen: 0, c: 0, w: 0 });
  const totals = dayTotals();
  const sessions = getStats().sessions;
  const lv = playerLevel();
  const st = streakInfo(totals);

  render(
    pageHead(t.progressTitle),
    tabs(null),
    h('section', { class: 'card level-card' },
      h('span', { class: 'level-badge' }, h('small', {}, 'Lv'), h('b', {}, lv.level)),
      h('span', { class: 'row-text' },
        h('span', { class: 'row-label' }, t.playerLevel.replace('{n}', lv.level)),
        h('span', { class: 'xp-bar' }, h('span', { class: 'xp-fill', style: `width:${lv.pct}%` })),
        h('span', { class: 'row-sub' }, t.xpToNext.replace('{xp}', lv.xp.toLocaleString()).replace('{n}', (lv.to - lv.xp).toLocaleString())))),
    h('div', { class: 'tiles' },
      tile('check', `${all.mastered}`, t.wordsMastered, `/ ${all.total} · ${pct(all.mastered, all.total)}%`),
      tile('eye', `${all.seen}`, t.wordsSeen),
      tile('target', all.c + all.w ? `${pct(all.c, all.c + all.w)}%` : '–', t.accuracy),
      tile('flame', `${streak(totals)}`, t.streak, t.days),
      tile('quiz', `${all.c + all.w}`, t.totalAnswers),
      tile('repeat', `${sessions.length}`, t.sessions),
      tile('trophy', `${st.best}`, t.bestStreak, t.days),
      tile('gift', `${questDays()}`, t.questDays),
    ),
    groupTitle(t.last14),
    h('section', { class: 'card' }, activityChart(totals)),
    groupTitle(t.byLanguage),
    h('div', { class: 'group list' }, sums.map((s) => {
      const m = langMeta(s.vocab.code);
      return h('a', { class: 'row lp-row', href: `#/progress/${s.vocab.code}` },
        h('span', { class: 'flag big', 'aria-hidden': 'true' }, m.flag),
        h('span', { class: 'row-text' },
          h('span', { class: 'lp-head' },
            h('span', { class: 'row-label' }, nameOf(m.name)),
            h('span', { class: 'row-sub' }, `${t.mastered} ${s.mastered}/${s.total} · ${t.accuracy} ${s.c + s.w ? pct(s.c, s.c + s.w) + '%' : '–'}`)),
          distribution(s, { legend: false })),
        icon('chevronRight', { size: 18, cls: 'chev' }),
      );
    })),
    h('div', { class: 'legend pad' }, [['mastered', t.statusMastered], ['learning', t.statusLearning], ['fresh', t.statusNew]].map(([k, l]) =>
      h('span', { class: 'legend-item' }, h('i', { class: `swatch seg-${k}` }), l))),
  );
}

// ---------- one language ----------

// Per-set progress, grouped by level when the language has more than one.
function bySet(s) {
  const t = state.t;
  const levels = [...new Set(s.sets.map((x) => levelOf(x.set)))].sort((a, b) => a - b);
  return levels.map((lv) => {
    const sets = s.sets.filter((x) => levelOf(x.set) === lv);
    const mastered = sets.reduce((n, x) => n + x.mastered, 0);
    const total = sets.reduce((n, x) => n + x.total, 0);
    return [
      groupTitle(levels.length > 1 ? `${t.bySet} · ${levelLabel(t, lv)} ${t.levelNames[lv]}` : t.bySet,
        h('span', { class: 'muted' }, `${mastered}/${total}`)),
      h('ul', { class: 'group list' }, sets.map((x) =>
        h('li', { class: 'row' },
          h('span', { class: 'set-ic', 'aria-hidden': 'true' }, x.set.icon,
            x.mastered === x.total ? h('span', { class: 'set-crown' }, icon('crown', { size: 12 })) : null),
          h('span', { class: 'row-text' },
            h('span', { class: 'sp-head' }, h('span', { class: 'row-label' }, nameOf(x.set.name)), h('span', { class: 'row-sub' }, `${x.mastered}/${x.total}`)),
            distribution(x, { legend: false })),
        ))),
    ];
  });
}

// Earned badges in colour, locked ones grey with how far along they are.
function badgeGrid(lang) {
  const t = state.t;
  const list = badgeList(lang);
  return [
    groupTitle(t.badges, h('span', { class: 'muted' }, `${list.filter((b) => b.earned).length}/${list.length}`)),
    h('div', { class: 'badge-grid' }, list.map((b) =>
      h('div', { class: `badge-tile${b.earned ? ' earned' : ''}`, 'aria-label': `${b.name}${b.earned ? '' : ` ${b.have}/${b.need}`}` },
        h('span', { class: `badge-ic ${b.color}` }, icon(b.icon, { size: 22 })),
        h('span', { class: 'badge-name' }, b.name),
        b.earned ? null : h('span', { class: 'badge-prog' }, `${b.have}/${b.need}`)))),
  ];
}

function renderLang(s) {
  const t = state.t;
  const code = s.vocab.code;
  const totals = dayTotals(code);
  const sessions = getStats().sessions.filter((x) => x.lang === code).slice(-8).reverse();

  // weakest words: most wrong answers, then lowest box
  const weak = [];
  for (const set of s.vocab.sets) {
    for (const word of set.words) {
      const p = getProgress(wordKey(code, set.id, word.term));
      if (p.w > 0 && p.b < MASTERED_BOX) weak.push({ set, word, p });
    }
  }
  weak.sort((a, b) => b.p.w - a.p.w || a.p.b - b.p.b);
  const top = weak.slice(0, 10);

  const practiceWeak = () => {
    settings.lang = code;
    saveSettings();
    const pool = itemsFor(s.vocab, s.vocab.sets.map((x) => x.id));
    const keys = new Set(top.map((x) => wordKey(code, x.set.id, x.word.term)));
    const items = pool.filter((it) => keys.has(it.key));
    if (settings.mode === 'match' && items.length < 2) settings.mode = 'quiz';
    // survival never ends on its own word list, so weak words get the mixed mode instead
    startGame(items, pool, { mode: settings.mode === 'survival' ? 'mix' : settings.mode });
  };

  render(
    pageHead(t.progressTitle),
    tabs(code),
    h('div', { class: 'tiles four' },
      tile('check', `${s.mastered}`, t.wordsMastered, `/ ${s.total} · ${pct(s.mastered, s.total)}%`),
      tile('eye', `${s.total - s.fresh}`, t.wordsSeen),
      tile('target', s.c + s.w ? `${pct(s.c, s.c + s.w)}%` : '–', t.accuracy),
      tile('flame', `${streak(totals)}`, t.streak, t.days),
    ),
    h('section', { class: 'card' }, distribution(s)),
    badgeGrid(code),
    groupTitle(t.last14),
    h('section', { class: 'card' }, activityChart(totals)),
    bySet(s),
    groupTitle(t.weakWords,
      top.length ? h('button', { class: 'text-btn', type: 'button', onclick: practiceWeak }, icon('repeat', { size: 16 }), t.practiceWeak) : null),
    top.length
      ? h('ul', { class: 'group list' }, top.map(({ word, p }) =>
          h('li', { class: 'row' },
            h('span', { class: 'rv-term' }, h('span', { lang: code }, word.term), readingText(word) ? h('small', {}, readingText(word)) : null),
            h('span', { class: 'rv-answer' }, answerOf(word), h('small', { class: 'muted block' }, `${t.wrongTimes} ${p.w}`)),
            speakerBtn(word.term, { lang: code }),
          )))
      : h('p', { class: 'empty' }, icon('check', { size: 20 }), t.noWeak),
    groupTitle(t.recentSessions),
    sessions.length
      ? h('ul', { class: 'group list' }, sessions.map((x) =>
          h('li', { class: 'row' },
            h('span', { class: 'row-icon indigo' }, icon(MODE_ICON[x.mode] || 'quiz', { size: 18 })),
            h('span', { class: 'row-text' },
              h('span', { class: 'row-label' }, t.modes[x.mode]?.[0] || x.mode),
              h('span', { class: 'row-sub' }, new Date(x.t).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))),
            h('b', { class: 'row-value strong' }, `${x.c}/${x.n}`),
          )))
      : h('p', { class: 'empty' }, t.noData),
  );
}
