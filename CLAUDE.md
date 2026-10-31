# CLAUDE.md

Project brief for Claude Code. Read this first; open other files only for the area you are changing.

## What this is

**ศัพท์จำเป็น · Essential Vocab**: a multilingual vocabulary game for Thai speakers. It is a static
PWA with **no build step**, hosted on GitHub Pages and tuned for iPhone (Pro Max) and iPad Air in
Safari or as a Home Screen app.

- Learn: English 🇬🇧 (85 sets, 3,291 words), Korean 🇰🇷 (91 sets, 3,266), Japanese 🇯🇵 (85 sets, 3,174),
  each in 3 levels (≈1,000 words per level)
- Translate into: Thai (all languages); English (Korean and Japanese)
- 7 modes: mix (default; a different mode per question), flash, quiz, reverse, listen, type, match; Leitner boxes 0–5 (box ≥ 3 = mastered)
- Game feel: combo counter, Web Audio sound effects (Settings toggle), pop/shake feedback, match timer with best time, badges
- Native-app style UI: bottom tab bar (Home · Progress · **Start** · Guide · Settings; Start is a raised round
  button that starts a round from any tab), iOS large titles, inset grouped lists, full-screen games,
  swipeable flashcards (right = known, left = not yet)
- UI language follows the translation language (Thai/English); light/dark/system theme

## ✅ Every update must include

The CI (`.github/workflows/ci.yml`) and `scripts/validate.mjs` enforce most of this.

1. **Version bump**: `node scripts/bump-version.mjs patch|minor|major`. Use patch for fixes and
   data typos, minor for features or new word sets/languages, major for breaking changes
   (e.g. a progress storage format change).
2. **Changelog**: fill in the new entry in `data/changelog.json` (`th` and `en` lists, user-facing
   wording), then `node scripts/bump-version.mjs --sync` to regenerate `CHANGELOG.md`.
3. **Guide**: update `assets/js/guide.js` (Thai **and** English, same section ids) when gameplay,
   settings or install steps change.
4. **This file**: update the sections below when structure, conventions or counts change.
5. **Cache list**: a new file the app loads → add it to `CORE` in `sw.js`.
6. Run `node scripts/validate.mjs` (must print `OK`) and test in a browser (see Testing).
7. **Commit messages and pull requests are written in Thai** (title and body). Code identifiers,
   file names and commands stay as they are, e.g. `v1.2.0: เพิ่มภาษาจีน และแก้บั๊กโหมดจับคู่`.
8. **Features list**: keep "What the app can do" below and the feature list in `README.md` in step with the
   code (add new abilities, drop removed ones).
9. **Finish by merging to `main`** (standing instruction from the owner, no need to ask each time): when the
   code is done and tested, commit in Thai, push the branch, open a PR into `main` (Thai title and body),
   wait for CI to pass, then merge it. Steps 1–8 (version, changelog + `CHANGELOG.md`, guide, this file,
   README) must be in that PR. If CI is red or the merge conflicts, fix it first; never skip checks.

## What the app can do

- **Learn** English, Korean, Japanese (3 levels each, ≈3,000 words per language); translations in Thai, and English for Korean/Japanese. Korean starts with 5 Hangul letter sets for absolute beginners
- **Welcome** (first run only): 3 steps to pick language, level and daily goal (Skip keeps defaults)
- **Home**: language switch, Today card (daily-goal ring, streak, Continue / Quick 5, mastered + accuracy footer),
  "Up next" recommended set (plays it alone), mode tiles (Mixed is the wide suggested tile), search for sets and the
  words inside them, level switch, multi-select word sets (fully mastered sets get a gold crown)
- **Word list of a set** (list icon on a set row): every word with reading, translation, note and speaker;
  tap the circle to mark a word as already known (mastered, undoable; not counted as an answer);
  "Practice this set" plays only that set
- **7 game modes**: mixed, swipe flashcards (with undo), pick the meaning, pick the word, listen, type (with a hint),
  match (timed, best-time record); Leitner review boxes 0–5. Combo counter with a burst every 5, sound effects,
  options at the bottom of the screen on phones
- **Results screen**: animated ring, newly mastered words, comparison with the last game, goal progress, best combo,
  new records, newly earned badges
- **Progress**: overview and per-language detail (tiles, badges, per-level set bars, 14-day chart, weak words with one-tap practice, history)
- **Settings**: translation/app language, questions per round, daily goal, reading, auto speak, sound effects, theme, export/import progress backup (.json, merged on import), per-language reset, what's new
- **PWA**: installable on iPhone/iPad, works offline, update toast, in-app guide

## Layout

