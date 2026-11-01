// Reasons to come back: daily quests, XP and player level, milestones, unlockable looks,
// the week strip and the welcome-back check. Like badges, all of it is worked out from
// stats and progress, so it also covers older progress and backups. Only the days with
// all quests done are stored (stats.quests), because sessions are trimmed over time.
import { settings, getStats, dayKey, markQuestsDone, wordKey, getProgress, MASTERED_BOX } from './store.js';
import { state, cachedLang, levelOf } from './core.js';
import { dayTotals, streakInfo } from './progress.js';
import { speechSupported } from './speech.js';

// ---------- daily quests ----------

const QUEST_BONUS = 100; // XP for finishing all three in a day

// Small seeded generator, so a day and language always get the same three quests.
function seeded(text) {
  let x = 2166136261;
  for (const ch of text) x = Math.imul(x ^ ch.charCodeAt(0), 16777619);
  return () => {
    x = Math.imul(x ^ (x >>> 15), 2246822507);
    x = Math.imul(x ^ (x >>> 13), 3266489909);
    return ((x ^= x >>> 16) >>> 0) / 4294967296;
  };
}

const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];

function todaySessions(lang, day) {
  return getStats().sessions.filter((s) => s.lang === lang && s.t && dayKey(new Date(s.t)) === day);
}

// Quest kinds and how far along today is. `have` comes from today's answers and sessions.
const KINDS = {
  correct: { needs: [10, 15, 20, 30], have: (c) => c.day[1] },
  goal: { needs: [0], have: (c) => c.day[0], need: () => settings.dailyGoal || 20 },
  rounds: { needs: [2, 3], have: (c) => c.sessions.length },
  combo: { needs: [5, 8, 10], have: (c) => Math.max(0, ...c.sessions.map((s) => s.b || 0)) },
  perfect: { needs: [5], have: (c) => (c.sessions.some((s) => s.n >= 5 && s.c === s.n) ? 5 : 0) },
  master: { needs: [3, 5], have: (c) => c.sessions.reduce((n, s) => n + (s.m || 0), 0) },
  mode: { needs: [1], have: (c, q) => c.sessions.filter((s) => s.mode === q.mode).length },
};
const QUEST_MODES = ['flash', 'quiz', 'reverse', 'listen', 'type', 'match', 'survival'];

export function dailyQuests(lang, day = dayKey()) {
  const t = state.t;
  const rnd = seeded(`${day}|${lang}`);
  const kinds = Object.keys(KINDS);
  const chosen = [];
  // goal and correct overlap, so never give both on the same day
  while (chosen.length < 3) {
    const k = pick(rnd, kinds);
    if (chosen.includes(k) || (k === 'goal' && chosen.includes('correct')) || (k === 'correct' && chosen.includes('goal'))) continue;
    chosen.push(k);
  }
  const ctx = { day: getStats().days[day]?.[lang] || [0, 0], sessions: todaySessions(lang, day) };
  return chosen.map((kind) => {
    const def = KINDS[kind];
    const q = { kind, need: def.need ? def.need() : pick(rnd, def.needs) };
    if (kind === 'mode') q.mode = pick(rnd, QUEST_MODES.filter((m) => m !== 'listen' || speechSupported));
    q.have = Math.min(q.need, def.have(ctx, q));
    q.done = q.have >= q.need;
    q.text = t.questText[kind].replace('{n}', q.need).replace('{mode}', q.mode ? t.modes[q.mode][0] : '');
    return q;
  });
}

// Records the day when all three quests are done. Returns true the first time, so the
// results screen can celebrate it; Home calls it too in case a game was left early.
export function syncQuests(lang) {
  return dailyQuests(lang).every((q) => q.done) && markQuestsDone(lang);
}

export function questsDoneToday(lang) {
  return (getStats().quests[dayKey()] || []).includes(lang);
}

export function questDays() {
  return Object.values(getStats().quests).reduce((n, langs) => n + langs.length, 0);
}

// ---------- XP and player level ----------

// 10 XP per correct answer, 2 per wrong one (trying counts), 30 per day played and
// QUEST_BONUS per day of finished quests. Shared by all languages.
export function totalXP() {
  const s = getStats();
  let xp = 0;
  for (const langs of Object.values(s.days)) {
    let played = false;
    for (const [a, c] of Object.values(langs)) {
      xp += c * 10 + (a - c) * 2;
      if (a) played = true;
    }
    if (played) xp += 30;
  }
  return xp + questDays() * QUEST_BONUS;
}

