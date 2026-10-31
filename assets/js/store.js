// Settings, learning progress and activity stats, kept in localStorage.
// Storage can be unavailable (private mode, blocked site data), so every
// access is guarded and the app keeps working in memory.

const SETTINGS_KEY = 'evocab.settings.v1';
const PROGRESS_KEY = 'evocab.progress.v1';
const STATS_KEY = 'evocab.stats.v1';
const MAX_SESSIONS = 200;
export const MAX_BOX = 5;
export const MASTERED_BOX = 3;

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
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
  sound: true, // short sound effects for right/wrong answers and combos
  theme: 'system', // 'system' | 'light' | 'dark'
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
// { [wordKey]: { b: box 0..MAX_BOX, c: correct, w: wrong, t: lastSeen } }
const progress = load(PROGRESS_KEY, {});

export function wordKey(lang, setId, term) {
  return `${lang}|${setId}|${term}`;
}

export function getProgress(key) {
  return progress[key] || { b: 0, c: 0, w: 0, t: 0 };
}

// ---------- activity stats ----------
// days: { 'YYYY-MM-DD': { [lang]: [answers, correct] } }
// sessions: [{ lang, mode, n, c, s: seconds, t: timestamp }], newest last
// records: { [lang]: { match: fastest full match round in seconds, combo: longest answer streak } }
const stats = { days: {}, sessions: [], records: {}, ...load(STATS_KEY, {}) };

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
  progress[key] = p;
  save(PROGRESS_KEY, progress);

  const lang = key.split('|')[0];
  const day = (stats.days[dayKey()] ||= {});
  const d = (day[lang] ||= [0, 0]);
  d[0] += 1;
  if (isCorrect) d[1] += 1;
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
  }
  save(STATS_KEY, stats);
}

export function getRecords(lang) {
  return stats.records[lang] || {};
}

// Saves a personal best and returns true when it beats the old one
// (match: lower seconds is better, combo: higher is better).
export function saveRecord(lang, kind, value) {
  const r = (stats.records[lang] ||= {});
  const better = kind === 'match' ? !(r.match <= value) : !(r.combo >= value);
  if (!better) return false;
  r[kind] = value;
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
  progress[key] = p;
  save(PROGRESS_KEY, progress);
}

// Answers given today in one language.
export function todayAnswers(lang) {
  return stats.days[dayKey()]?.[lang]?.[0] || 0;
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
  save(PROGRESS_KEY, progress);
  save(STATS_KEY, stats);
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
    }
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
