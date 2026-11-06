// Game rules with no DOM or storage, so they can be unit-tested with node --test
// (tests/unit). Used by game.js (typed answers) and placement.js (placement test).

// ---------- typed answers ----------

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

// ---------- placement test ----------

export const PER_LEVEL = 6;
export const PASS = 4; // right answers out of PER_LEVEL that count as knowing a level
export const STOP = 2; // this few or fewer: the next level is skipped

// The level to start at: the one after the highest level passed (3 at most). A language with a
// letters level suggests it when even level 1 was mostly missed (the script itself is the hurdle).
export function suggestLevel(scores, hasLetters) {
  let level = 1;
  for (const lv of [1, 2, 3]) {
    if ((scores[lv] ?? 0) >= PASS) level = Math.min(3, lv + 1);
    else break;
  }
  if (hasLetters && (scores[1] ?? 0) <= STOP) return 0;
  return level;
}
