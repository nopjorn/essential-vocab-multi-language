// Settings tab: learning options, display, learning data and about (iOS-style grouped list).
import { settings, saveSettings, resetLanguage, exportData, importData, dayKey, BACKUP_FORMAT } from './store.js';
import { state, h, render, nameOf, pageHead, groupTitle, setUiLang, loadLang, speechTag, toast } from './core.js';
import { speechSupported, hasVoice } from './speech.js';
import { themeControl, applyTheme } from './theme.js';
import { playerLevel, LOOKS, isUnlocked, unlockNeed } from './engage.js';
import { sfx } from './sound.js';
import { icon } from './icons.js';
import { versionLabel, APP_VERSION } from './app-info.js';

const COUNTS = [10, 20, 30, 0]; // 0 = all
const GOALS = [10, 20, 50, 100];

function rowIcon(name, color) {
  return h('span', { class: `row-icon ${color}` }, icon(name, { size: 18 }));
}

function rowText(label, sub) {
  return h('span', { class: 'row-text' }, h('span', { class: 'row-label' }, label), sub ? h('span', { class: 'row-sub' }, sub) : null);
}

function toggleRow(key, ic, color, label, sub) {
  return h('label', { class: 'row' },
    rowIcon(ic, color),
    rowText(label, sub),
    h('span', { class: 'switch-wrap' },
      h('input', {
        type: 'checkbox',
        class: 'sr-only',
        checked: settings[key],
        onchange: (e) => {
          settings[key] = e.target.checked;
          saveSettings();
        },
      }),
      h('span', { class: 'switch', 'aria-hidden': 'true' })),
  );
}

function linkRow(href, ic, color, label, value) {
  return h('a', { class: 'row', href },
    rowIcon(ic, color),
    rowText(label),
    value ? h('span', { class: 'row-value' }, value) : null,
    icon('chevronRight', { size: 18, cls: 'chev' }),
  );
}

// Hands the backup to the share sheet when the browser can share files (iOS), otherwise downloads it.
async function exportProgress(t) {
  const name = `essential-vocab-${dayKey()}.json`;
  const file = new File([JSON.stringify(exportData(APP_VERSION))], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return;
    }
    const url = URL.createObjectURL(file);
    const a = h('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(t.exportDone);
  } catch {
    /* share sheet dismissed: nothing to report */
  }
}

async function importProgress(file, t) {
  if (!file) return;
  let words = null;
  try {
    const data = JSON.parse(await file.text());
    if (data?.format !== BACKUP_FORMAT) throw new Error('bad');
    if (!confirm(t.importConfirm.replace('{file}', file.name))) return;
    words = importData(data);
  } catch {
    /* falls through to the error toast */
  }
  if (words === null) toast(t.importBad);
  else {
    toast(t.importDone.replace('{n}', words));
    renderSettings();
  }
}

// One unlockable look (accent, card pattern or sound pack) as a row of choices; locked ones
// show what unlocks them.
function lookPicker(key, t) {
  const swatch = key === 'accent';
  return h('div', { class: `look-picker${swatch ? ' swatches' : ''}`, role: 'radiogroup', 'aria-label': t.lookGroups[key] },
    LOOKS[key].map((value) => {
      const open = isUnlocked(key, value);
      const id = `${key}:${value}`;
      return h('label', { class: `look${open ? '' : ' locked'}`, title: open ? t.lookNames[id] : unlockNeed(key, value) },
        h('input', {
          type: 'radio',
          name: key,
          value,
          checked: settings[key] === value,
          disabled: !open,
          onchange: () => {
            settings[key] = value;
            saveSettings();
            applyTheme();
            if (key === 'soundPack') sfx('combo', value);
          },
        }),
        h('span', { class: 'look-face' },
          swatch ? h('i', { class: `look-swatch sw-${value}`, 'aria-hidden': 'true' })
            : key === 'cardStyle' ? h('i', { class: `look-card card-${value}`, 'aria-hidden': 'true' })
              : icon('music', { size: 18 }),
          h('span', { class: 'look-name' }, t.lookNames[id]),
          open ? null : h('span', { class: 'look-lock' }, icon('lock', { size: 12 }), unlockNeed(key, value))));
    }));
}