// Level n starts at 50·n·(n−1) XP: 100 XP for level 2, then each level needs 100 more.
const levelStart = (n) => 50 * n * (n - 1);

export function playerLevel(xp = totalXP()) {
  const level = Math.max(1, Math.floor((1 + Math.sqrt(1 + 0.08 * xp)) / 2));
  const from = levelStart(level);
  const to = levelStart(level + 1);
  return { level, xp, from, to, pct: Math.round(((xp - from) / (to - from)) * 100) };
}

// ---------- milestones (celebrated full screen once, when a round crosses one) ----------

const MASTERED_STEPS = [100, 250, 500, 1000, 2000, 3000];
const ANSWER_STEPS = [500, 1000, 2500, 5000, 10000];

export function milestones(lang) {
  const out = new Map();
  const vocab = cachedLang(lang);
  let mastered = 0;
  if (vocab) {
    const byLevel = new Map();
    for (const set of vocab.sets) {
      const lv = levelOf(set);
      const m = set.words.filter((w) => getProgress(wordKey(lang, set.id, w.term)).b >= MASTERED_BOX).length;
      mastered += m;
      const acc = byLevel.get(lv) || { m: 0, n: 0 };
      acc.m += m;
      acc.n += set.words.length;
      byLevel.set(lv, acc);
    }
    for (const [lv, { m, n }] of byLevel) if (m === n) out.set(`lv${lv}`, { kind: 'level', n: lv });
  }
  for (const n of MASTERED_STEPS) if (mastered >= n) out.set(`m${n}`, { kind: 'mastered', n });
  const answers = Object.values(getStats().days).reduce((a, d) => a + (d[lang]?.[0] || 0), 0);
  for (const n of ANSWER_STEPS) if (answers >= n) out.set(`a${n}`, { kind: 'answers', n });
  return out;
}

// ---------- unlockable looks ----------

// [setting, value, rule, need]; rule 'level' = player level, 'quests' = days with all quests
// done, 'streak' = best streak ever (any language).
export const UNLOCKS = [
  ['soundPack', 'soft', 'level', 2],
  ['accent', 'green', 'level', 3],
  ['cardStyle', 'dots', 'quests', 3],
  ['accent', 'pink', 'level', 6],
  ['soundPack', 'retro', 'streak', 7],
  ['cardStyle', 'stripes', 'quests', 10],
  ['accent', 'orange', 'level', 10],
];
export const LOOKS = {
  accent: ['indigo', 'green', 'pink', 'orange'],
  cardStyle: ['plain', 'dots', 'stripes'],
  soundPack: ['classic', 'soft', 'retro'],
};

function unlockProgress() {
  return { level: playerLevel().level, quests: questDays(), streak: streakInfo(dayTotals()).best };
}

export function isUnlocked(key, value, have = unlockProgress()) {
  const rule = UNLOCKS.find(([k, v]) => k === key && v === value);
  return !rule || have[rule[2]] >= rule[3];
}

// Requirement text for a locked look, e.g. "Lv 6".
export function unlockNeed(key, value) {
  const rule = UNLOCKS.find(([k, v]) => k === key && v === value);
  return rule ? state.t.unlockRule[rule[2]].replace('{n}', rule[3]) : '';
}

export function unlockedIds() {
  const have = unlockProgress();
  return new Set(UNLOCKS.filter(([k, v]) => isUnlocked(k, v, have)).map(([k, v]) => `${k}:${v}`));
}

// ---------- week strip and welcome back ----------

// Monday to Sunday of this week: played, goal met, saved by a freeze, today, still ahead.
export function weekDays(lang) {
  const totals = dayTotals(lang);
  const info = streakInfo(totals);
  const goal = settings.dailyGoal;
  const today = dayKey();
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, () => {
    const key = dayKey(d);
    const date = new Date(d);
    d.setDate(d.getDate() + 1);
    const a = totals[key]?.[0] || 0;
    return { key, date, played: a > 0, goal: goal > 0 && a >= goal, frozen: info.frozen.has(key), today: key === today, future: key > today };
  });
}

// Whole days since the language was last played (null when never played).
export function daysAway(lang) {
  const last = Object.keys(dayTotals(lang)).sort().at(-1);
  if (!last) return null;
  const [y, m, d] = last.split('-').map(Number);
  const now = new Date();
  return Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(y, m - 1, d)) / 86400000);
}
