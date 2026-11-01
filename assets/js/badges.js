// Badges per language, worked out from progress and stats (nothing extra is stored),
// so they also appear for progress made before badges existed or imported from a backup.
import { wordKey, getProgress, getRecords, getStats, MASTERED_BOX } from './store.js';
import { MODES } from './game.js';
import { state, cachedLang } from './core.js';
import { dayTotals, streak } from './progress.js';

// [id, icon, color, kind, n]; n is the number in the badge name and, for most kinds, the target.
const BADGES = [
  ['streak3', 'flame', 'orange', 'streak', 3],
  ['streak7', 'flame', 'orange', 'streak', 7],
  ['streak30', 'flame', 'orange', 'streak', 30],
  ['streak100', 'flame', 'orange', 'streak', 100],
  ['streak365', 'flame', 'orange', 'streak', 365],
  ['words50', 'sparkles', 'green', 'words', 50],
  ['words200', 'sparkles', 'green', 'words', 200],
  ['words500', 'sparkles', 'green', 'words', 500],
  ['words1000', 'sparkles', 'green', 'words', 1000],
  ['set1', 'crown', 'indigo', 'sets', 1],
  ['set10', 'crown', 'indigo', 'sets', 10],
  ['level1', 'layers', 'indigo', 'level', 1],
  ['level2', 'layers', 'indigo', 'level', 2],
  ['level3', 'layers', 'indigo', 'level', 3],
  ['combo10', 'bolt', 'teal', 'combo', 10],
  ['combo25', 'bolt', 'teal', 'combo', 25],
  ['perfect1', 'star', 'teal', 'perfect', 1],
  ['perfect10', 'star', 'teal', 'perfect', 10],
  ['survival25', 'heart', 'red', 'survival', 25],
  ['modes', 'shuffle', 'blue', 'modes', 0],
  ['owl', 'owl', 'blue', 'owl', 1],
  ['early', 'sunrise', 'blue', 'early', 1],
  ['polyglot', 'globe', 'green', 'polyglot', 0],
];

// Mastered words and fully mastered sets of a language, plus mastered/total words per
// level; needs its vocabulary loaded.
export function masteryCounts(vocab) {
  let words = 0;
  let sets = 0;
  const levels = {};
  for (const set of vocab.sets) {
    const n = set.words.filter((w) => getProgress(wordKey(vocab.code, set.id, w.term)).b >= MASTERED_BOX).length;
    words += n;
    if (n === set.words.length) sets++;
    const lv = (levels[set.level ?? 1] ||= { have: 0, need: 0 });
    lv.have += n;
    lv.need += set.words.length;
  }
  return { words, sets, levels };
}

export function badgeList(lang) {
  const t = state.t;
  const vocab = cachedLang(lang);
  const counts = vocab ? masteryCounts(vocab) : { words: 0, sets: 0, levels: {} };
  const r = getRecords(lang);
  const days = getStats().days;
  const langsPlayed = state.index.learn.filter((l) => Object.values(days).some((d) => d[l.code]?.[0])).length;
  const have = {
    streak: streak(dayTotals(lang)),
    words: counts.words,
    sets: counts.sets,
    combo: r.combo || 0,
    perfect: r.perfect || 0,
    survival: r.survival || 0,
    modes: (r.modes || []).filter((m) => MODES.includes(m)).length,
    owl: r.owl ? 1 : 0,
    early: r.early ? 1 : 0,
    polyglot: langsPlayed,
  };
  const goal = { modes: MODES.length, polyglot: state.index.learn.length };
  return BADGES.flatMap(([id, icon, color, kind, n]) => {
    let got = have[kind];
    let need = goal[kind] ?? n;
    if (kind === 'level') {
      // a level counts once all its words are mastered; progress shows words
      const lv = counts.levels[n];
      if (vocab && !lv) return [];
      got = lv?.have || 0;
      need = lv?.need || 1;
    }
    return [{
      id,
      icon,
      color,
      need,
      have: Math.min(got, need),
      earned: got >= need,
      name: t.badgeNames[kind].replace('{n}', n || need),
    }];
  });
}
export function earnedIds(lang) {
  return new Set(badgeList(lang).filter((b) => b.earned).map((b) => b.id));
}