```
index.html              shell: iOS meta, icons, launch screens, early theme script, loads version.js + app.js
TODO.md                 idea backlog grouped by type of work (docs only: not deployed, no version bump)
version.js              APP_VERSION (semver) + APP_BUILD ('dev'; CI stamps "<run>.<sha>")
sw.js                   offline cache; cache name = version + build; CORE file list
manifest.webmanifest    PWA manifest (icons, maskable icon, shortcuts)
assets/css/style.css    all styles; tokens on :root, dark tokens for data-theme / prefers-color-scheme
assets/js/
  app.js        router (#/, #/progress[/lang], #/help[/section], #/settings, #/changelog, #/words/<lang>/<set>), tab bar + Start button,
                update toasts, SW; leaving a game re-routes to the page it was started from; first run shows welcome.js
  core.js       shared state (index, ui strings, navId), h() DOM helper, fill/render, loaders, pageHead/groupTitle,
                speaker/term widgets, toast
  practice.js   Home tab: language switch, Today card (daily-goal ring, streak, Continue / Quick 5, progress footer),
                Up next card, mode tiles, set search + list + selection summary;
                startPractice() (used by the tab bar Start button; sends you Home if the selection can't start),
                playSet() (one set on its own; Up next card and word list)
  settings.js   Settings tab: translation/app language, questions per round, reading, auto speak, sound effects, theme,
                daily goal, progress export/import, per-language reset, about (version, what's new, guide, install)
  game.js       item building, weighted picking, distractors, all 7 modes (mix picks quiz/reverse/listen, type once box ≥ 2),
                combo + bursts, flashcard undo (store.undoRecord), type hint, match timer/record, results screen
                (animated ring, newly mastered words, vs last game, goal progress, best combo, records, new badges, confetti)
  sound.js      Web Audio sound effects sfx(name) (no audio files; settings.sound), buzz() vibration where supported
  badges.js     badges per language computed from progress/stats (streak, words, sets, combo); badgeList(), earnedIds()
  welcome.js    first-run welcome (language, level, daily goal); shown while store.firstRun and not finished
  icons.js      hand-drawn SVG line icons (icon(name)), MODE_ICON map
  words.js      word list of one set (#/words/<lang>/<set>, opened from the list icon on a Home set row; Practice this set)
  progress.js   progress overview + per-language detail (tiles, badges, stacked bars, 14-day chart, weak words)
  info.js       guide and changelog pages
  guide.js      guide content {th, en}
  i18n.js       UI strings {th, en}; uiFor(code) falls back to Thai
  store.js      localStorage: settings, per-word progress, daily stats, sessions, records, last seen version; firstRun;
                record() returns an undo token for undoRecord(); exportData()/importData() backup (merge)
  theme.js      applyTheme(), theme segmented control (used in Settings)
  speech.js     Web Speech API wrapper (iOS needs a user tap before first speech)
  app-info.js   APP_VERSION/APP_BUILD, versionLabel(), isIOS/isStandalone
assets/icons/           app icons + splash screens (generated by scripts/make-icons.py)
data/languages.json     learn[] (code, file, flag, names) and translate[] languages
data/vocab/<code>.json  vocabulary (CC0)
data/changelog.json     version log, newest first: {version, date, changes: {th[], en[]}}
data/LICENSE            CC0 dedication for vocabulary
scripts/
  validate.mjs      data + version/changelog + guide + sw CORE + index.html asset checks
  bump-version.mjs  bump version.js, add changelog entry, regenerate CHANGELOG.md (--sync)
  lib.mjs           helpers shared by the scripts
  make-icons.py     regenerate icons/splashes (Pillow; Inter + WenQuanYi Zen Hei fonts)
.github/workflows/  ci.yml (PR checks + version-bump guard), pages.yml (validate, stamp build, deploy main)
```

## Data format

```json
{ "code": "ja", "name": {"th": "ญี่ปุ่น", "en": "Japanese"}, "nativeName": "日本語",
  "speech": "ja-JP", "romanization": "Modified Hepburn", "license": "CC0-1.0",
  "sets": [{ "id": "greetings", "icon": "👋", "name": {"th": "...", "en": "..."}, "level": 1,
             "words": [{ "term": "今日", "reading": "きょう", "roman": "kyō",
                         "tr": {"th": "วันนี้", "en": "today"}, "note": {"th": "...", "en": "..."} }] }] }
```

- `level` on every set: 1 = beginner (≈A1), 2 = everyday (≈A2), 3 = intermediate (≈B1). Home shows one level at a
  time (segmented control, remembered per language in `settings.level`); Progress groups sets by level
