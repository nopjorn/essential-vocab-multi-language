// First-run welcome: three short steps (language, level, daily goal) before Home.
// Shown only while nothing is saved on the device; finishing or skipping saves settings.
import { settings, saveSettings, firstRun } from './store.js';
import { state, h, render, nameOf, loadLang, levelOf, levelLabel, ensureAudio } from './core.js';
import { icon } from './icons.js';
import { sfx } from './sound.js';

const GOALS = [10, 20, 50, 100];
const STEPS = 3;
let pending = firstRun;

export function needsWelcome() {
  return pending;
}

export function renderWelcome(onDone) {
  const t = state.t;
  const choice = { lang: settings.lang, level: 1, goal: settings.dailyGoal };
  let step = 0;

  async function finish() {
    ensureAudio();
    settings.lang = choice.lang;
    settings.level[choice.lang] = choice.level;
    settings.dailyGoal = choice.goal;
    // Start with the first two sets of the chosen level.
    try {
      const vocab = await loadLang(choice.lang);
      const first = vocab.sets.filter((x) => levelOf(x) === choice.level).slice(0, 2).map((x) => x.id);
      if (first.length) settings.sets[choice.lang] = first;
    } catch {
      /* offline before the vocab is cached: Home falls back to the first sets */
    }
    saveSettings();
    pending = false;
    sfx('done');
    onDone();
  }

  function skip() {
    saveSettings();
    pending = false;
    onDone();
  }

  // One tappable card per option; `key` names the field in `choice` it sets.
  const options = (key, list) =>
    h('div', { class: 'choice-list', role: 'radiogroup' }, list.map((o) =>
      h('button', {
        type: 'button',
        role: 'radio',
        class: `choice-card${choice[key] === o.value ? ' on' : ''}`,
        'aria-checked': String(choice[key] === o.value),
        onclick: () => {
          choice[key] = o.value;
          sfx('tap');
          draw();
        },
      },
      o.lead,
      h('span', { class: 'row-text' }, h('span', { class: 'row-label' }, o.label), o.sub ? h('span', { class: 'row-sub' }, o.sub) : null),
      h('span', { class: 'check-circle', 'aria-hidden': 'true' }, icon('check', { size: 16 })))));

  function body() {
    if (step === 0) {
      return [
        h('img', { class: 'welcome-logo', src: 'assets/icons/icon-192.png', alt: '', width: 88, height: 88 }),
        h('h1', { class: 'welcome-title' }, t.welcomeTitle),
        h('p', { class: 'welcome-sub' }, t.welcomeSub),
        h('h2', { class: 'welcome-q' }, t.welcomeLang),
        options('lang', state.index.learn.map((l) => ({
          value: l.code,
          lead: h('span', { class: 'flag big', 'aria-hidden': 'true' }, l.flag),
          label: nameOf(l.name),
          sub: l.nativeName,
        }))),
      ];
    }
    if (step === 1) {
      return [
        h('h1', { class: 'welcome-title' }, t.welcomeLevel),
        h('p', { class: 'welcome-sub' }, t.welcomeLevelSub),
        options('level', (state.index.learn.find((l) => l.code === choice.lang)?.letters ? [0, 1, 2, 3] : [1, 2, 3]).map((lv) => ({
          value: lv,
          lead: h('span', { class: 'level-num' }, lv === 0 ? 'あ' : lv),
          label: lv === 0 ? t.levelLetters : `${levelLabel(t, lv)} · ${t.levelNames[lv]}`,
          sub: t.levelDesc[lv],
        }))),
      ];
    }
    return [
      h('h1', { class: 'welcome-title' }, t.welcomeGoal),
      h('p', { class: 'welcome-sub' }, t.welcomeGoalSub),
      options('goal', GOALS.map((g, i) => ({
        value: g,
        lead: h('span', { class: 'row-icon green' }, icon('target', { size: 18 })),
        label: t.goalNames[i],
        sub: t.goalPerDay.replace('{n}', g),
      }))),
    ];
  }

  function draw() {
    const last = step === STEPS - 1;
    render(h('div', { class: 'welcome' },
      h('div', { class: 'welcome-top' },
        step > 0
          ? h('button', { class: 'icon-btn', type: 'button', 'aria-label': t.back, onclick: () => { step--; draw(); } }, icon('chevronLeft'))
          : h('span', { class: 'icon-btn-spacer' }),
        h('div', { class: 'dots', 'aria-label': `${step + 1}/${STEPS}` },
          Array.from({ length: STEPS }, (_, i) => h('i', { class: i <= step ? 'on' : '' }))),
        h('button', { class: 'text-btn', type: 'button', onclick: skip }, t.skip)),
      h('div', { class: 'welcome-body' }, body()),
      h('div', { class: 'welcome-actions' },
        h('button', {
          class: 'btn primary big',
          type: 'button',
          onclick: () => {
            if (last) return finish();
            step++;
            draw();
          },
        }, last ? [icon('play', { size: 18, fill: true }), t.letsStart] : [t.next, icon('chevronRight', { size: 20 })])),
    ));
  }

  draw();
}
