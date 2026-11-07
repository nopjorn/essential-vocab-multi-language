// Settings, learning progress and activity stats, kept in localStorage.
// Storage can be unavailable (private mode, blocked site data), so every
// access is guarded and the app keeps working in memory.

const SETTINGS_KEY = 'evocab.settings.v1';
const PROGRESS_KEY = 'evocab.progress.v1';
const STATS_KEY = 'evocab.stats.v1';
const SAVED_KEY = 'evocab.saved.v1';
const MAX_SESSIONS = 200;
export const MAX_BOX = 5;
export const MASTERED_BOX = 3;
// Days until a word is due again, by the box it just reached. A wrong answer (box 0) is due at once.
export const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];
const DAY_MS = 864e5;

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// Writes are batched: record() would otherwise stringify the whole progress map on every answer.
// The latest value per key is flushed shortly after, and at once when the page is hidden or closed.
const pending = new Map();
let timer = 0;

export function flush() {
  clearTimeout(timer);
  timer = 0;
  for (const [key, value] of pending) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }
  pending.clear();
}

function save(key, value) {
  pending.set(key, value);
  if (!timer) timer = setTimeout(flush, 500);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  addEventListener('pagehide', flush);
}

const DEFAULT_SETTINGS = {
  lang: 'en',
  target: 'th',
  sets: {}, // { [lang]: [setId, ...] }
  level: {}, // { [lang]: 0 | 1 | 2 | 3 } level shown in the word-set list
  mode: 'mix',
  count: 10,
  dailyGoal: 20, // answers per day; the Home ring fills toward it
  showRoman: true,
  autoSpeak: true,
  speechRate: 'normal', // 'slow' | 'normal' | 'fast'
  introNew: true, // show words never seen before at the start of a round
  newPerDay: 0, // most new words per day and language; 0 = no limit
  sound: true, // short sound effects for right/wrong answers and combos
  theme: 'system', // 'system' | 'light' | 'dark'
  textSize: 'normal', // 'normal' | 'large' | 'xlarge': size of words, answers and options
  // Unlockable looks (engage.js decides what is unlocked; the default is always available)
  accent: 'indigo', // 'indigo' | 'green' | 'pink' | 'orange'
  cardStyle: 'plain', // flashcard pattern: 'plain' | 'dots' | 'stripes'
  soundPack: 'classic', // 'classic' | 'soft' | 'retro'
  seenTips: [], // first-time tips already shown: 'flash' | 'type' | 'dictate' | 'match'
  backupSnooze: 0, // ms timestamp when the backup reminder was last dismissed
  lastExportedAt: 0, // ms timestamp of the last backup file; drives the backup reminder on Home
};

// Nothing saved yet on this device: show the welcome screen instead of Home.
// Blocked storage reads as "not first run" so the welcome never loops.
export const firstRun = (() => {
  try {
    return !localStorage.getItem(SETTINGS_KEY) && !localStorage.getItem(PROGRESS_KEY);
  } catch {
    return false;
  }
})();

export const settings = { ...DEFAULT_SETTINGS, ...load(SETTINGS_KEY, {}) };

export function saveSettings() {
  save(SETTINGS_KEY, settings);
}

// ---------- per-word progress ----------
// { [wordKey]: { b: box 0..MAX_BOX, c: correct, w: wrong, t: lastSeen, d?: due time } }
// d (added in 1.16) is optional: older words fall back to t + the interval of their box.
const progress = load(PROGRESS_KEY, {});

export function wordKey(lang, setId, term) {
  return `${lang}|${setId}|${term}`;
}

export function getProgress(key) {
  return progress[key] || { b: 0, c: 0, w: 0, t: 0 };
}

// When a word that has been answered before is due for review (0 = never answered, so "new", not due).
export function dueAt(p) {
  if (!p.t) return 0;
  return p.d ?? p.t + INTERVAL_DAYS[Math.min(MAX_BOX, p.b)] * DAY_MS;
}

// Totals of one language straight from the progress map, for pages that don't load its words
// (Progress overview). Words never answered are "fresh": the caller knows the word count.
export function langProgress(lang) {
  const out = { mastered: 0, learning: 0, c: 0, w: 0 };
  const prefix = `${lang}|`;
  for (const [key, p] of Object.entries(progress)) {
    if (!key.startsWith(prefix) || !p.t) continue;
    if (p.b >= MASTERED_BOX) out.mastered++;
    else out.learning++;
    out.c += p.c;
    out.w += p.w;
  }
  return out;
}