- `term` required; `reading` (kana, only when it differs from `term`), `roman`, and `note` are optional
- `tr.th` is required; a translation language is offered only if **every** word has it
- Within a set: unique `term`s, at least 4 words, avoid duplicate translations (validator warns)
- Across a language a term appears once; a homonym in a second set needs a different meaning **and** a `note`
  (e.g. Korean 이 two / tooth) — the validator enforces this
- Keep set ids consistent across languages where the topic matches. All three languages share the same
  topic plan: level 1 = the original sets (greetings, numbers, people, food, colors, time, body, places, home,
  shopping, nature, verbs, adjectives, questions) + fruits_veg, meals, animals, clothes, city, travel, school,
  jobs, hobbies, feelings, daily, verbs_2, adjectives_2, position, countries, phone_net, health, weather, rooms,
  adverbs, amounts; level 2 = people_2 … city_2; level 3 = society … geography (see the files for the full list).
  Existing set ids and terms are progress keys: never rename them (progress would be lost)
- Korean level 1 begins with 5 `hangul_*` sets (vowels, consonants, tense consonants, compound vowels, first words): `term` is the bare letter, `reading` the letter name (기역), `tr` the Thai/English sound. `say()` in core.js speaks a lone letter inside a syllable (ㄱ → 가, ㅏ → 아)
- Korean verbs/adjectives use dictionary form; Japanese verbs use dictionary form
- Romanization: Korean = Revised Romanization; Japanese = Hepburn with macrons (typing also accepts ou/oo/no-macron)
- One word per line in JSON so diffs stay readable

**Licensing rule:** vocabulary must be original or CC0/public domain. Never copy from Oxford 3000,
NGSL/NAWL (CC BY-SA), TOPIK/JLPT or other published lists.

## Conventions

- Vanilla ES modules, no dependencies, no bundler. DOM is built with `h(tag, attrs, ...children)`;
  use `fill()`/`render()` (they flatten nested arrays and drop null children). Never use innerHTML with data.
- Async screens: read `state.navId` before awaiting and return if it changed afterwards, so a slow
  render never replaces the page the user navigated to (`route()` bumps it).
- UI chrome uses SVG icons from `icons.js` (add new ones there, drawn by hand); emoji only for
  flags and word-set icons. Keep the look formal but friendly: indigo primary, neutral surfaces.
- Games add `body.in-game` (hides the tab bar); `route()` removes it. `startGame()` bumps `state.navId` so a
  pending async page render can't draw over the game.
- CSS class names are global: check `grep` before adding one (e.g. `.stack` once clipped the
  results buttons because the progress bar used the same name).
- UI text goes in `i18n.js` (both `th` and `en`); pages read it through `state.t`.
- Storage keys: `evocab.settings.v1` (includes `dailyGoal`, default 20 answers/day, and `sound`), `evocab.progress.v1` (`lang|setId|term` → `{b,c,w,t}`),
  `evocab.stats.v1` (`days[YYYY-MM-DD][lang] = [answers, correct]`, `sessions[]`, `records[lang] = {match: best secs, combo}`), `evocab.lastVersion`.
  Badges are computed, not stored. A device with neither settings nor progress saved gets the welcome screen.
  Changing a format needs a migration and a major version bump.
- Distractors must differ from the answer in both term and translation (homonyms like 눈 eye/snow).
- iOS: touch targets ≥ 44px, inputs ≥ 16px font (no zoom), respect `env(safe-area-inset-*)`,
  `100dvh`; test portrait and landscape. iPad landscape (≥1024px) shows the Home tab in 2 columns.
  The Start button rises `--fab-rise` above the tab bar on phones (a pill inside the bar from 744px); the toast sits above it.
- Sounds come from `sfx()` in sound.js (oscillator notes, no files); `ensureAudio()` unlocks speech and audio on the first tap.
- Theme: `data-theme="light|dark"` on `<html>` forces a theme; no attribute = follow system.
  New colors need light tokens on `:root` and dark tokens in **both** dark blocks.
- Comments explain why, not what. Match the existing style.

## Testing

```bash
node scripts/validate.mjs
python3 -m http.server 8000      # open http://localhost:8000
```

Browser check with Playwright (Chromium at /opt/pw-browsers in Claude Code cloud): use viewports
440×956 (iPhone Pro Max, isMobile, hasTouch), 820×1180 and 1180×820 (iPad Air 11"), play each mode,
open every tab and the changelog, toggle themes, check for page errors and horizontal overflow.
For flashcards, drag with `page.mouse` (down → move in steps → up): past 28% of the card width
decides, a short drag snaps back, a tap flips.

## Deploy

Push/merge to `main` → `pages.yml` validates, stamps `APP_BUILD`, deploys to GitHub Pages
(Settings › Pages › Source = GitHub Actions). The service worker sees the new version.js, re-caches,
and the app shows "new version ready"; after reload it shows "updated to vX".