export async function renderSettings() {
  setUiLang();
  const t = state.t;
  const nav = state.navId;

  const targetSelect = h('select', {
    id: 'target',
    class: 'row-select',
    onchange: (e) => {
      settings.target = e.target.value;
      saveSettings();
      renderSettings();
    },
  }, state.index.translate.map((x) => h('option', { value: x.code, selected: x.code === settings.target }, x.nativeName)));

  const countSeg = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': t.questionsPerRound },
    COUNTS.map((c) =>
      h('label', {},
        h('input', {
          type: 'radio',
          name: 'count',
          value: c,
          checked: settings.count === c,
          onchange: () => {
            settings.count = c;
            saveSettings();
          },
        }),
        h('span', {}, c === 0 ? t.all : String(c)),
      )),
  );

  const goalSeg = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': t.dailyGoal },
    GOALS.map((g) =>
      h('label', {},
        h('input', {
          type: 'radio',
          name: 'goal',
          value: g,
          checked: settings.dailyGoal === g,
          onchange: () => {
            settings.dailyGoal = g;
            saveSettings();
          },
        }),
        h('span', {}, String(g)))));

  // Voice availability for each language (needs its speech tag, so load the vocab files).
  let voiceNote = null;
  if (!speechSupported) voiceNote = t.noSpeech;
  else {
    try {
      const missing = [];
      for (const l of state.index.learn) {
        await loadLang(l.code);
        if (!hasVoice(speechTag(l.code))) missing.push(nameOf(l.name));
      }
      if (missing.length) voiceNote = t.noVoice.replace('{lang}', missing.join(', '));
    } catch {
      /* offline and not cached: skip the note */
    }
  }

  if (nav !== state.navId) return;

  const resetRows = state.index.learn.map((l) =>
    h('button', {
      class: 'row danger',
      type: 'button',
      onclick: () => {
        const name = nameOf(l.name);
        if (!confirm(t.resetConfirm.replace('{lang}', name))) return;
        resetLanguage(l.code);
        toast(t.resetDone);
      },
    },
    rowIcon('trash', 'red'),
    rowText(t.resetFor.replace('{lang}', nameOf(l.name))),
    h('span', { class: 'flag', 'aria-hidden': 'true' }, l.flag)),
  );

  render(
    pageHead(t.settingsTitle),

    groupTitle(t.groupLearning),
    h('div', { class: 'group' },
      h('div', { class: 'row' },
        rowIcon('globe', 'blue'),
        h('label', { for: 'target', class: 'row-text' }, h('span', { class: 'row-label' }, t.translateTo)),
        targetSelect),
      h('div', { class: 'row stacked' },
        h('div', { class: 'row-head' }, rowIcon('hash', 'indigo'), rowText(t.questionsPerRound)),
        countSeg),
      h('div', { class: 'row stacked' },
        h('div', { class: 'row-head' }, rowIcon('target', 'green'), rowText(t.dailyGoal, t.dailyGoalSub)),
        goalSeg),
      toggleRow('showRoman', 'eye', 'teal', t.showReading, t.showReadingSub),
      speechSupported ? toggleRow('autoSpeak', 'speaker', 'orange', t.autoSpeak, t.autoSpeakSub) : null,
      toggleRow('sound', 'music', 'indigo', t.soundFx, t.soundFxSub),
    ),
    h('p', { class: 'group-foot' }, t.translateHint),
    voiceNote ? h('p', { class: 'group-foot warn' }, voiceNote) : null,

    groupTitle(t.groupDisplay),
    h('div', { class: 'group' },
      h('div', { class: 'row stacked' },
        h('div', { class: 'row-head' }, rowIcon('sun', 'gray'), rowText(t.theme)),
        themeControl()),
    ),

    groupTitle(t.groupCollection),
    (() => {
      const lv = playerLevel();
      return h('div', { class: 'group' },
        h('a', { class: 'row', href: '#/progress' },
          rowIcon('trophy', 'orange'),
          h('span', { class: 'row-text' },
            h('span', { class: 'row-label' }, t.playerLevel.replace('{n}', lv.level)),
            h('span', { class: 'xp-bar' }, h('span', { class: 'xp-fill', style: `width:${lv.pct}%` })),
            h('span', { class: 'row-sub' }, `${lv.xp - lv.from}/${lv.to - lv.from} XP`)),
          icon('chevronRight', { size: 18, cls: 'chev' })),
        ['accent', 'cardStyle', 'soundPack'].map((key) =>
          h('div', { class: 'row stacked' },
            h('div', { class: 'row-head' }, rowIcon({ accent: 'palette', cardStyle: 'flash', soundPack: 'music' }[key], { accent: 'indigo', cardStyle: 'teal', soundPack: 'green' }[key]), rowText(t.lookGroups[key])),
            lookPicker(key, t))));
    })(),
    h('p', { class: 'group-foot' }, t.collectionNote),

    groupTitle(t.groupData),
    h('div', { class: 'group' },
      h('button', { class: 'row', type: 'button', onclick: () => exportProgress(t) },
        rowIcon('upload', 'blue'), rowText(t.exportData, t.exportDataSub),
        icon('chevronRight', { size: 18, cls: 'chev' })),
      h('label', { class: 'row' },
        rowIcon('download', 'green'), rowText(t.importData, t.importDataSub),
        icon('chevronRight', { size: 18, cls: 'chev' }),
        h('input', {
          type: 'file',
          class: 'sr-only',
          accept: 'application/json,.json',
          onchange: (e) => {
            importProgress(e.target.files[0], t);
            e.target.value = '';
          },
        })),
      resetRows),
    h('p', { class: 'group-foot' }, t.dataNote),

    groupTitle(t.groupAbout),
    h('div', { class: 'group' },
      linkRow('#/changelog', 'sparkles', 'indigo', t.whatsNew, versionLabel()),
      linkRow('#/help', 'guide', 'blue', t.guideTitle),
      linkRow('#/help/install', 'share', 'teal', t.installTitle),
    ),
    h('p', { class: 'group-foot' }, t.licenseNote),
  );
}