export function isDue(p, now = Date.now()) {
  return p.t > 0 && dueAt(p) <= now;
}

// A "leech" keeps being forgotten: wrong at least LEECH_WRONG times and no more often right than wrong.
// Drilling it the usual way does not help, so the app points it out and offers flashcards with notes.
export const LEECH_WRONG = 4;
export function isLeech(p) {
  return p.w >= LEECH_WRONG && p.w >= p.c && p.b < MASTERED_BOX;
}

// ---------- activity stats ----------
// days: { 'YYYY-MM-DD': { [lang]: [answers, correct, new?] } } (new = words answered for the first time, added in 1.19)
// sessions: [{ lang, mode, n, c, s: seconds, t: timestamp, b?: best combo, m?: newly mastered }], newest last
// records: { [lang]: { match: fastest full match round in seconds, combo: longest answer streak,
//   survival?: most correct answers in survival, stars?: { [setId]: 1..3 }, perfect?: perfect rounds,
//   modes?: [modes played], owl?: played late at night, early?: played early in the morning } }
// quests: { 'YYYY-MM-DD': [lang, ...] } days on which all three daily quests of a language were done
// xp?: bonus XP not derivable from answers (boss wins, speed bonuses; added in 1.20)
// Fields marked ? were added later and are optional, so older data needs no migration.
const stats = { days: {}, sessions: [], records: {}, quests: {}, ...load(STATS_KEY, {}) };

export function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Leitner-style boxes: correct moves the word up one box, wrong sends it back to box 0.
// Returns what undoRecord() needs to take the answer back (flashcard undo).
export function record(key, isCorrect) {
  const undo = { key, prev: progress[key], day: dayKey(), ok: isCorrect };
  const p = { ...getProgress(key) };
  if (isCorrect) {
    p.b = Math.min(MAX_BOX, p.b + 1);
    p.c += 1;
  } else {
    p.b = 0;
    p.w += 1;
  }
  p.t = Date.now();
  p.d = p.t + INTERVAL_DAYS[p.b] * DAY_MS;
  progress[key] = p;
  save(PROGRESS_KEY, progress);

  const lang = key.split('|')[0];
  const day = (stats.days[dayKey()] ||= {});
  const d = (day[lang] ||= [0, 0]);
  d[0] += 1;
  if (isCorrect) d[1] += 1;
  // first answer ever (a word marked as known has t but was never answered: not new any more)
  if (!undo.prev?.t) d[2] = (d[2] || 0) + 1;
  save(STATS_KEY, stats);
  return undo;
}

export function undoRecord({ key, prev, day, ok }) {
  if (prev) progress[key] = prev;
  else delete progress[key];
  save(PROGRESS_KEY, progress);
  const d = stats.days[day]?.[key.split('|')[0]];
  if (d) {
    d[0] = Math.max(0, d[0] - 1);
    if (ok) d[1] = Math.max(0, d[1] - 1);
    if (!prev?.t && d[2]) d[2] -= 1;
  }
  save(STATS_KEY, stats);
}

export function getRecords(lang) {
  return stats.records[lang] || {};
}

// Saves a personal best and returns true when it beats the old one
// (match: lower seconds is better, combo and survival: higher is better).
export function saveRecord(lang, kind, value) {
  const r = (stats.records[lang] ||= {});
  const better = kind === 'match' ? !(r.match <= value) : !(r[kind] >= value);
  if (!better) return false;
  r[kind] = value;
  save(STATS_KEY, stats);
  return true;
}

// Best stars (1–3) of a word set; returns true when this round improved them.
export function saveStars(lang, setId, n) {
  const r = (stats.records[lang] ||= {});
  const stars = (r.stars ||= {});
  if ((stars[setId] || 0) >= n) return false;
  stars[setId] = n;
  save(STATS_KEY, stats);
  return true;
}

// Lifetime facts about finished rounds that badges need. Kept in records because the
// session list is trimmed to MAX_SESSIONS and would forget them.
export function noteRound(lang, { mode, n, c }, when = new Date()) {
  const r = (stats.records[lang] ||= {});
  if (n >= 10 && c === n) r.perfect = (r.perfect || 0) + 1;
  if (n > 0) {
    r.modes ||= [];
    if (!r.modes.includes(mode)) r.modes.push(mode);
    const hour = when.getHours();
    if (hour >= 22 || hour < 4) r.owl = true;
    if (hour >= 4 && hour < 7) r.early = true;
  }
  save(STATS_KEY, stats);
}

// Extra XP on top of what answers earn (engage.totalXP adds it).
export function addBonusXP(n) {
  stats.xp = (stats.xp || 0) + n;
  save(STATS_KEY, stats);
}

// A boss round won (all its words typed right): counted per language for the results and badges.
export function noteBoss(lang) {
  const r = (stats.records[lang] ||= {});
  r.bosses = (r.bosses || 0) + 1;
  save(STATS_KEY, stats);
}

// All three daily quests of a language done today; returns true the first time.
export function markQuestsDone(lang, day = dayKey()) {
  const list = (stats.quests[day] ||= []);
  if (list.includes(lang)) return false;
  list.push(lang);
  save(STATS_KEY, stats);
  return true;
}

// "I already know this word" from the word list: moves it straight to the mastered box, or
// back to box 0 when undone. It is not an answer, so daily stats and accuracy stay untouched.
export function setKnown(key, known) {
  const p = { ...getProgress(key) };
  if (known) p.b = Math.max(p.b, MASTERED_BOX);
  else p.b = 0;
  p.t = Date.now();
  p.d = p.t + INTERVAL_DAYS[p.b] * DAY_MS;
  progress[key] = p;
  save(PROGRESS_KEY, progress);
}

// Answers given today in one language.
export function todayAnswers(lang) {
  return stats.days[dayKey()]?.[lang]?.[0] || 0;
}

// Words met for the first time today in one language (for the daily new-word limit).
export function todayNew(lang) {
  return stats.days[dayKey()]?.[lang]?.[2] || 0;
}

export function logSession(session) {
  stats.sessions.push(session);
  if (stats.sessions.length > MAX_SESSIONS) stats.sessions.splice(0, stats.sessions.length - MAX_SESSIONS);
  save(STATS_KEY, stats);
}

export function getStats() {
  return stats;
}

export function resetLanguage(lang) {
  for (const k of Object.keys(progress)) {
    if (k.startsWith(`${lang}|`)) delete progress[k];
  }
  for (const day of Object.values(stats.days)) delete day[lang];
  stats.sessions = stats.sessions.filter((s) => s.lang !== lang);
  delete stats.records[lang];
  for (const [day, langs] of Object.entries(stats.quests)) {
    stats.quests[day] = langs.filter((l) => l !== lang);
    if (!stats.quests[day].length) delete stats.quests[day];
  }
  save(PROGRESS_KEY, progress);
  save(STATS_KEY, stats);
}

// ---------- my words (notebook) ----------
// { [lang]: [wordKey, ...] } words starred by the player, newest last. Not progress: a reset keeps them.
const saved = load(SAVED_KEY, {});

export function isSaved(key) {
  return (saved[key.split('|')[0]] || []).includes(key);
}

// Stars or unstars a word; returns whether it is saved now.
export function toggleSaved(key) {
  const lang = key.split('|')[0];
  const list = (saved[lang] ||= []);
  const i = list.indexOf(key);
  if (i >= 0) list.splice(i, 1);
  else list.push(key);
  save(SAVED_KEY, saved);
  return i < 0;
}

export function savedKeys(lang) {
  return saved[lang] || [];
}

// ---------- backup (export / import) ----------
export const BACKUP_FORMAT = 'evocab-backup';

export function exportData(version) {
  return {
    format: BACKUP_FORMAT,
    v: 1,
    appVersion: version,
    exportedAt: new Date().toISOString(),
    progress,
    stats,
    saved,
  };
}

const num = (x) => (Number.isFinite(x) && x >= 0 ? x : 0);

// Merges a backup into this device instead of replacing it, so importing never loses newer
// answers: per word the most recently seen record wins, per day/language the larger count wins.
// Returns the number of words touched, or null when the file is not a valid backup.
export function importData(data) {
  if (!data || data.format !== BACKUP_FORMAT || data.v !== 1) return null;
  if (typeof data.progress !== 'object' || !data.progress) return null;
  let words = 0;
  for (const [key, p] of Object.entries(data.progress)) {
    if (key.split('|').length !== 3 || !p || typeof p !== 'object') continue;
    const inc = { b: Math.min(MAX_BOX, Math.floor(num(p.b))), c: num(p.c), w: num(p.w), t: num(p.t) };
    if (num(p.d) > 0) inc.d = num(p.d);
    if (!progress[key] || inc.t > progress[key].t) {
      progress[key] = inc;
      words++;
    }
  }
  const days = data.stats?.days;
  if (days && typeof days === 'object') {
    for (const [date, langs] of Object.entries(days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !langs || typeof langs !== 'object') continue;
      const day = (stats.days[date] ||= {});
      for (const [lang, a] of Object.entries(langs)) {
        if (!Array.isArray(a)) continue;
        const inc = [num(a[0]), num(a[1])];
        if (num(a[2]) > 0) inc.push(num(a[2]));
        if (!day[lang] || inc[0] > day[lang][0]) day[lang] = inc;
      }
    }
  }
  if (Array.isArray(data.stats?.sessions)) {
    const seen = new Set(stats.sessions.map((s) => `${s.lang}|${s.mode}|${s.t}`));
    for (const s of data.stats.sessions) {
      if (!s || typeof s.lang !== 'string' || !seen.add(`${s.lang}|${s.mode}|${s.t}`)) continue;
      stats.sessions.push(s);
    }
    stats.sessions.sort((a, b) => (a.t || 0) - (b.t || 0));
    if (stats.sessions.length > MAX_SESSIONS) stats.sessions.splice(0, stats.sessions.length - MAX_SESSIONS);
  }
  const records = data.stats?.records;
  if (records && typeof records === 'object') {
    for (const [lang, r] of Object.entries(records)) {
      if (!r || typeof r !== 'object') continue;
      if (num(r.match) > 0) saveRecord(lang, 'match', r.match);
      if (num(r.combo) > 0) saveRecord(lang, 'combo', r.combo);
      if (num(r.survival) > 0) saveRecord(lang, 'survival', r.survival);
      const mine = (stats.records[lang] ||= {});
      if (r.stars && typeof r.stars === 'object') {
        for (const [setId, n] of Object.entries(r.stars)) {
          if (num(n) > 0) saveStars(lang, setId, Math.min(3, Math.floor(n)));
        }
      }
      if (num(r.perfect) > (mine.perfect || 0)) mine.perfect = Math.floor(r.perfect);
      if (Array.isArray(r.modes)) mine.modes = [...new Set([...(mine.modes || []), ...r.modes.filter((m) => typeof m === 'string')])];
      if (num(r.bosses) > (mine.bosses || 0)) mine.bosses = Math.floor(r.bosses);
      if (r.owl === true) mine.owl = true;
      if (r.early === true) mine.early = true;
    }
  }
  // bonus XP is a lifetime total per device: keep the larger one rather than adding both
  if (num(data.stats?.xp) > (stats.xp || 0)) stats.xp = Math.floor(data.stats.xp);
  const quests = data.stats?.quests;
  if (quests && typeof quests === 'object') {
    for (const [date, langs] of Object.entries(quests)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(langs)) continue;
      stats.quests[date] = [...new Set([...(stats.quests[date] || []), ...langs.filter((l) => typeof l === 'string')])];
    }
  }
  if (data.saved && typeof data.saved === 'object') {
    for (const [lang, keys] of Object.entries(data.saved)) {
      if (!Array.isArray(keys)) continue;
      const ok = keys.filter((k) => typeof k === 'string' && k.split('|').length === 3 && k.startsWith(`${lang}|`));
      saved[lang] = [...new Set([...(saved[lang] || []), ...ok])];
    }
    save(SAVED_KEY, saved);
  }
  save(PROGRESS_KEY, progress);
  save(STATS_KEY, stats);
  return words;
}

export function getLastVersion() {
  return load('evocab.lastVersion', null);
}

export function setLastVersion(v) {
  save('evocab.lastVersion', v);
}
